import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVisibleBuyRequests } from "@/lib/buyPublic";
import { supplyRefId } from "@/lib/supplyProposal";

// 공급 제안 서버 쪽 조회 (service_role) — /api/seller-requests(저장·푸시)와 /api/admin/seller-requests(노출 종료 표시)가 같이 씀.
// 어떤 조회 실패도 던지지 않는다(저장은 계속, 연결·이름만 null).

/**
 * buyRef → 연결할 buy_requests.id. uuid 형식이고 buy_requests에 행이 있으면 노출 여부와 무관하게 연결, 아니면(형식 불량·없음·조회 실패) null.
 * publicName = 지금 공개 노출 중이면 공개 칸 name(연락처·링크 섞인 이름은 null), 그 외 null — 푸시 본문용.
 */
export async function resolveSupplyLink(db: SupabaseClient, raw: unknown): Promise<{ buyRequestId: string | null; publicName: string | null }> {
  const id = supplyRefId(raw);
  if (!id) return { buyRequestId: null, publicName: null };
  let exists = false;
  try {
    const { data, error } = await db.from("buy_requests").select("id").eq("id", id).maybeSingle();
    exists = !error && !!data;
  } catch (e) {
    console.error("[supply] buy_requests 조회 실패", e instanceof Error ? e.message : e);
  }
  if (!exists) return { buyRequestId: null, publicName: null };
  let publicName: string | null = null;
  try {
    const rows = await loadVisibleBuyRequests(db, { id });
    publicName = rows[0]?.name ?? null;
  } catch (e) {
    console.error("[supply] 공개 판정 실패", e instanceof Error ? e.message : e);
  }
  return { buyRequestId: id, publicName };
}

/** 주어진 요청 id 중 지금 공개 노출 중인 것(isBuyVisible 판정 재사용) — 관리자 "(노출 종료)" 표시용. 조회 실패한 id는 노출 중으로 본다(표시를 안 붙임) */
export async function visibleBuyRequestIds(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      try {
        const rows = await loadVisibleBuyRequests(db, { id });
        if (rows.some((r) => r.id === id)) out.add(id);
      } catch {
        out.add(id);
      }
    })
  );
  return out;
}
