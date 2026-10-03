import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminPush } from "@/lib/sendPush";
import { overLimit, UUID_RE } from "@/lib/rateLimit";
import { createDealConnection, hasOpenMemberConnection, isCurrentConnectionConsent } from "@/lib/dealConnection";

// 2026-10-03 F-3a: 회원 "관심있어요" → 판매자 연결 동의(7-1) → 거래 연결 기록(deal_connections) 생성.
// body: { accessToken, dealId, connectionConsent: true, connectionConsentVersion }
//   · 회원 id는 토큰에서. 진행 중 매물(status active, 마감 시각 전)만
//   · 동의 시각 = 서버 지금 시각, 버전 = 서버 상수. 화면이 보낸 버전은 같은지만 검사(다르면 예전 화면 → 새로고침 안내)
//   · 관심 표시(interests)는 화면이 지금처럼 먼저 저장 — 여기선 그 행 id를 source_id로만 이음(없으면 null)
//   · 진행 중 연결이 이미 있으면(23505) 200 { duplicate: true }
// body에 check: true면 저장 없이 진행 중 연결 여부만 { open } — 상세 화면 [판매자 연결 요청] 표시용
const MEMBER_LIMIT = 10;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { accessToken, dealId, connectionConsent, connectionConsentVersion, check } = (body ?? {}) as Record<string, unknown>;

  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (typeof dealId !== "string" || !UUID_RE.test(dealId)) {
    return NextResponse.json({ error: "매물 정보가 올바르지 않아요.", field: "dealId" }, { status: 400 });
  }
  if (check !== true) {
    if (connectionConsent !== true) {
      return NextResponse.json({ error: "판매자 연결에 동의해주세요.", field: "connectionConsent" }, { status: 400 });
    }
    if (!isCurrentConnectionConsent(connectionConsentVersion)) {
      return NextResponse.json({ error: "화면을 새로고침한 뒤 다시 시도해주세요.", field: "connectionConsent" }, { status: 400 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });
    return NextResponse.json(check === true ? { open: false, demo: true } : { ok: true, demo: true });
  }

  const db = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await db.auth.getUser(accessToken);
  if (userError || !userData.user) return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });
  const memberId = userData.user.id;

  if (check === true) {
    const open = await hasOpenMemberConnection(db, dealId, memberId);
    if (open === null) return NextResponse.json({ error: "조회에 실패했어요." }, { status: 500 });
    return NextResponse.json({ open });
  }

  if (overLimit(`conn-member:${memberId}`, MEMBER_LIMIT)) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const { data: deal } = await db.from("deals").select("id, title, status, closes_at").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "없는 매물이에요.", field: "dealId" }, { status: 404 });
  if (deal.status !== "active" || (deal.closes_at && new Date(deal.closes_at).getTime() <= Date.now())) {
    return NextResponse.json({ error: "이미 마감된 매물이에요.", closed: true }, { status: 409 });
  }

  const { data: member } = await db.from("members").select("id").eq("id", memberId).maybeSingle();
  if (!member) return NextResponse.json({ error: "회원 정보가 없어요. 가입을 마친 뒤 다시 시도해주세요." }, { status: 403 });

  const { data: interest } = await db.from("interests").select("id").eq("deal_id", dealId).eq("member_id", memberId).limit(1).maybeSingle();

  const result = await createDealConnection(db, {
    dealId,
    dealTitle: deal.title ?? "",
    buyer: { memberId },
    source: "interest",
    sourceId: interest?.id ?? null,
  });
  if (result === "duplicate") return NextResponse.json({ ok: true, duplicate: true });
  if (result === "failed") return NextResponse.json({ error: "연결 요청을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });

  await sendAdminPush("🤝 판매자 연결 요청", deal.title ? `${deal.title} · 회원 연결 동의` : "회원이 판매자 연결에 동의했어요", "/admin");
  return NextResponse.json({ ok: true });
}
