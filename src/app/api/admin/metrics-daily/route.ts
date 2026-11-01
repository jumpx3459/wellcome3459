import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { parseRange, kstDate } from "@/lib/metricsCore";

// 제휴 칸 노출·클릭 + 매물 조회 일별 합계 읽기 (2026-10-30 feat/stats-foundation) — 화면은 아직 없음(읽기 전용).
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (한국 날짜, 최대 92일, 없으면 최근 7일) · 권한 dashboard(/api/admin/kpi-daily와 같음).
// 응답: slots = 슬롯·광고별 일별 노출·클릭 / topDeals = 기간 합계 조회수 상위 50(회원·비회원, 매물 제목). 표가 아직 없으면 { missing: true }.
const PAGE = 1000; // PostgREST 응답 한도(1,000행) — 범위 조회를 나눠 끝까지 읽음
const MAX_PAGES = 50;

async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ rows: T[]; error: boolean }> {
  const rows: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await build(p * PAGE, p * PAGE + PAGE - 1);
    if (error) return { rows: [], error: true };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: false };
}

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "dashboard");
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const today = kstDate();
  const range = sp.get("from") || sp.get("to") ? parseRange(sp.get("from"), sp.get("to")) : parseRange(kstDate(Date.now() - 6 * 86400e3), today);
  if (!range) return NextResponse.json({ error: "기간을 확인해주세요 (YYYY-MM-DD, 최대 92일)." }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ range, slots: [], topDeals: [], demo: true });
  const db: SupabaseClient = createClient(supabaseUrl, serviceKey);

  const ads = await readAll<{ stat_date: string; slot: string; ad_id: string; impressions: number; clicks: number }>((a, b) =>
    db.from("ad_daily_stats").select("stat_date, slot, ad_id, impressions, clicks").gte("stat_date", range.from).lte("stat_date", range.to).order("stat_date").order("slot").order("ad_id").range(a, b)
  );
  const views = await readAll<{ deal_id: string; member_views: number; guest_views: number }>((a, b) =>
    db.from("deal_view_daily").select("deal_id, member_views, guest_views").gte("stat_date", range.from).lte("stat_date", range.to).order("stat_date").order("deal_id").range(a, b)
  );
  if (ads.error || views.error) return NextResponse.json({ range, slots: [], topDeals: [], missing: true });

  const sums = new Map<string, { dealId: string; memberViews: number; guestViews: number }>();
  for (const r of views.rows) {
    const s = sums.get(r.deal_id) ?? { dealId: r.deal_id, memberViews: 0, guestViews: 0 };
    s.memberViews += r.member_views ?? 0;
    s.guestViews += r.guest_views ?? 0;
    sums.set(r.deal_id, s);
  }
  const top = [...sums.values()]
    .sort((x, y) => y.memberViews + y.guestViews - (x.memberViews + x.guestViews) || x.dealId.localeCompare(y.dealId))
    .slice(0, 50);
  let titles = new Map<string, string>();
  if (top.length) {
    const { data } = await db.from("deals").select("id, title").in("id", top.map((t) => t.dealId));
    titles = new Map((data ?? []).map((d) => [d.id as string, (d.title as string) ?? ""]));
  }

  return NextResponse.json({
    range,
    slots: ads.rows.map((r) => ({ date: r.stat_date, slot: r.slot, partnerId: r.ad_id, impressions: r.impressions, clicks: r.clicks })),
    topDeals: top.map((t) => ({ ...t, totalViews: t.memberViews + t.guestViews, title: titles.get(t.dealId) ?? null })),
  });
}
