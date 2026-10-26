import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// "이런 재고 찾습니다" 등록 목록 — 점핑매니저가 확인하고 맞는 판매자를 연결할 리드
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "buyRequests"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("buy_requests")
    .select("*, categories(name), regions(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2026-10-26 공급 제안: 요청마다 "대기 중(pending)인 공급 제안" 건수 — 판매 신청 중 buy_request_id가 이 요청인 것. 조회가 실패해도 목록은 그대로(건수 없음)
  const rows = (data ?? []) as Array<Record<string, unknown> & { id: string }>;
  const supplyPending = new Map<string, number>();
  if (rows.length) {
    const { data: sup } = await supabaseAdmin
      .from("seller_requests")
      .select("buy_request_id")
      .eq("status", "pending")
      .in("buy_request_id", rows.map((r) => r.id));
    for (const s of (sup ?? []) as { buy_request_id: string | null }[]) {
      if (s.buy_request_id) supplyPending.set(s.buy_request_id, (supplyPending.get(s.buy_request_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({ items: rows.map((r) => ({ ...r, supply_pending: supplyPending.get(r.id) ?? 0 })) });
}

// 연락 완료 체크 / 매칭 성사·불발 처리
export async function PATCH(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "buyRequests"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

  const { id, contacted, outcome } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const supabaseAdmin = getAdminClient();
  const update: Record<string, unknown> = {};
  if (contacted !== undefined) update.contacted = contacted;
  if (outcome !== undefined) update.outcome = outcome;

  const { error } = await supabaseAdmin.from("buy_requests").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
