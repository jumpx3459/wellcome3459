import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getKpiExcludedMemberIds, inList, TEST_TITLE_PATTERN } from "@/lib/kpiExclusion";

// 관리자 대시보드 핵심 지표·7일 추세·운영 카운트 (2026-09-29, 2026-09-30 커밋 K) — 읽기 전용 집계.
// 모든 수치에서 관리자·테스트 계정(kpi_excluded_members)과 [테스트] 매물을 뺀다. 목록 개수가 아니라 DB count(head, exact).
//   알림 활성 회원 = 푸시 구독 1개 이상 · push_opt_out = false (kpi_daily push_active_members와 같은 기준) / 전체 회원
//   알림→확인 전환율(최근 7일) = notification_logs 중 clicked_at 있는 건 / 발송 건(status sent·clicked, failed 제외)
//   일별 추세(최근 7일, 한국 날짜 기준) = members.created_at(가입) · deals.created_at(등록 매물) ·
//     interests.created_at + quick_leads.created_at(리드 — 관리자 리드 목록과 같은 기준)
//   counts = 전체 회원·사업자 인증·오늘 신규가입·미연락 리드(interests+quick_leads)·재고문의 미연락·대기 판매신청·오늘 등록매물
const DAY_MS = 24 * 3600e3;
const KST_MS = 9 * 3600e3;
const kstDate = (iso: string) => new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ demo: true });
  const db = createClient(supabaseUrl, serviceKey);

  // 오늘 포함 7일 (한국 날짜)
  const todayKst = kstDate(new Date().toISOString());
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(todayKst) - (6 - i) * DAY_MS).toISOString().slice(0, 10));
  const sinceIso = new Date(Date.parse(days[0]) - KST_MS).toISOString(); // 첫날 00:00 KST
  const todayStartIso = new Date(Date.parse(todayKst) - KST_MS).toISOString(); // 오늘 00:00 KST
  const since7 = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const excluded = await getKpiExcludedMemberIds(db);
  const ex = excluded.ids;
  const exIn = inList(ex);
  const hasEx = ex.length > 0;

  // 제외 필터 — 회원 기준(members.id·member_id)은 not in, 비회원 행이 있는 표(buy_requests·seller_requests)는 null도 유지.
  // (Supabase 쿼리 빌더 타입이 깊어 제네릭 헬퍼 대신 쿼리마다 조건을 붙임)
  let membersTotalQ = db.from("members").select("id", { count: "exact", head: true });
  let businessQ = db.from("members").select("id", { count: "exact", head: true }).eq("business_verified", true);
  let todaySignupsQ = db.from("members").select("id", { count: "exact", head: true }).gte("created_at", todayStartIso);
  let sentQ = db.from("notification_logs").select("id", { count: "exact", head: true }).gte("sent_at", since7).in("status", ["sent", "clicked"]);
  let clickedQ = db.from("notification_logs").select("id", { count: "exact", head: true }).gte("sent_at", since7).not("clicked_at", "is", null);
  let newMembersQ = db.from("members").select("created_at").gte("created_at", sinceIso).limit(5000);
  let newInterestsQ = db.from("interests").select("created_at").gte("created_at", sinceIso).limit(5000);
  let uncontactedInterestsQ = db.from("interests").select("id", { count: "exact", head: true }).or("contacted.is.null,contacted.eq.false");
  let uncontactedBuyQ = db.from("buy_requests").select("id", { count: "exact", head: true }).or("contacted.is.null,contacted.eq.false");
  let pendingSellersQ = db.from("seller_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (hasEx) {
    membersTotalQ = membersTotalQ.filter("id", "not.in", exIn);
    businessQ = businessQ.filter("id", "not.in", exIn);
    todaySignupsQ = todaySignupsQ.filter("id", "not.in", exIn);
    sentQ = sentQ.filter("member_id", "not.in", exIn);
    clickedQ = clickedQ.filter("member_id", "not.in", exIn);
    newMembersQ = newMembersQ.filter("id", "not.in", exIn);
    newInterestsQ = newInterestsQ.filter("member_id", "not.in", exIn);
    uncontactedInterestsQ = uncontactedInterestsQ.filter("member_id", "not.in", exIn);
    uncontactedBuyQ = uncontactedBuyQ.or(`member_id.is.null,member_id.not.in.${exIn}`);
    pendingSellersQ = pendingSellersQ.or(`seller_member_id.is.null,seller_member_id.not.in.${exIn}`);
  }

  const [
    membersTotal, businessVerified, todaySignups, pushRows, optedOut, sent, clicked,
    newMembers, newDeals, newInterests, newQuick,
    uncontactedInterests, uncontactedQuick, uncontactedBuy, pendingSellers, todayDeals,
  ] = await Promise.all([
    membersTotalQ,
    businessQ,
    todaySignupsQ,
    // 알림 활성: 구독 행의 회원 − 알림 끈 회원(push_opt_out) — 회원 수가 작아 JS에서 합침
    db.from("push_subscriptions").select("member_id").not("member_id", "is", null).limit(20000),
    db.from("members").select("id").eq("push_opt_out", true).limit(20000),
    sentQ,
    clickedQ,
    newMembersQ,
    db.from("deals").select("created_at").not("title", "ilike", TEST_TITLE_PATTERN).gte("created_at", sinceIso).limit(5000),
    newInterestsQ,
    db.from("quick_leads").select("created_at").gte("created_at", sinceIso).limit(5000),
    uncontactedInterestsQ,
    db.from("quick_leads").select("id", { count: "exact", head: true }).or("contacted.is.null,contacted.eq.false"),
    uncontactedBuyQ,
    pendingSellersQ,
    db.from("deals").select("id", { count: "exact", head: true }).not("title", "ilike", TEST_TITLE_PATTERN).gte("created_at", todayStartIso),
  ]);
  const all = [membersTotal, businessVerified, todaySignups, pushRows, optedOut, sent, clicked, newMembers, newDeals, newInterests, newQuick,
    uncontactedInterests, uncontactedQuick, uncontactedBuy, pendingSellers, todayDeals];
  const err = all.find((r) => r.error)?.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const skip = new Set([...ex, ...(optedOut.data ?? []).map((r) => r.id as string)]);
  const withPush = new Set((pushRows.data ?? []).map((r) => r.member_id as string).filter((id) => !skip.has(id))).size;

  const bucket = (rows: { created_at: string }[] | null) => {
    const m: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    for (const r of rows ?? []) {
      const d = kstDate(r.created_at);
      if (d in m) m[d] += 1;
    }
    return days.map((d) => m[d]);
  };

  return NextResponse.json({
    members: { total: membersTotal.count ?? 0, withPush },
    notifications7d: { sent: sent.count ?? 0, clicked: clicked.count ?? 0 },
    daily: {
      days,
      signups: bucket(newMembers.data),
      deals: bucket(newDeals.data),
      leads: bucket([...(newInterests.data ?? []), ...(newQuick.data ?? [])]),
    },
    counts: {
      membersTotal: membersTotal.count ?? 0,
      businessVerified: businessVerified.count ?? 0,
      todaySignups: todaySignups.count ?? 0,
      uncontactedLeads: (uncontactedInterests.count ?? 0) + (uncontactedQuick.count ?? 0),
      uncontactedBuyRequests: uncontactedBuy.count ?? 0,
      pendingSellerRequests: pendingSellers.count ?? 0,
      todayDeals: todayDeals.count ?? 0,
    },
    excluded: { members: ex.length, source: excluded.source },
  });
}
