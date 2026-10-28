import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminIdentity } from "@/lib/adminAuth";
import { canReuseRoot, isRootCheck } from "@/lib/businessReuse";
import { maskBizNo } from "@/lib/nts";

// 2026-10-28 7a 최근 확인된 판매자 칩 — 서버 공용(목록 GET·값 GET). 서버 전용(service role).
//   후보 = 최근 1년 안에 등록된 매물(deal_seller_private.created_at)에 붙은 사업자 조회 기록(seller_business_checks.deal_id, kind='validate')을 b_no 기준으로 묶은 것.
//   재사용 행은 원본(root)으로 환원 — 칩의 id는 항상 root id(= POST /business-checks/reuse 의 sourceCheckId). root가 진위 일치·예외 확인이 아니면 후보에서 뺌.
//   점핑매니저: 본인이 조회한 기록(checked_by_admin_id = 본인)만, 예외 확인 root는 제외(재사용 권한 없음).
//   응답·로그에 원문 사업자번호·대표자명(rep_name)은 넣지 않음 — 이 파일은 rep_name을 아예 select하지 않음.

export const RECENT_SELLER_DAYS = 365;
export const RECENT_SELLER_CHIPS = 5;

export type RecentSeller = {
  rootCheckId: string;
  bNo: string; // 서버 안에서만(응답엔 마스킹) — 값 조회가 같은 판매자의 매물을 찾을 때 씀
  rootCompany: string | null; // 조회 때 입력한 상호(input_company_name) — 비담당 매니저에게 줄 수 있는 유일한 상호
  rootException: boolean;
  dealId: string; // 가장 최근 매물
  dealAt: string;
  dealCompany: string | null; // deal_seller_private.company_name (담당이면 칩·값에 씀)
};

type PrivRow = { deal_id: string; company_name: string | null; created_at: string };
type CheckRow = {
  id: string;
  b_no: string;
  deal_id: string | null;
  reused_from_check_id: string | null;
  checked_by_admin_id: string | null;
};
type RootRow = {
  id: string;
  b_no: string;
  kind: string | null;
  reused_from_check_id: string | null;
  validate_result: string | null;
  exception_ok: boolean | null;
  input_company_name: string | null;
};

/** 최근 1년 판매자 후보 — 최근 매물 순. 조회 실패는 { error } */
export async function loadRecentSellers(db: SupabaseClient, admin: AdminIdentity, now = Date.now()): Promise<{ items: RecentSeller[] } | { error: string }> {
  const since = new Date(now - RECENT_SELLER_DAYS * 24 * 3600e3).toISOString();
  const { data: privs, error: pErr } = await db
    .from("deal_seller_private")
    .select("deal_id, company_name, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (pErr) return { error: "최근 판매자를 불러오지 못했어요." };
  const privList = (privs ?? []) as PrivRow[];
  if (!privList.length) return { items: [] };

  const dealIds = privList.map((r) => r.deal_id);
  const { data: checks, error: cErr } = await db
    .from("seller_business_checks")
    .select("id, b_no, deal_id, reused_from_check_id, checked_by_admin_id")
    .eq("kind", "validate")
    .in("deal_id", dealIds);
  if (cErr) return { error: "최근 판매자를 불러오지 못했어요." };
  const checkByDeal = new Map<string, CheckRow>();
  for (const c of (checks ?? []) as CheckRow[]) if (c.deal_id && !checkByDeal.has(c.deal_id)) checkByDeal.set(c.deal_id, c);

  // b_no마다 가장 최근 매물 1건(점핑매니저는 본인이 조회한 기록이 붙은 매물만)
  const picked = new Map<string, { priv: PrivRow; check: CheckRow }>();
  for (const priv of privList) {
    const check = checkByDeal.get(priv.deal_id);
    if (!check) continue;
    if (admin.role === "점핑매니저" && check.checked_by_admin_id !== admin.id) continue;
    if (!picked.has(check.b_no)) picked.set(check.b_no, { priv, check });
  }
  if (!picked.size) return { items: [] };

  const rootIds = [...new Set([...picked.values()].map(({ check }) => check.reused_from_check_id || check.id))];
  const { data: roots, error: rErr } = await db
    .from("seller_business_checks")
    .select("id, b_no, kind, reused_from_check_id, validate_result, exception_ok, input_company_name")
    .in("id", rootIds);
  if (rErr) return { error: "최근 판매자를 불러오지 못했어요." };
  const rootById = new Map<string, RootRow>(((roots ?? []) as RootRow[]).map((r) => [r.id, r]));

  const items: RecentSeller[] = [];
  for (const [bNo, { priv, check }] of picked) {
    const root = rootById.get(check.reused_from_check_id || check.id);
    if (!root || !isRootCheck(root)) continue; // 진위 일치·예외 확인 root만
    const exception = root.exception_ok === true;
    if (!canReuseRoot(admin.role, exception)) continue; // 예외 확인 root는 최고관리자·관리자만
    items.push({
      rootCheckId: root.id,
      bNo,
      rootCompany: root.input_company_name,
      rootException: exception,
      dealId: priv.deal_id,
      dealAt: priv.created_at,
      dealCompany: priv.company_name,
    });
  }
  items.sort((a, b) => Date.parse(b.dealAt) - Date.parse(a.dealAt));
  return { items };
}

/** 칩 응답용 — 마스킹 번호만 */
export const chipBNoMasked = (bNo: string) => maskBizNo(bNo);
