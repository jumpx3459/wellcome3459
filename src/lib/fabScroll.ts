// "＋ 매물 등록" 버튼(SellFab) 스크롤 방향 숨김 규칙 (2026-10-10) — 화면·단위 시험(scripts/fab-scroll-test.mts) 공용. 다른 모듈 import 없음.
export const FAB_SCROLL_DELTA = 4; // 이 값보다 많이 움직였을 때만 방향 판단(손떨림·관성 끝 잔움직임 무시)
export const FAB_SCROLL_MIN_Y = 40; // 맨 위 근처에서는 아래로 내려도 숨기지 않음

// 스크롤 방향 판단 — 다음 숨김 상태와 기준 위치를 돌려줌(움직임이 4px 이하면 그대로, 기준 위치도 그대로 → 작은 움직임이 쌓이면 판단)
export function nextFabScrollState(prev: { hidden: boolean; lastY: number }, y: number): { hidden: boolean; lastY: number } {
  const dy = y - prev.lastY;
  if (y <= FAB_SCROLL_MIN_Y && dy <= 0) return { hidden: false, lastY: y };
  if (Math.abs(dy) <= FAB_SCROLL_DELTA) return prev;
  if (dy > 0) return { hidden: y > FAB_SCROLL_MIN_Y ? true : prev.hidden, lastY: y };
  return { hidden: false, lastY: y };
}
