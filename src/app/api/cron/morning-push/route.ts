import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendDealPush, sendNoticePush } from "@/lib/sendPush";

// 2026-09-30: 아침 8시(KST) 야간 보류분 발송 — 밤 9시~아침 8시에 등록돼 push_sent_at이 비어 있는
// 진행 중 매물·공지를 모아서 보낸다. 호출: Authorization: Bearer ${CRON_SECRET} (Vercel Cron 형식).
// 발송 조건(active·마감 전·1회·야간 아님)은 sendDealPush/sendNoticePush가 다시 확인하므로,
// 야간에 수동 호출해도 발송되지 않고 held로 남는다.

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ deals: [], notices: [], demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const nowIso = new Date().toISOString();

  const [{ data: deals, error: dealsError }, { data: notices, error: noticesError }] = await Promise.all([
    supabaseAdmin
      .from("deals")
      .select("id")
      .eq("status", "active")
      .is("push_sent_at", null)
      .or(`closes_at.is.null,closes_at.gt.${nowIso}`)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("urgent_notices")
      .select("id")
      .eq("status", "active")
      .is("push_sent_at", null)
      .order("created_at", { ascending: true }),
  ]);
  if (dealsError || noticesError) {
    return NextResponse.json({ error: (dealsError ?? noticesError)?.message }, { status: 500 });
  }

  const dealResults = [];
  for (const d of deals ?? []) dealResults.push({ id: d.id, ...(await sendDealPush(d.id)) });
  const noticeResults = [];
  for (const n of notices ?? []) noticeResults.push({ id: n.id, ...(await sendNoticePush(n.id)) });

  console.info(`[morning-push] deals=${dealResults.length} notices=${noticeResults.length}`);
  return NextResponse.json({ deals: dealResults, notices: noticeResults });
}
