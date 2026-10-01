import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

type CategoryKpiRow = {
  category_id: number;
  leads: number;
  completed: number;
  no_match: number;
  active_suppliers_7d: number;
  active_demanders_7d: number;
};

// 카테고리별로 "리드가 얼마나 몰리는지 / 성사율이 어떤지 / 최근 7일 내 실제 움직이는
// 공급자·수요자가 몇 명인지"를 보여줍니다. 어느 니치에 GTM 화력을 집중할지 판단하는
// 용도 — 누적 회원수 같은 허수 지표 대신 실제 액티브 신호를 봅니다.
// 2026-09-27: partners-overview에서 발견된 것과 같은 1,000행 응답 한도 버그가
// 여기도 있었음 — interests/quick_leads/buy_requests/seller_requests 전체를
// 무제한 select해서 JS로 집계했는데, 이 중 하나라도 누적 1,000행을 넘으면
// leads/완료율/액티브 지표가 전부 실제보다 적게 잡힘(여긴 "이번 달"이 아니라
// 전체 누적 카운트라 오히려 더 빨리 터질 수 있는 구조였음). schema.sql의
// admin_category_kpis() RPC로 DB에서 카테고리별 group by를 직접 하도록 이동 —
// 결과 행 수가 "카테고리 수"(현재 9개)라 한도 문제가 원천적으로 없음.
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = getAdminClient();

  const [{ data: categories, error: categoriesError }, { data: stats, error: statsError }] = await Promise.all([
    supabaseAdmin.from("categories").select("id, name, sort_order").order("sort_order"),
    supabaseAdmin.rpc("admin_category_kpis") as unknown as Promise<{
      data: CategoryKpiRow[] | null;
      error: { message: string } | null;
    }>,
  ]);
  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 });
  if (statsError) return NextResponse.json({ error: statsError.message }, { status: 500 });

  const statsByCategoryId = new Map((stats ?? []).map((s) => [s.category_id, s]));

  const items = (categories ?? [])
    .map((c) => {
      const s = statsByCategoryId.get(c.id);
      const completed = s?.completed ?? 0;
      const noMatch = s?.no_match ?? 0;
      const resolved = completed + noMatch;
      return {
        name: c.name,
        leads: s?.leads ?? 0,
        completionRate: resolved > 0 ? Math.round((completed / resolved) * 100) : null,
        activeSuppliers: s?.active_suppliers_7d ?? 0,
        activeDemanders: s?.active_demanders_7d ?? 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  return NextResponse.json({ items });
}
