import { LUMP_SUM_UNIT, SELL_PRICE_UNITS, checkPriceUnitValue } from "@/lib/units";

// 매물 단가 단위 (seller_requests.price_unit / deals.price_unit, 2026-09-29).
// 수량 단위와 따로 고른다 — 예: 수량은 "박스", 가격은 "kg당" / "일괄(전체 가격)".
// 2026-11-02: 목록 + "기타(직접 입력)" — 목록 정의·직접 입력 규칙은 src/lib/units.ts 한 곳. DB는 1~6자 제약(*_price_unit_len)만.
// 기존 행(price_unit = null)은 수량 단위 기준 가격으로 해석한다.
export const DEAL_PRICE_UNITS = SELL_PRICE_UNITS;
export const LUMP_SUM = LUMP_SUM_UNIT; // 전체를 한 가격에 — 최소주문 없음
export type DealPriceUnit = string; // 목록 값 또는 직접 입력한 글자(units.ts)

/** 목록 값이거나 올바른 직접 입력이면 true (서버·폼 공통 검사는 checkPriceUnitValue) */
export function isDealPriceUnit(v: unknown): v is string {
  return checkPriceUnitValue(v).ok;
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
