import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminPush } from "@/lib/sendPush";
import { clientIp } from "@/lib/adminAuth";
import { getMemberFromToken } from "@/lib/photoLimitServer";
import { overLimit, UUID_RE } from "@/lib/rateLimit";

// 회원 "관심있어요" → 운영자 푸시 (관리자 인증 없이 회원 화면이 부름).
// 2026-10-01: 입력 검증 + 호출 횟수 제한 — 예전엔 아무 dealId로 무제한 호출해 운영자에게 푸시를 쏟을 수 있었음.
//   · dealId는 uuid 형식 + 실제 매물만
//   · IP 기준 10분에 10회, 회원 기준 10분에 5회·같은 매물은 10분에 1회 (서버 인스턴스 메모리)
// 2026-10-01 F-1: 방금(2분 안) 저장된 리드가 있을 때만 알림 — 없으면 204 무발송.
//   · 토큰이 오면 그 회원의 interests 행(같은 매물, 2분 안)
//   · 토큰이 없으면 같은 매물의 interests 또는 quick_leads 행(2분 안)
//   (예전엔 토큰 없이 와도 IP 제한만으로 알림 — 실제 리드 없이 운영자 푸시를 보낼 수 있었음)
const IP_LIMIT = 10;
const MEMBER_LIMIT = 5;
const RECENT_MS = 2 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { dealId, accessToken } = await req.json().catch(() => ({}));
  if (typeof dealId !== "string" || !UUID_RE.test(dealId)) return NextResponse.json({ ok: false }, { status: 400 });

  if (overLimit(`ip:${clientIp(req)}`, IP_LIMIT)) return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해주세요." }, { status: 429 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  let member: { id: string } | null = null;
  if (typeof accessToken === "string" && accessToken) {
    member = await getMemberFromToken(supabaseAdmin, accessToken);
    if (!member) return NextResponse.json({ ok: false }, { status: 401 });
    if (overLimit(`m:${member.id}`, MEMBER_LIMIT) || overLimit(`m:${member.id}:${dealId}`, 1)) {
      return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }
  }
  const since = new Date(Date.now() - RECENT_MS).toISOString();
  let hasRecentLead = false;
  if (member) {
    const { data } = await supabaseAdmin.from("interests").select("id").eq("deal_id", dealId).eq("member_id", member.id).gte("created_at", since).limit(1);
    hasRecentLead = !!data?.length;
  } else {
    const [{ data: i }, { data: q }] = await Promise.all([
      supabaseAdmin.from("interests").select("id").eq("deal_id", dealId).gte("created_at", since).limit(1),
      supabaseAdmin.from("quick_leads").select("id").eq("deal_id", dealId).gte("created_at", since).limit(1),
    ]);
    hasRecentLead = !!(i?.length || q?.length);
  }
  if (!hasRecentLead) return new NextResponse(null, { status: 204 });

  const { data: deal } = await supabaseAdmin.from("deals").select("title").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ ok: false }, { status: 404 });

  await sendAdminPush(
    "🙋 새 관심 리드",
    deal.title ? `${deal.title} · 관심있어요` : "매물에 관심 표시가 들어왔어요",
    "/admin"
  );

  return NextResponse.json({ ok: true });
}
