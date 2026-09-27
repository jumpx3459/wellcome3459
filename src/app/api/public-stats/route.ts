import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 2026-09-27: 홈 화면 신뢰 지표를 "890명"(하드코딩) 대신 실제 인증 사업자 수로
// 바꾸기 위한 공개 통계 엔드포인트. members 테이블은 RLS가 본인만 조회 가능하게
// 잠겨 있어(members_self_select) 클라이언트에서 바로 count를 못 가져오므로,
// 서비스 롤로 "인증된 사업자 수"만 집계해서 반환합니다 — 개인정보(전화번호,
// 상호명 등)는 절대 포함하지 않고 숫자 하나만 내려줍니다.
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ businessCount: 0, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { count, error } = await supabaseAdmin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("business_verified", true);

  if (error) {
    return NextResponse.json({ businessCount: 0, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ businessCount: count ?? 0 });
}
