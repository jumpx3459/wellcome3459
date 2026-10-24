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

/** 진행 중인 매물 — 마감임박: 진행 중 AND now < 마감 ≤ now + 6시간. 타일 숫자·카드 제목 건수·표시 줄·필터가 모두 이 함수 (2026-10-22).
 *  [테스트] 매물은 예전부터 타일에서 빠져 있어 그대로 제외(src/lib/categoryAvg.ts isTestTitle과 같은 기준). status가 있으면 active만 */
export const DEADLINE_SOON_MS = 6 * 60 * 60 * 1000;
export const isDeadlineSoon = (d: { closes_at: string; title?: string | null; status?: string | null }, now: number | Date): boolean => {
  if (d.status != null && d.status !== "active") return false;
  if (d.title?.includes("[테스트]")) return false;
  const remain = new Date(d.closes_at).getTime() - (typeof now === "number" ? now : now.getTime());
  return remain > 0 && remain <= DEADLINE_SOON_MS;
};

/** 마감 지남 — 진행 중(active)인데 마감 시각이 지난 매물: closes_at ≤ now. [테스트] 제외. isDeadlineSoon(now < closes_at ≤ now+6h)과 겹치지 않음.
 *  (2026-10-24: 마감이 지나도 status는 자동으로 안 바뀌고 회원 화면은 closes_at 조회 조건으로 가림 → 관리자가 [마감]으로 정리하도록 조치 필요 타일로 보여 줌) */
export const isDeadlinePassed = (d: { closes_at: string; title?: string | null; status?: string | null }, now: number | Date): boolean => {
  if (d.status != null && d.status !== "active") return false;
  if (d.title?.includes("[테스트]")) return false;
  return new Date(d.closes_at).getTime() <= (typeof now === "number" ? now : now.getTime());
};

/** 칩 문구 — 1시간 미만이면 분("마감 45분"), 아니면 시간("마감 5시간", 내림) */
export const deadlineChipLabel = (closesAt: string, now: number | Date): string => {
  const remain = new Date(closesAt).getTime() - (typeof now === "number" ? now : now.getTime());
  const min = Math.max(1, Math.floor(remain / 60000));
  return min < 60 ? `마감 ${min}분` : `마감 ${Math.floor(min / 60)}시간`;
};

export const countNeedsAction = <T,>(items: T[], pred: (item: T) => boolean) => items.filter(pred).length;

// 줄 강조 — 주황 계열만(빨강 금지). 왼쪽 4px 세로선 + 연한 주황 바탕(orange-50), 칩은 orange-100 바탕 / 진한 주황 글자(대비 7:1 이상).
export const NEEDS_ACTION_ROW_STYLE = {
  background: "#FFF7ED",
  borderLeftWidth: 4,
  borderLeftColor: "#F97316",
} as const;
export const NEEDS_ACTION_CHIP_STYLE = { background: "#FFEDD5", color: "#9A3412" } as const;

// 마감 지남 — 마감임박(주황)과 구분되는 회색 계열(빨강 금지). 세로선 4px + 연한 회색 바탕, 칩 글자 #374151 on #E5E7EB(대비 약 7.6:1)
export const NEEDS_ACTION_PASSED_ROW_STYLE = {
  background: "#F3F4F6",
  borderLeftWidth: 4,
  borderLeftColor: "#6B7280",
} as const;
export const NEEDS_ACTION_PASSED_CHIP_STYLE = { background: "#E5E7EB", color: "#374151" } as const;
