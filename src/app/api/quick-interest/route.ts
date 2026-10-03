import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminConnectionTag, sendAdminPush } from "@/lib/sendPush";
import { TERMS_VERSION } from "@/lib/consent";
import { toLocalPhone } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { clientIp } from "@/lib/adminAuth";
import { overLimit, UUID_RE } from "@/lib/rateLimit";
import { createDealConnection, isCurrentConnectionConsent } from "@/lib/dealConnection";

// 비회원이 "관심있어요"를 누를 때, 전체 회원가입 없이 전화번호만으로 바로
// 점핑매니저에게 리드를 넘기기 위한 경량 엔드포인트입니다.
// 2026-10-01 F-1 리드 보안:
//   · dealId uuid 형식 + 실제 매물 + 진행 중(status active, 마감 시각 전)만
//   · 휴대폰 번호 01[016789] 10~11자리 (normalizePhone — "+82 10-…"·하이픈도 허용)
//   · 횟수 제한: IP 10분 10회, 같은 번호 10분 3회 (서버 메모리, src/lib/rateLimit.ts)
//   · 같은 매물+같은 번호가 이미 있으면 새로 저장·알림 없이 200 { duplicate: true }
//   · 개인정보 동의 + 동의 문구 버전 필수 — 저장 시각·버전은 서버가 기록
// 2026-10-03 F-3a: 판매자 연결 동의(7-1) 분기 — connectionConsent=true + connectionConsentVersion(서버 상수와 같은지만 검사)이면
//   quick_leads 저장(이미 있으면 그 행) + 거래 연결 기록(deal_connections, buyer_phone) 생성. 없으면 지금처럼 관심 표시만.
//   응답 connection: "created" | "duplicate"(진행 중 연결 이미 있음). 연결 저장 실패는 500 — 리드는 남아 있어 다시 보내면 연결만 만듦.
const PHONE_RE = /^01[016789]\d{7,8}$/;
const IP_LIMIT = 10;
const PHONE_LIMIT = 3;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { dealId, phone, privacyConsent, consentVersion, connectionConsent, connectionConsentVersion } = (body ?? {}) as Record<string, unknown>;
  const wantsConnection = connectionConsent === true;

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
  if (wantsConnection && !isCurrentConnectionConsent(connectionConsentVersion)) {
    return NextResponse.json({ error: "화면을 새로고침한 뒤 다시 시도해주세요.", field: "connectionConsent" }, { status: 400 });
  }

  if (overLimit(`qi-ip:${clientIp(req)}`, IP_LIMIT) || overLimit(`qi-phone:${local}`, PHONE_LIMIT)) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // 데모 모드: 저장 없이 성공만 반환
    return NextResponse.json({ ok: true, demo: true, ...(wantsConnection ? { connection: "created" } : {}) });
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
  const connect = (leadId: string) =>
    createDealConnection(supabaseAdmin, {
      dealId,
      dealTitle: deal.title ?? "",
      buyer: { phone: local },
      source: "quick_lead",
      sourceId: leadId,
    });
  const connectFailed = () =>
    NextResponse.json({ error: "연결 요청을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });

  if (existing && existing.length > 0) {
    if (!wantsConnection) return NextResponse.json({ ok: true, duplicate: true });
    // 관심 표시는 예전에 했고 이번에 연결 동의 — 연결 기록만
    const connection = await connect(existing[0].id);
    if (connection === "failed") return connectFailed();
    if (connection === "created") {
      await sendAdminPush("🤝 판매자 연결 요청", deal.title ? `${deal.title} · 비회원 연결 동의` : "비회원이 판매자 연결에 동의했어요", "/admin", adminConnectionTag());
    }
    return NextResponse.json({ ok: true, duplicate: true, connection });
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("quick_leads")
    .insert({
      deal_id: dealId,
      phone: local,
      privacy_consented_at: new Date().toISOString(),
      privacy_consent_version: TERMS_VERSION,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "전송에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });

  const connection = wantsConnection ? await connect(inserted.id) : null;
  if (connection === "failed") return connectFailed();

  // 2026-10-03: 연결 동의가 있으면 회원과 같은 제목 "🤝 판매자 연결 요청" + 건마다 다른 tag(알림창에서 덮어쓰지 않게)
  if (connection) {
    await sendAdminPush("🤝 판매자 연결 요청", deal.title ? `${deal.title} · 비회원 연결 동의(새 리드)` : "비회원이 판매자 연결에 동의했어요", "/admin", adminConnectionTag());
  } else {
    await sendAdminPush("🙋 새 원클릭 리드", deal.title ? `${deal.title} · 비회원 관심` : "비회원 관심 표시가 들어왔어요", "/admin");
  }

  return NextResponse.json({ ok: true, ...(connection ? { connection } : {}) });
}
