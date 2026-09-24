import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// "JUMP X에서 입찰 참여하기" 클릭 카운트 — 거래 플랫폼이 준비될 때까지는 실제
// 브릿지로 보내지 않고 "준비중" 안내만 하지만, 수요 신호는 계속 쌓아둔다.
export async function POST(req: NextRequest) {
  const { dealId, memberId } = await req.json().catch(() => ({}));
  if (!dealId) return NextResponse.json({ ok: false }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  await supabaseAdmin.from("bridge_interests").insert({ deal_id: dealId, member_id: memberId || null });

  return NextResponse.json({ ok: true });
}
