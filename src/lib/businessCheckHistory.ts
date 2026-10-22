// 사업자 조회 "최근 조회 이력" 합치기·자르기 (2026-10-22). 다른 모듈 import 없음 — 브라우저·단위 시험 공용.
// 승인 시 상태 재조회(status_recheck) 행은 부모 진위확인(validate) 카드 안에 한 줄로 들어간다.
//   부모 = ① 같은 deal_id의 validate 행(승인 때 부모에 deal_id를 붙이므로 정상 경로) → ② 없으면 같은 seller_request_id의
//   validate 중 재조회 시각보다 앞선 가장 가까운 행. 둘 다 없으면 단독 한 줄 카드.

export const HISTORY_COMPACT_COUNT = 5;

type Row = {
  id: string;
  kind: string;
  deal_id: string | null;
  seller_request_id: string | null;
  checked_at: string;
};

export type HistoryCard<T extends Row> = { check: T; rechecks: T[] };

/** history = 최근순(checked_at 내림차순) — 카드 순서도 부모(또는 단독 재조회)의 위치 그대로 */
export function groupHistory<T extends Row>(history: T[]): HistoryCard<T>[] {
  const parents = history.filter((c) => c.kind === "validate");
  const attached = new Map<string, T[]>(); // 부모 id → 재조회들
  const standalone = new Set<string>();
  for (const r of history) {
    if (r.kind !== "status_recheck") continue;
    let parent: T | undefined;
    if (r.deal_id) parent = parents.find((p) => p.deal_id === r.deal_id);
    if (!parent && r.seller_request_id) {
      parent = parents
        .filter((p) => p.seller_request_id === r.seller_request_id && p.checked_at <= r.checked_at)
        .sort((a, b) => (a.checked_at < b.checked_at ? 1 : -1))[0];
    }
    if (parent) attached.set(parent.id, [...(attached.get(parent.id) ?? []), r]);
    else standalone.add(r.id);
  }
  const cards: HistoryCard<T>[] = [];
  for (const c of history) {
    if (c.kind === "validate") cards.push({ check: c, rechecks: attached.get(c.id) ?? [] });
    else if (standalone.has(c.id)) cards.push({ check: c, rechecks: [] });
  }
  return cards;
}

/** 접힌 상태엔 앞 5장 — 제목의 N은 항상 total(합친 카드 수) */
export function visibleCards<T>(cards: T[], expanded: boolean): { shown: T[]; total: number; canToggle: boolean } {
  const total = cards.length;
  return {
    shown: expanded ? cards : cards.slice(0, HISTORY_COMPACT_COUNT),
    total,
    canToggle: total > HISTORY_COMPACT_COUNT,
  };
}
