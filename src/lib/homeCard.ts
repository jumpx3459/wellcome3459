// 회원 홈 매물 카드 D안(2026-10-09 4b-2) 글자 규칙 — 화면(HomeDealCard)·단위 시험(scripts/home-card-test.mts) 공용. 다른 모듈 import 없음.

// 남은 시간이 24시간 미만이면 타이머를 빨강(#dc2626) — 마감 지난 매물("마감")도 빨강
export const TIMER_RED_MS = 24 * 60 * 60 * 1000;
export function isTimerRed(closesAt: string, now = Date.now()): boolean {
  const diff = new Date(closesAt).getTime() - now;
  return Number.isFinite(diff) && diff < TIMER_RED_MS;
}

// "지역 · 수량" 한 줄 — 카테고리·"잔여" 없음, 수량 천 단위 쉼표. location은 formatDealLocation 결과("경기", "경기 · 남양주")
//   ("경기", 7200, "개") → "경기 · 7,200개" / ("경기 · 남양주", 1, "개") → "경기 · 남양주 · 1개"
//   수량이 없으면 지역만, 지역이 없으면 수량만, 단위가 없으면 "개"
export function regionQtyText(location: string | null | undefined, qty: number | null | undefined, unit: string | null | undefined): string {
  const loc = (location ?? "").trim();
  const q = qty == null || !Number.isFinite(Number(qty)) ? "" : `${Number(qty).toLocaleString("ko-KR")}${(unit ?? "").trim() || "개"}`;
  return [loc, q].filter(Boolean).join(" · ");
}
