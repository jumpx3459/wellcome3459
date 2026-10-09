// 공개 하트(❤️ N) 규칙 (2026-10-09 PR 4a) — 화면·단위 시험(scripts/heart-count-test.mts) 공용, 다른 모듈 import 없음.
// 값은 DB 함수 deal_heart_counts(supabase/migrations/20261009_deal_heart_counts.sql)가 셈:
//   집계 시작(아래 상수) 이후 생긴 관심만, 테스트 회원(members.is_test) 제외, 비회원 리드(quick_leads) 포함.
// 시작일은 이 상수 하나로 관리 — DB 함수는 이 값을 인자로 받음(시작일을 바꿔도 SQL 다시 실행 안 해도 됨).
export const HEART_COUNT_START = "2026-10-18T15:00:00Z"; // = 2026-10-19 00:00 KST
// 3 미만은 숨김 — "관심 0~2명"은 오히려 인기 없어 보임(2026-09-26 규칙 그대로). 기준 숫자(보정값) 없음
export const HEART_MIN_SHOW = 3;

/** 화면에 보일 하트 수 — 3 미만·모름(null)이면 null(그리지 않음) */
export function heartToShow(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= HEART_MIN_SHOW ? n : null;
}

/** deal_heart_counts 결과 → { dealId: 수 } (없는 id는 빠짐) */
export function heartMap(rows: { deal_id: string; heart_count: number }[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows ?? []) if (r && typeof r.deal_id === "string") out[r.deal_id] = Number(r.heart_count) || 0;
  return out;
}
