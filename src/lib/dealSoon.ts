// 마감 임박 판정 공용 (2026-10-29 회원 홈 "곧 마감" 묶음) — 관리자 화면(6시간)과 회원 홈(24시간)이 같은 규칙 한 곳을 씀. 다른 모듈 import 없음.
// 진행 중 AND now < 마감 ≤ now + hours시간. [테스트] 매물은 제외(src/lib/categoryAvg.ts isTestTitle과 같은 기준). status가 있으면 active만.

export const DEADLINE_SOON_HOURS = 6;
export const DEADLINE_SOON_MS = DEADLINE_SOON_HOURS * 60 * 60 * 1000;

/** 진행 중인 매물 — 마감임박. hours 생략 = 6시간(관리자 타일 숫자·카드 제목 건수·표시 줄·필터 기준, 2026-10-22). 회원 홈 "곧 마감"은 24를 넘김 */
export const isDeadlineSoon = (
  d: { closes_at: string; title?: string | null; status?: string | null },
  now: number | Date,
  hours: number = DEADLINE_SOON_HOURS
): boolean => {
  if (d.status != null && d.status !== "active") return false;
  if (d.title?.includes("[테스트]")) return false;
  const remain = new Date(d.closes_at).getTime() - (typeof now === "number" ? now : now.getTime());
  return remain > 0 && remain <= hours * 60 * 60 * 1000;
};
