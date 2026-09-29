// 매물 단가 단위 (seller_requests.price_unit / deals.price_unit, 2026-09-29).
// 수량 단위와 따로 고른다 — 예: 수량은 "박스", 가격은 "kg당" / "일괄(전체 가격)".
// DB check 제약과 같은 값만 허용 — 바꾸면 supabase/schema.sql의 check도 같이 바꿀 것.
// 기존 행(price_unit = null)은 수량 단위 기준 가격으로 해석한다.
export const DEAL_PRICE_UNITS = ["개", "박스", "kg", "톤", "파렛트", "세트", "L", "일괄"] as const;
export type DealPriceUnit = (typeof DEAL_PRICE_UNITS)[number];
export const LUMP_SUM = "일괄" as const; // 전체를 한 가격에 — 최소주문 없음

export function isDealPriceUnit(v: unknown): v is DealPriceUnit {
  return typeof v === "string" && (DEAL_PRICE_UNITS as readonly string[]).includes(v);
}

// 실제로 쓸 단가 단위: price_unit이 있으면 그것, 없으면 수량 단위(없으면 "개")
export function effectivePriceUnit(quantityUnit?: string | null, priceUnit?: string | null): string {
  return priceUnit || quantityUnit || "개";
}

export function isLumpSum(priceUnit?: string | null): boolean {
  return priceUnit === LUMP_SUM;
}

// 입력칸 오른쪽 표시: "원 / kg", 일괄은 "원 (전체)"
export function priceUnitSuffix(unit: string): string {
  return unit === LUMP_SUM ? "원 (전체)" : `원 / ${unit}`;
}
