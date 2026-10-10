import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";

// KPI 기록 (2026-09-30, 커밋 K) — kpi_daily(매일 00:05 KST pg_cron 스냅샷) 최근 30일. 읽기 전용.
// 테이블이 아직 없으면(SQL 실행 전) { items: [], missing: true }.
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "dashboard"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ items: [], demo: true });
  const db = createClient(supabaseUrl, serviceKey);

  const { data, error } = await db
    .from("kpi_daily")
    .select(
      "snapshot_date, members_total, push_reachable_members, deals_active, members_new, leads_member_new, leads_guest_new, notifications_sent, notifications_clicked, excluded_members"
    )
    .order("snapshot_date", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ items: [], missing: true });
  return NextResponse.json({ items: data ?? [] });
}
