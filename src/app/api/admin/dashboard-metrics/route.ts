import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

// 관리자 대시보드 핵심 지표·7일 추세 (2026-09-29) — 읽기 전용 집계.
//   알림 활성 회원 비율 = push_subscriptions의 서로 다른 member_id 수 / members 전체 수
//   알림→확인 전환율(최근 7일) = notification_logs 중 clicked_at 있는 건 / 발송 건(status sent·clicked, failed 제외)
//   일별 추세(최근 7일, 한국 날짜 기준) = members.created_at(가입) · deals.created_at(등록 매물) ·
//     interests.created_at + quick_leads.created_at(리드 — 관리자 리드 목록과 같은 기준)
const DAY_MS = 24 * 3600e3;
const KST_MS = 9 * 3600e3;
const kstDate = (iso: string) => new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ demo: true });
  const db = createClient(supabaseUrl, serviceKey);

  // 오늘 포함 7일 (한국 날짜)
  const todayKst = kstDate(new Date().toISOString());
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(todayKst) - (6 - i) * DAY_MS).toISOString().slice(0, 10));
  const sinceIso = new Date(Date.parse(days[0]) - KST_MS).toISOString(); // 첫날 00:00 KST
  const since7 = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const [members, subs, sent, clicked, newMembers, newDeals, newInterests, newQuick] = await Promise.all([
    db.from("members").select("id", { count: "exact", head: true }),
    db.from("push_subscriptions").select("member_id").not("member_id", "is", null).limit(10000),
    db.from("notification_logs").select("id", { count: "exact", head: true }).gte("sent_at", since7).in("status", ["sent", "clicked"]),
    db.from("notification_logs").select("id", { count: "exact", head: true }).gte("sent_at", since7).not("clicked_at", "is", null),
    db.from("members").select("created_at").gte("created_at", sinceIso).limit(5000),
    db.from("deals").select("created_at").gte("created_at", sinceIso).limit(5000),
    db.from("interests").select("created_at").gte("created_at", sinceIso).limit(5000),
    db.from("quick_leads").select("created_at").gte("created_at", sinceIso).limit(5000),
  ]);
  const err = [members, subs, sent, clicked, newMembers, newDeals, newInterests, newQuick].find((r) => r.error)?.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const bucket = (rows: { created_at: string }[] | null) => {
    const m: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    for (const r of rows ?? []) {
      const d = kstDate(r.created_at);
      if (d in m) m[d] += 1;
    }
    return days.map((d) => m[d]);
  };

  return NextResponse.json({
    members: { total: members.count ?? 0, withPush: new Set((subs.data ?? []).map((r) => r.member_id)).size },
    notifications7d: { sent: sent.count ?? 0, clicked: clicked.count ?? 0 },
    daily: {
      days,
      signups: bucket(newMembers.data),
      deals: bucket(newDeals.data),
      leads: bucket([...(newInterests.data ?? []), ...(newQuick.data ?? [])]),
    },
  });
}
