import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-10-04 F-4: 판매자 비공개 정보(deal_seller_private, 매물당 1행·서버 전용) 쓰기 공용.
// source: 판매 신청 승인 매물(seller_requests.linked_deal_id = 매물)이면 seller_request(+신청 id), 아니면 admin_direct.
// 행이 있으면 update(만든 사람·source는 그대로), 없으면 insert — upsert는 created_by·source를 덮어써서 쓰지 않음.

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

export async function saveSellerPrivate(
  db: SupabaseClient,
  dealId: string,
  adminId: string,
  patch: Record<string, unknown>
): Promise<{ ok: true; created: boolean } | { ok: false; message: string }> {
  const { data: existing, error: readError } = await db.from("deal_seller_private").select("deal_id").eq("deal_id", dealId).maybeSingle();
  if (readError) return { ok: false, message: readError.message };
  if (existing) {
    const { error } = await db.from("deal_seller_private").update(patch).eq("deal_id", dealId);
    return error ? { ok: false, message: error.message } : { ok: true, created: false };
  }
  const request = await linkedSellerRequest(db, dealId);
  const { error } = await db.from("deal_seller_private").insert({
    deal_id: dealId,
    source: request ? "seller_request" : "admin_direct",
    seller_request_id: request?.id ?? null,
    created_by_admin_id: adminId,
    ...patch,
  });
  return error ? { ok: false, message: error.message } : { ok: true, created: true };
}
