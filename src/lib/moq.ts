// 최소 주문량(MOQ) 표시 한 곳 (2026-10-23) — 회원 상세·관리자 카드가 같이 씀. 다른 모듈 import 없음(단위 시험용).
// 단위 = 그 매물의 quantity_unit(null·빈 값이면 "개"). 포장 단위가 있으면 " · 포장 {package_unit}"을 붙임.

/** 매물 수량 단위 — null·빈 값은 "개" */
export const moqUnit = (unit: string | null | undefined): string => (unit ?? "").trim() || "개";

/** 전량 일괄 — MOQ가 총수량과 같음(둘 다 1 이상). 별도 필드 없이 moq === total_qty 로 판단 */
export const isWholeLot = (moq: number | null | undefined, totalQty: number | null | undefined): boolean =>
  !!moq && !!totalQty && moq > 0 && totalQty > 0 && moq === totalQty;

/** "최소 5박스 이상" / "최소 5박스 이상 · 포장 20kg 박스" / 전량 일괄이면 "전량 일괄 판매 (100박스)". MOQ가 없으면(0·null) null.
 *  totalQty를 넘기지 않으면(null·undefined) 전량 일괄 판정 없이 기존 문구.
 *  opts.omitQty — 수량이 바로 옆에 이미 표시된 곳(관리자 신청 카드)용: 전량 일괄이면 괄호·수량 없이 "전량 일괄 판매" */
export function formatMoq(
  moq: number | null | undefined,
  quantityUnit: string | null | undefined,
  packageUnit?: string | null,
  totalQty?: number | null,
  opts?: { omitQty?: boolean },
): string | null {
  if (!moq || !(moq > 0)) return null;
  const pack = (packageUnit ?? "").trim();
  const tail = pack ? ` · 포장 ${pack}` : "";
  if (isWholeLot(moq, totalQty)) return opts?.omitQty ? `전량 일괄 판매${tail}` : `전량 일괄 판매 (${moq}${moqUnit(quantityUnit)})${tail}`;
  return `최소 ${moq}${moqUnit(quantityUnit)} 이상${tail}`;
}

// ---- 폼의 [전량 일괄] 칩 (2026-11-03) — 입력값은 문자열(MOQ 칸·총수량 칸). 칩 선택 = MOQ 문자열이 총수량과 같음 ----
/** 칩 선택 상태 — 총수량이 1 이상이고 MOQ 칸 값이 총수량과 같음 */
export const wholeLotChipOn = (moqText: string, totalQty: number): boolean => totalQty > 0 && moqText.trim() === String(totalQty);

/** 칩 누름 — 선택 중이면 해제하며 MOQ 비움, 아니면 MOQ = 총수량(총수량이 없으면 그대로) */
export const toggleWholeLotMoq = (moqText: string, totalQty: number): string =>
  wholeLotChipOn(moqText, totalQty) ? "" : totalQty > 0 ? String(totalQty) : moqText;

/** 총수량 변경 — 칩 선택 중이었으면 MOQ를 새 총수량에 맞춤(총수량이 비면 MOQ도 비움), 아니면 그대로 */
export const syncMoqOnTotalChange = (moqText: string, prevTotal: number, nextTotal: number): string =>
  wholeLotChipOn(moqText, prevTotal) ? (nextTotal > 0 ? String(nextTotal) : "") : moqText;
