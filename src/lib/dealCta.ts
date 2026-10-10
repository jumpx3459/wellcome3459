// 매물 상세 하단 주 버튼 상태 (2026-10-09 PR 4a) — 화면(deals/[id])·서버(/api/connections check)·단위 시험(scripts/deal-cta-test.mts) 공용.
// 다른 모듈 import 없음.
//   ① "request"   — "판매자 연결 요청"(주황): 연결 없음, 또는 끝난 연결이 불발(failed)·취소(cancelled) → 다시 요청 가능
//   ② "requested" — "✓ 연결 요청함": 본인 연결이 requested~contact_sent(진행 중), 또는 closed + 성사(success)
//   ③ "closed"    — "마감된 매물이에요": 매물 마감(상태 closed 또는 마감 시각 지남) — ②보다 먼저
export type ConnectionLite = { status: string; result: string | null };
export type CtaState = "request" | "requested" | "closed";

/** 본인 연결 기록 중 "요청함"으로 볼 것이 있는지 — 진행 중(closed 아님) 또는 성사로 끝남 */
export function connectionRequested(rows: readonly ConnectionLite[] | null | undefined): boolean {
  return (rows ?? []).some((r) => r.status !== "closed" || r.result === "success");
}

export function ctaState(dealClosed: boolean, requested: boolean): CtaState {
  if (dealClosed) return "closed";
  return requested ? "requested" : "request";
}

/** 매물 마감 여부 — 상태 closed 또는 마감 시각이 지남 */
export function isDealClosed(status: string | null | undefined, closesAt: string | null | undefined, now = Date.now()): boolean {
  return status === "closed" || (!!closesAt && new Date(closesAt).getTime() <= now);
}
