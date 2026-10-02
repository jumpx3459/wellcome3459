import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminPush } from "@/lib/sendPush";
import { TERMS_VERSION } from "@/lib/consent";
import { toLocalPhone } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { clientIp } from "@/lib/adminAuth";
import { overLimit, UUID_RE } from "@/lib/rateLimit";

// 비회원이 "관심있어요"를 누를 때, 전체 회원가입 없이 전화번호만으로 바로
// 점핑매니저에게 리드를 넘기기 위한 경량 엔드포인트입니다.
// 2026-10-01 F-1 리드 보안:
//   · dealId uuid 형식 + 실제 매물 + 진행 중(status active, 마감 시각 전)만
//   · 휴대폰 번호 01[016789] 10~11자리 (normalizePhone — "+82 10-…"·하이픈도 허용)
//   · 횟수 제한: IP 10분 10회, 같은 번호 10분 3회 (서버 메모리, src/lib/rateLimit.ts)
//   · 같은 매물+같은 번호가 이미 있으면 새로 저장·알림 없이 200 { duplicate: true }
//   · 개인정보 동의 + 동의 문구 버전 필수 — 저장 시각·버전은 서버가 기록
const PHONE_RE = /^01[016789]\d{7,8}$/;
const IP_LIMIT = 10;
const PHONE_LIMIT = 3;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { dealId, phone, privacyConsent, consentVersion } = (body ?? {}) as Record<string, unknown>;

  if (typeof dealId !== "string" || !UUID_RE.test(dealId)) {
    return NextResponse.json({ error: "매물 정보가 올바르지 않아요.", field: "dealId" }, { status: 400 });
  }
  const local = normalizePhone(typeof phone === "string" ? phone : "");
  if (!PHONE_RE.test(local)) {
    return NextResponse.json({ error: "휴대폰 번호를 정확히 입력해주세요.", field: "phone" }, { status: 400 });
  }
  // 2026-09-30: [필수] 개인정보 수집·이용 동의 (화면 GuestPrivacyConsent) — 동의 시각·문구 버전을 행에 같이 저장
  if (privacyConsent !== true) {
    return NextResponse.json({ error: "개인정보 수집·이용에 동의해주세요.", field: "privacyConsent" }, { status: 400 });
  }
  if (typeof consentVersion !== "string" || !consentVersion) {
    return NextResponse.json({ error: "화면을 새로고침한 뒤 다시 시도해주세요.", field: "privacyConsent" }, { status: 400 });
  }

  if (overLimit(`qi-ip:${clientIp(req)}`, IP_LIMIT) || overLimit(`qi-phone:${local}`, PHONE_LIMIT)) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // 데모 모드: 저장 없이 성공만 반환
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: deal } = await supabaseAdmin.from("deals").select("id, title, status, closes_at").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "없는 매물이에요.", field: "dealId" }, { status: 404 });
  if (deal.status !== "active" || (deal.closes_at && new Date(deal.closes_at).getTime() <= Date.now())) {
    return NextResponse.json({ error: "이미 마감된 매물이에요.", closed: true }, { status: 409 });
  }

  // 중복 억제 — 예전 행은 숫자만 저장("8210…" 포함 가능)이라 두 형식 모두 확인
  const variants = Array.from(new Set([local, toLocalPhone(local), `82${local.slice(1)}`]));
  const { data: existing } = await supabaseAdmin
    .from("quick_leads")
    .select("id")
    .eq("deal_id", dealId)
    .in("phone", variants)
    .limit(1);
  if (existing && existing.length > 0) return NextResponse.json({ ok: true, duplicate: true });

  const { error } = await supabaseAdmin.from("quick_leads").insert({
    deal_id: dealId,
    phone: local,
    privacy_consented_at: new Date().toISOString(),
    privacy_consent_version: TERMS_VERSION,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendAdminPush(
    "🙋 새 원클릭 리드",
    deal.title ? `${deal.title} · 비회원 관심` : "비회원 관심 표시가 들어왔어요",
    "/admin"
  );

  return NextResponse.json({ ok: true });
}
