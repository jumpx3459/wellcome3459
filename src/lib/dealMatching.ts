// 매물이 회원의 알림 조건에 맞는지 — 푸시 발송(sendDealPush)과 회원 홈(AlertInboxHome)이 같은 규칙을 쓰도록 한 곳에 둔다.
//   카테고리: 회원이 고른 카테고리 중 하나여야 함 (하나도 안 고르면 매칭 없음)
//   지역: 2026-10-04부터 조건이 아님 — 전국 알림. 회원이 예전에 저장한 member_regions 값은 지우지도, 쓰지도 않는다(DB 변경 없음).
// T는 id(number)든 이름(string)이든 상관없음 — 양쪽이 같은 종류로만 비교하면 된다.
export function matchesCategory<T>(dealCategory: T | null | undefined, memberCategories: readonly T[]): boolean {
  return dealCategory != null && memberCategories.includes(dealCategory);
}

/**
 * 매물 알림 발송 대상(구독 보유 확인 전) — 이 카테고리를 고른 회원(categoryMemberIds) 중
 *   알림을 끈 회원(push_opt_out)·매물 알림 동의(deal_alert_ad 최신 agreed 이고 현재 버전 이상)가 없는 회원을 뺌.
 * 지역은 보지 않음. 푸시 구독 보유는 이 결과로 push_subscriptions를 조회하며 걸러짐(구독 없는 회원은 보낼 기기가 없음).
 */
export function selectDealAlertMembers(args: {
  categoryMemberIds: readonly string[];
  optedOut: ReadonlySet<string>;
  agreed: ReadonlySet<string>;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of args.categoryMemberIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!args.optedOut.has(id) && args.agreed.has(id)) out.push(id);
  }
  return out;
}
