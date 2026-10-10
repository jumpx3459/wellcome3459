// "＋ 매물 등록" 버튼(SellFab) 숨김 규칙 — 화면·단위 시험(scripts/fab-scroll-test.mts) 공용. 다른 모듈 import 없음.
// 2026-10-10 대표 확정: 스크롤 방향과 관계없이 항상 표시. 유일한 예외 — 같은 화면 주황 배너의 [무료 등록] 버튼이 화면에 "다 보일 때"만 숨김
//   (같은 버튼 둘 방지). 조금이라도 벗어나면 표시. 예전 규칙(아래로 스크롤 숨김·4px 흔들림 기준·맨 위 scrollY 40·푸터 보이면 표시)은 삭제.

/** [무료 등록]이 이만큼 이상 보이면 "다 보임" — IntersectionObserver 비율은 소수점 오차가 있어 1 대신 0.99 */
export const FAB_BANNER_FULL_RATIO = 0.99;

/** 숨김 여부 — 배너 [무료 등록]이 화면에 보이는 비율(0~1, 배너가 없거나 화면 밖이면 0)만 봄 */
export function fabHidden(bannerButtonRatio: number): boolean {
  return bannerButtonRatio >= FAB_BANNER_FULL_RATIO;
}
