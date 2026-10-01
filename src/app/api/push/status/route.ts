import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 내 푸시 구독 현황 (2026-09-29) — 마이페이지 알림 카드의 "다른 기기 N대에서 알림 받는 중" 표시용.
// body: { accessToken, endpoint? } — endpoint를 주면 그 구독(이 기기)이 서버에 저장돼 있는지도 알려줌.
export async function POST(req: NextRequest) {
  const { accessToken, endpoint } = await req.json().catch(() => ({}));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ count: 0, thisDeviceSaved: false, optedOut: false, demo: true });
  if (!accessToken) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });
  const memberId = userData.user.id;

  const [{ data: subs, error }, { data: member }] = await Promise.all([
    supabaseAdmin.from("push_subscriptions").select("endpoint").eq("member_id", memberId),
    supabaseAdmin.from("members").select("push_opt_out").eq("id", memberId).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2026-10-01: 이 기기 구독의 마지막 발송 성공 시각 — 컬럼이 없으면(SQL 전) null
  let lastSuccessAt: string | null = null;
  if (typeof endpoint === "string" && endpoint) {
    const { data: me } = await supabaseAdmin
      .from("push_subscriptions")
      .select("last_success_at")
      .eq("member_id", memberId)
      .eq("endpoint", endpoint)
      .maybeSingle();
    lastSuccessAt = (me as { last_success_at?: string | null } | null)?.last_success_at ?? null;
  }

  return NextResponse.json({
    count: subs?.length ?? 0,
    thisDeviceSaved: typeof endpoint === "string" && (subs ?? []).some((s) => s.endpoint === endpoint),
    optedOut: Boolean(member?.push_opt_out),
    lastSuccessAt,
  });
}
