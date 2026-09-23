import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminPush } from "@/lib/sendPush";

// 비회원이 "관심있어요"를 누를 때, 전체 회원가입 없이 전화번호만으로 바로
// 점핑매니저에게 리드를 넘기기 위한 경량 엔드포인트입니다.
export async function POST(req: NextRequest) {
  const { dealId, phone } = await req.json();

  const digits = (phone ?? "").replace(/[^0-9]/g, "");
  if (!dealId || digits.length < 9) {
    return NextResponse.json({ error: "휴대폰 번호를 확인해주세요." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // 데모 모드: 저장 없이 성공만 반환
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { error } = await supabaseAdmin.from("quick_leads").insert({
    deal_id: dealId,
    phone: digits,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: deal } = await supabaseAdmin.from("deals").select("title").eq("id", dealId).single();
  await sendAdminPush(
    "🙋 새 원클릭 리드",
    deal?.title ? `${deal.title} · 비회원 관심` : "비회원 관심 표시가 들어왔어요",
    "/admin"
  );

  return NextResponse.json({ ok: true });
}
