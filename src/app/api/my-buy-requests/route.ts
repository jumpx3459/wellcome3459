import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 마이페이지 "내 구매 요청" — buy_requests엔 회원 조회용 RLS가 없어서(공개 insert만) 본인 access token을
// 확인한 뒤 service_role로 member_id 일치 건만 최근 10건 반환 (my-referrals와 같은 방식).
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ items: [], demo: true });
  if (!accessToken) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("buy_requests")
    .select("id, product_name, quantity, hope_price, hope_price_unit, contacted, outcome, created_at")
    .eq("member_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}
