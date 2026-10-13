// /deals 첫 화면 정리 (2026-10-13) — 진행 중 매물이 적으면 카테고리·지역 고르기 줄과 "N건 · 정렬" 줄을 숨긴다.
// activeCount = 카테고리·지역 거르기 전 진행 중 매물 수(page.tsx notExpired.length). 불러오는 중(0)이면 compact.
// 다른 모듈 import 없음(단위 시험용).
export const DEALS_FILTER_MIN = 15;

export function isDealsCompact(activeCount: number): boolean {
  return activeCount < DEALS_FILTER_MIN;
}
