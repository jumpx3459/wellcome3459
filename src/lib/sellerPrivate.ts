import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";

// 2026-10-04 F-4: 판매자 비공개 정보(deal_seller_private, 매물당 1행·서버 전용) 쓰기 공용.
// source: 판매 신청 승인 매물(seller_requests.linked_deal_id = 매물)이면 seller_request(+신청 id), 아니면 admin_direct.
// 행이 있으면 update(만든 사람·source는 그대로), 없으면 insert — upsert는 created_by·source를 덮어써서 쓰지 않음.
// 2026-10-04 feat/deal-seller-private: 입력 검증(연결 보드·매물 등록·매물 수정 공용)·사업자 조회 행 연결(linkDirectCheck) 추가.

export type SellerRequestInfo = { id: string; company_name: string | null; contact_name: string | null; contact_phone: string | null };

export async function linkedSellerRequest(db: SupabaseClient, dealId: string): Promise<SellerRequestInfo | null> {
  const { data } = await db
    .from("seller_requests")
    .select("id, company_name, contact_name, contact_phone")
    .eq("linked_deal_id", dealId)
    .limit(1)
    .maybeSingle();
  return (data as SellerRequestInfo | null) ?? null;
}

/** 감사 로그 detail.via — 어느 화면·API에서 저장했는지 */
export type SellerPrivateVia = "deal_create" | "deal_edit" | "seller_request_approve" | "connection_board";

export const SELLER_PRIVATE_MAX = { companyName: 100, contactName: 50, memo: 200 } as const;
export const SELLER_PHONE_RE = /^[0-9]{8,11}$/;

export type SellerPrivateValue = {
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  memo?: string | null;
};
export type SellerPrivateField = "companyName" | "contactName" | "contactPhone" | "memo";
export type SellerPrivateParse = { ok: true; value: SellerPrivateValue } | { ok: false; error: string; field: SellerPrivateField };

/** 판매자 비공개 입력 검증 — 연결 보드 PUT·매물 등록·매물 수정이 같은 규칙. 연락처는 normalizePhone 뒤 숫자 8~11자리 */
export function parseSellerPrivateFields(
  raw: { companyName?: unknown; contactName?: unknown; contactPhone?: unknown; memo?: unknown } | null | undefined,
  opts: { requireCompany: boolean; requirePhone: boolean; withMemo: boolean }
): SellerPrivateParse {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const companyName = text(raw?.companyName);
  const contactName = text(raw?.contactName);
  const memo = opts.withMemo ? text(raw?.memo) : "";
  const lens: [SellerPrivateField, string, number][] = [
    ["companyName", companyName, SELLER_PRIVATE_MAX.companyName],
    ["contactName", contactName, SELLER_PRIVATE_MAX.contactName],
    ["memo", memo, SELLER_PRIVATE_MAX.memo],
  ];
  for (const [field, v, max] of lens) {
    if (v.length > max) return { ok: false, error: `${max}자까지 적을 수 있어요.`, field };
  }
  if (opts.requireCompany && !companyName) return { ok: false, error: "실제 판매자 상호를 입력해주세요.", field: "companyName" };
  const phone = normalizePhone(typeof raw?.contactPhone === "string" ? raw.contactPhone : "");
  if (opts.requirePhone && !phone) return { ok: false, error: "실제 판매자 연락처를 입력해주세요.", field: "contactPhone" };
  if (phone && !SELLER_PHONE_RE.test(phone)) return { ok: false, error: "연락처는 숫자 8~11자리로 적어주세요.", field: "contactPhone" };
  const value: SellerPrivateValue = { company_name: companyName || null, contact_name: contactName || null, contact_phone: phone || null };
  if (opts.withMemo) value.memo = memo || null;
  return { ok: true, value };
}

/** 판매 신청 정보 → 비공개 정보 값(승인 시 저장용) — 연락처가 형식에 안 맞으면 null(저장을 막지 않음) */
export function sellerValueFromRequest(r: { company_name: string | null; contact_name: string | null; contact_phone: string | null }): SellerPrivateValue {
  const phone = normalizePhone(r.contact_phone);
  return {
    company_name: r.company_name?.trim() ? r.company_name.trim().slice(0, SELLER_PRIVATE_MAX.companyName) : null,
    contact_name: r.contact_name?.trim() ? r.contact_name.trim().slice(0, SELLER_PRIVATE_MAX.contactName) : null,
    contact_phone: SELLER_PHONE_RE.test(phone) ? phone : null,
  };
}

export async function saveSellerPrivate(
  db: SupabaseClient,
  dealId: string,
  adminId: string,
  patch: Record<string, unknown>,
  // 승인 처리 중처럼 seller_requests.linked_deal_id가 아직 비어 있을 때 신청 id를 직접 알려줌
  opts?: { sellerRequestId?: string }
): Promise<{ ok: true; created: boolean } | { ok: false; message: string }> {
  const { data: existing, error: readError } = await db.from("deal_seller_private").select("deal_id").eq("deal_id", dealId).maybeSingle();
  if (readError) return { ok: false, message: readError.message };
  if (existing) {
    const { error } = await db.from("deal_seller_private").update(patch).eq("deal_id", dealId);
    return error ? { ok: false, message: error.message } : { ok: true, created: false };
  }
  const requestId = opts?.sellerRequestId ?? (await linkedSellerRequest(db, dealId))?.id ?? null;
  const { error } = await db.from("deal_seller_private").insert({
    deal_id: dealId,
    source: requestId ? "seller_request" : "admin_direct",
    seller_request_id: requestId,
    created_by_admin_id: adminId,
    ...patch,
  });
  return error ? { ok: false, message: error.message } : { ok: true, created: true };
}

// ---- 직접 등록용 사업자 조회 행(seller_business_checks) 연결 ----
// 대상 = 신청 없이(seller_request_id null) 조회했고 아직 매물에 안 붙은(deal_id null) validate 행이면서 통과(진위 일치 '01' 또는 예외 확인).
// 통과 기준은 src/lib/businessCheck.ts isPassingCheck와 같다.
export const PASSING_OR = "validate_result.eq.01,exception_ok.eq.true";

/** 연결 가능한 조회 행인지 읽어 확인 — 등록 전에 불러 NOT_CHECKED_MESSAGE를 돌려주는 용도 */
export async function findLinkableCheck(db: SupabaseClient, checkId: string): Promise<{ id: string; b_no: string } | null | "error"> {
  const { data, error } = await db
    .from("seller_business_checks")
    .select("id, b_no")
    .eq("id", checkId)
    .is("seller_request_id", null)
    .is("deal_id", null)
    .eq("kind", "validate")
    .or(PASSING_OR)
    .maybeSingle();
  if (error) return "error";
  return (data as { id: string; b_no: string } | null) ?? null;
}

/** 조건부 update — 같은 조건을 다시 걸어 두 매물이 한 조회를 붙잡거나 그 사이 바뀐 행이 붙는 일을 막음. 1행 붙었을 때만 ok */
export async function linkDirectCheck(db: SupabaseClient, checkId: string, dealId: string): Promise<"ok" | "not_eligible" | "error"> {
  const { data, error } = await db
    .from("seller_business_checks")
    .update({ deal_id: dealId })
    .eq("id", checkId)
    .is("seller_request_id", null)
    .is("deal_id", null)
    .eq("kind", "validate")
    .or(PASSING_OR)
    .select("id");
  if (error) return "error";
  return data?.length === 1 ? "ok" : "not_eligible";
}
