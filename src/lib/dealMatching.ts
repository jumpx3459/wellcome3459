// 매물이 회원의 알림 조건에 맞는지 — 푸시 발송(sendDealPush)과 회원 홈(AlertInboxHome)이
// 같은 규칙을 쓰도록 한 곳에 둔다.
//   카테고리: 회원이 고른 카테고리 중 하나여야 함 (하나도 안 고르면 매칭 없음)
//   지역: 회원이 지역을 하나도 안 골랐으면 "전국" = 모든 지역 통과
// T는 id(number)든 이름(string)이든 상관없음 — 양쪽이 같은 종류로만 비교하면 된다.
export function matchesConditions<T>(
  deal: { category: T | null | undefined; region: T | null | undefined },
  memberCategories: readonly T[],
  memberRegions: readonly T[]
): boolean {
  if (deal.category == null || !memberCategories.includes(deal.category)) return false;
  if (memberRegions.length === 0) return true;
  return deal.region != null && memberRegions.includes(deal.region);
}
