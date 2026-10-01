import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 이 기기 구독만 삭제 (2026-10-01) — MY "이 기기 푸시 알림"의 [이 기기 알림 끄기], 키가 바뀌어 다시 구독할 때 예전 구독 정리.
// body: { accessToken, endpoint } — 본인(토큰) 구독 중 그 endpoint 한 건만. 다른 기기·회원 설정(push_opt_out)은 그대로.
export async function POST(req: NextRequest) {
  const { accessToken, endpoint } = await req.json().catch(() => ({}));
  if (typeof accessToken !== "string" || !accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });

  const { error, count } = await supabaseAdmin
    .from("push_subscriptions")
    .delete({ count: "exact" })
    .eq("member_id", userData.user.id)
    .eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, removed: count ?? 0 });
}
