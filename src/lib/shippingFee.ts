// 2026-10-28 배송비 안내 — deals.shipping_fee_type(기본 'separate') · shipping_note(≤60자). 등록·수정 API, 관리자 폼, 상세 화면이 같이 씀.
// 안내는 회원에게만 보임(상세의 가격 보이는 분기). separate는 예전 고정 문구 그대로라 기존 매물 표시는 바뀌지 않음.

export const SHIPPING_FEE_TYPES = ["separate", "included", "negotiable"] as const;
export type ShippingFeeType = (typeof SHIPPING_FEE_TYPES)[number];
export const DEFAULT_SHIPPING_FEE_TYPE: ShippingFeeType = "separate";
export const SHIPPING_NOTE_MAX = 60;

export const SHIPPING_FEE_LABELS: Record<ShippingFeeType, string> = {
  separate: "배송비 별도",
  included: "배송비 포함",
  negotiable: "협의",
};

/** 상세(회원) 안내 문구 — separate는 예전 고정 문구와 같음 */
export const SHIPPING_FEE_NOTICE: Record<ShippingFeeType, string> = {
  separate: "창고 출고가 기준이에요 (배송비 별도).",
  included: "배송비 포함 가격이에요",
  negotiable: "배송비는 협의해요",
};

export const SHIPPING_TYPE_ERROR = "배송비 방식이 올바르지 않아요.";
export const SHIPPING_NOTE_ERROR = `배송 메모는 ${SHIPPING_NOTE_MAX}자 이하로 적어주세요.`;

export const isShippingFeeType = (v: unknown): v is ShippingFeeType =>
  typeof v === "string" && (SHIPPING_FEE_TYPES as readonly string[]).includes(v);

/** 저장된 값을 화면용으로 — 칸이 없거나 이상한 값(SQL 전·예전 행)은 별도 */
export const shippingFeeTypeOf = (v: unknown): ShippingFeeType => (isShippingFeeType(v) ? v : DEFAULT_SHIPPING_FEE_TYPE);

/** 메모 정리 — 앞뒤 공백 제거, 빈 값은 null */
export const cleanShippingNote = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

/** 막는 문제 — 서버(등록·수정)와 폼이 같이 씀. 안 보낸(undefined) 칸은 검사하지 않음 */
export function validateShipping(type: unknown, note: unknown): { error: string; field: "shippingFeeType" | "shippingNote" } | null {
  if (type !== undefined && type !== null && !isShippingFeeType(type)) return { error: SHIPPING_TYPE_ERROR, field: "shippingFeeType" };
  if (note !== undefined && note !== null) {
    if (typeof note !== "string") return { error: SHIPPING_NOTE_ERROR, field: "shippingNote" };
    if (note.trim().length > SHIPPING_NOTE_MAX) return { error: SHIPPING_NOTE_ERROR, field: "shippingNote" };
  }
  return null;
}
