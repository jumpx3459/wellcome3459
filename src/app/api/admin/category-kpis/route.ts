import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// 카테고리별로 "리드가 얼마나 몰리는지 / 성사율이 어떤지 / 최근 7일 내 실제 움직이는
// 공급자·수요자가 몇 명인지"를 보여줍니다. 어느 니치에 GTM 화력을 집중할지 판단하는
// 용도 — 누적 회원수 같은 허수 지표 대신 실제 액티브 신호를 봅니다.
export async function GET(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = getAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: categories },
    { data: interestRows },
    { data: quickRows },
    { data: buyRows },
    { data: sellerRows },
  ] = await Promise.all([
    supabaseAdmin.from("categories").select("id, name, sort_order").order("sort_order"),
    supabaseAdmin.from("interests").select("member_id, outcome, created_at, deals(category_id)"),
    supabaseAdmin.from("quick_leads").select("phone, outcome, created_at, deals(category_id)"),
    supabaseAdmin.from("buy_requests").select("contact_phone, category_id, outcome, created_at"),
    supabaseAdmin.from("seller_requests").select("contact_phone, category_id, created_at"),
  ]);

  type Bucket = {
    leads: number;
    completed: number;
    noMatch: number;
    suppliers: Set<string>;
    demanders: Set<string>;
  };
  const buckets = new Map<number, Bucket>();
  const bucketFor = (categoryId: number | null | undefined) => {
    if (categoryId == null) return null;
    if (!buckets.has(categoryId)) {
      buckets.set(categoryId, { leads: 0, completed: 0, noMatch: 0, suppliers: new Set(), demanders: new Set() });
    }
    return buckets.get(categoryId)!;
  };

  for (const row of interestRows ?? []) {
    const catId = (row.deals as unknown as { category_id: number | null } | null)?.category_id;
    const b = bucketFor(catId);
    if (!b) continue;
    b.leads++;
    if (row.outcome === "completed") b.completed++;
    if (row.outcome === "no_deal") b.noMatch++;
    if (row.created_at >= sevenDaysAgo && row.member_id) b.demanders.add(row.member_id);
  }
  for (const row of quickRows ?? []) {
    const catId = (row.deals as unknown as { category_id: number | null } | null)?.category_id;
    const b = bucketFor(catId);
    if (!b) continue;
    b.leads++;
    if (row.outcome === "completed") b.completed++;
    if (row.outcome === "no_deal") b.noMatch++;
    if (row.created_at >= sevenDaysAgo && row.phone) b.demanders.add(`q:${row.phone}`);
  }
  for (const row of buyRows ?? []) {
    const b = bucketFor(row.category_id);
    if (!b) continue;
    b.leads++;
    if (row.outcome === "matched") b.completed++;
    if (row.outcome === "no_match") b.noMatch++;
    if (row.created_at >= sevenDaysAgo && row.contact_phone) b.demanders.add(`b:${row.contact_phone}`);
  }
  for (const row of sellerRows ?? []) {
    const b = bucketFor(row.category_id);
    if (!b) continue;
    if (row.created_at >= sevenDaysAgo && row.contact_phone) b.suppliers.add(row.contact_phone);
  }

  const items = (categories ?? [])
    .map((c) => {
      const b = buckets.get(c.id);
      const resolved = (b?.completed ?? 0) + (b?.noMatch ?? 0);
      return {
        name: c.name,
        leads: b?.leads ?? 0,
        completionRate: resolved > 0 ? Math.round(((b?.completed ?? 0) / resolved) * 100) : null,
        activeSuppliers: b?.suppliers.size ?? 0,
        activeDemanders: b?.demanders.size ?? 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  return NextResponse.json({ items });
}
