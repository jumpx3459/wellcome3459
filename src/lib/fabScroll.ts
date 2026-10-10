// "＋ 매물 등록" 버튼(SellFab) 숨김 규칙 (2026-10-10) — 화면·단위 시험(scripts/fab-scroll-test.mts) 공용. 다른 모듈 import 없음.
// 2026-10-10 fix/deals-fab-visibility: 맨 위 고정 px(scrollY 40) 기준을 빼고, 주황 배너의 [무료 등록] 버튼이 화면에 다 보이는지로 판단.
//   우선순위: ① 목록 끝(사업자 정보 푸터)이 보이면 표시 ② [무료 등록]이 화면에 다 보이면 숨김(같은 버튼 둘 방지)
//   ③ 그 밖에는 스크롤 방향 — 아래로 숨김 · 위로 표시. [무료 등록]이 화면에서 벗어나는 순간 방향 기록을 "표시"로 되돌려
//   배너가 반쯤 걸린 구간에서도 등록 버튼이 0개가 되지 않게 함.
export const FAB_SCROLL_DELTA = 4; // 이 값보다 많이 움직였을 때만 방향 판단(손떨림·관성 끝 잔움직임 무시)

export type FabScrollState = { hidden: boolean; lastY: number };

// 스크롤 방향 판단 — 다음 숨김 상태와 기준 위치(움직임이 4px 이하면 그대로, 기준 위치도 그대로 → 작은 움직임이 쌓이면 판단)
export function nextFabScrollState(prev: FabScrollState, y: number): FabScrollState {
  const dy = y - prev.lastY;
  if (Math.abs(dy) <= FAB_SCROLL_DELTA) return prev;
  return { hidden: dy > 0, lastY: y };
}

/** 최종 숨김 — 푸터 보임 > [무료 등록] 다 보임 > 스크롤 방향. bannerVisible은 배너가 없는 화면이면 false */
export function fabHidden(s: { footerVisible: boolean; bannerVisible: boolean; scrollHidden: boolean }): boolean {
  if (s.footerVisible) return false;
  if (s.bannerVisible) return true;
  return s.scrollHidden;
}
