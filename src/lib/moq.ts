// 최소 주문량(MOQ) 표시 한 곳 (2026-10-23) — 회원 상세·관리자 카드가 같이 씀. 다른 모듈 import 없음(단위 시험용).
// 단위 = 그 매물의 quantity_unit(null·빈 값이면 "개"). 포장 단위가 있으면 " · 포장 {package_unit}"을 붙임.

/** 매물 수량 단위 — null·빈 값은 "개" */
export const moqUnit = (unit: string | null | undefined): string => (unit ?? "").trim() || "개";

/** "최소 5박스 이상" / "최소 5박스 이상 · 포장 20kg 박스". MOQ가 없으면(0·null) null */
export function formatMoq(
  moq: number | null | undefined,
  quantityUnit: string | null | undefined,
  packageUnit?: string | null,
): string | null {
  if (!moq || !(moq > 0)) return null;
  const pack = (packageUnit ?? "").trim();
  return `최소 ${moq}${moqUnit(quantityUnit)} 이상${pack ? ` · 포장 ${pack}` : ""}`;
}
