import type { SupabaseClient } from "@supabase/supabase-js";
import { maskBizNo } from "@/lib/nts";
import type { BusinessCheck } from "@/lib/businessCheck";

// 사업자 조회 기록(seller_business_checks) 서버 공용 — 목록·재사용 API가 같이 씀 (2026-10-21: route.ts에서 옮김, reused_from_check_id 추가).
// 응답에는 사업자번호 전체 대신 마스킹만. 서버 전용.
export const COLUMNS =
  "id, seller_request_id, deal_id, kind, b_no, rep_name, open_date, input_company_name, validate_result, status_code, status_text, tax_type, error_kind, reused_from_check_id, checked_at, checked_by_admin_id, exception_ok, exception_reason, exception_by_admin_name, exception_at";

export type Row = Omit<BusinessCheck, "b_no_masked" | "checked_by_name"> & { b_no: string; checked_by_admin_id: string | null };

/** 응답용 — 전체 사업자번호 대신 마스킹, 조회한 관리자 이름 */
export async function toClient(db: SupabaseClient, rows: Row[]): Promise<BusinessCheck[]> {
  const ids = [...new Set(rows.map((r) => r.checked_by_admin_id).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await db.from("admin_users").select("id, name").in("id", ids);
    for (const a of data ?? []) names.set(a.id as string, a.name as string);
  }
  return rows.map(({ b_no, checked_by_admin_id, ...r }) => ({
    ...r,
    b_no_masked: maskBizNo(b_no),
    checked_by_name: checked_by_admin_id ? names.get(checked_by_admin_id) ?? null : null,
  }));
}

// ---- 확인된 판매자 재사용(B안, 2026-10-21) ----
// root 조건(src/lib/businessReuse.ts isRootCheck와 같음): kind='validate' · reused_from_check_id null · 진위 일치 또는 예외 확인
const ROOT_PASS_OR = "validate_result.eq.01,exception_ok.eq.true";

/** 가장 최근 root 1건 — b_no(대리 등록) 또는 판매 신청의 회원(seller_requests.seller_member_id)의 이전 신청 기록에서. 국세청 호출 없음 */
export async function findLatestRoot(
  db: SupabaseClient,
  by: { bNo: string } | { sellerRequestId: string }
): Promise<{ root: Row | null } | { error: string }> {
  let q = db.from("seller_business_checks").select(COLUMNS).eq("kind", "validate").is("reused_from_check_id", null).or(ROOT_PASS_OR);
  if ("bNo" in by) {
    q = q.eq("b_no", by.bNo);
  } else {
    const { data: req, error: reqErr } = await db.from("seller_requests").select("id, seller_member_id").eq("id", by.sellerRequestId).maybeSingle();
    if (reqErr) return { error: "판매 신청을 확인하지 못했어요." };
    if (!req?.seller_member_id) return { root: null }; // 비회원 신청 — 같은 판매자를 알 수 없음
    const { data: others, error: othersErr } = await db
      .from("seller_requests")
      .select("id")
      .eq("seller_member_id", req.seller_member_id as string)
      .neq("id", by.sellerRequestId)
      .limit(200);
    if (othersErr) return { error: "이전 신청을 확인하지 못했어요." };
    const ids = (others ?? []).map((r) => r.id as string);
    if (!ids.length) return { root: null };
    q = q.in("seller_request_id", ids);
  }
  const { data, error } = await q.order("checked_at", { ascending: false }).limit(1);
  if (error) return { error: "조회 기록을 불러오지 못했어요." };
  return { root: ((data ?? [])[0] as Row | undefined) ?? null };
}
