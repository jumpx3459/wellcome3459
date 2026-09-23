import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminPush } from "@/lib/sendPush";

export async function POST(req: NextRequest) {
  const { dealId } = await req.json();
  if (!dealId) return NextResponse.json({ ok: false }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: deal } = await supabaseAdmin.from("deals").select("title").eq("id", dealId).single();

  await sendAdminPush(
    "🙋 새 관심 리드",
    deal?.title ? `${deal.title} · 관심있어요` : "매물에 관심 표시가 들어왔어요",
    "/admin"
  );

  return NextResponse.json({ ok: true });
}
