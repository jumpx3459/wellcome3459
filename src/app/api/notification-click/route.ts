import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 웹 푸시 알림을 실제로 클릭했을 때 sw.js가 호출하는 경량 엔드포인트.
// 클릭 여부를 서버에 남겨야 "알림→매물확인 전환율"(North Star Metric)을 계산할 수 있다.
export async function POST(req: NextRequest) {
  const { logId } = await req.json().catch(() => ({}));
  if (!logId) return NextResponse.json({ ok: false }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  // 'sent' 상태일 때만 'clicked'로 전이 — failed 로그가 클릭으로 뒤집히는 것 방지
  await supabaseAdmin
    .from("notification_logs")
    .update({ status: "clicked", clicked_at: new Date().toISOString() })
    .eq("id", logId)
    .eq("status", "sent");

  return NextResponse.json({ ok: true });
}
