import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";
import { hasContactOrLink } from "@/lib/titleGuard";
import { isBuyVisible, BUY_VISIBLE_DAYS, type PublicBuyItem } from "@/lib/buyExposure";

// "찾습니다" 공개 행 읽기 (서버 전용, service_role) — 띠 요약과 목록 API가 같이 씀. 노출 판정은 buyExposure.ts 한 곳.
// 연락처·회원 id·희망가·설명은 판정에만 읽고, 반환 타입(PublicBuyItem)에는 안 담는다.
const ROW_LIMIT = 1000;

type Row = {
  id: string;
  product_name: string | null;
  contacted: boolean | null;
  outcome: string | null;
  created_at: string;
  member_id: string | null;
  contact_phone: string | null;
  quantity: string | null;
  categories: { name: string } | null;
  regions: { name: string } | null;
};

export async function loadVisibleBuyRequests(db: SupabaseClient, opts: { id?: string } = {}): Promise<PublicBuyItem[]> {
  const since = new Date(Date.now() - BUY_VISIBLE_DAYS * 24 * 3600e3).toISOString();
  let q = db
    .from("buy_requests")
    .select("id, product_name, contacted, outcome, created_at, member_id, contact_phone, quantity, categories(name), regions(name)")
    .eq("contacted", true)
    .eq("outcome", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT);
  if (opts.id) q = q.eq("id", opts.id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  const memberIds = [...new Set(rows.map((r) => r.member_id).filter((v): v is string => !!v))];
  const [members, admins, excluded] = await Promise.all([
    memberIds.length ? db.from("members").select("id, phone, is_test").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
    db.from("admin_users").select("phone"),
    db.from("kpi_excluded_phones").select("phone"),
  ]);
  const norm = (v: unknown) => normalizePhone(typeof v === "string" ? v : null);
  const adminPhones = new Set((admins.data ?? []).map((a) => norm((a as { phone: string | null }).phone)).filter(Boolean));
  const excludedPhones = new Set((excluded.data ?? []).map((a) => norm((a as { phone: string | null }).phone)).filter(Boolean));
  const testMemberIds = new Set<string>();
  const adminMemberIds = new Set<string>();
  for (const m of (members.data ?? []) as { id: string; phone: string | null; is_test: boolean | null }[]) {
    const p = norm(m.phone);
    if (m.is_test || (p && excludedPhones.has(p))) testMemberIds.add(m.id);
    if (p && adminPhones.has(p)) adminMemberIds.add(m.id);
  }

  const ctx = { now: Date.now(), testMemberIds, excludedPhones, adminMemberIds, adminPhones };
  return rows
    .filter((r) =>
      isBuyVisible({ id: r.id, contacted: r.contacted, outcome: r.outcome, created_at: r.created_at, member_id: r.member_id, phone: norm(r.contact_phone) }, ctx)
    )
    .map((r) => {
      const full = (r.product_name ?? "").replace(/\s+/g, " ").trim();
      return {
        id: r.id,
        // 연락처·링크가 섞인 이름은 숨김(기존 규칙)
        name: !full || hasContactOrLink(full) ? null : full,
        category: r.categories?.name ?? null,
        quantity: r.quantity ?? null,
        region: r.regions?.name ?? null,
        created_at: r.created_at,
      };
    });
}
