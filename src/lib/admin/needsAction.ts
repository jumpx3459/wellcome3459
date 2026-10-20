// 2026-10-20: 관리자 대시보드 "조치 필요" 판정 한 곳 — 위쪽 "조치 필요" 숫자 · 카드 제목 숫자 · 목록에 표시되는 줄 수 ·
// 줄 강조(주황 선 + 칩)가 모두 이 함수로 계산돼서 서로 어긋나지 않음. 다른 모듈 import 없음.

/** 관심·연결(회원 관심 + 원클릭 리드): 연락 안 함 AND 결과 진행중 */
export const leadNeedsAction = (i: { contacted: boolean; outcome: string }) => !i.contacted && i.outcome === "pending";

/** 이런 재고 찾습니다(구매 요청): 구매자 연락 전 */
export const buyRequestNeedsAction = (b: { contacted: boolean }) => !b.contacted;

/** 판매자 신청: 대기. API가 대기(pending)만 주므로 status가 없으면 대기로 봄 */
export const sellerRequestNeedsAction = (r: object) => ((r as { status?: string | null }).status ?? "pending") === "pending";

/** 파트너 신청: 심사중 */
export const partnerRequestNeedsAction = (r: { status: string }) => r.status === "pending";

export const countNeedsAction = <T,>(items: T[], pred: (item: T) => boolean) => items.filter(pred).length;

// 줄 강조 — 주황 계열만(빨강 금지). 왼쪽 4px 세로선 + 연한 주황 바탕(orange-50), 칩은 orange-100 바탕 / 진한 주황 글자(대비 7:1 이상).
export const NEEDS_ACTION_ROW_STYLE = {
  background: "#FFF7ED",
  borderLeftWidth: 4,
  borderLeftColor: "#F97316",
} as const;
export const NEEDS_ACTION_CHIP_STYLE = { background: "#FFEDD5", color: "#9A3412" } as const;
