// 2026-10-04 F-4 거래 연결 보드 — 단계·방법·결과 값과 규칙 (화면·서버 공용, 다른 모듈 import 없음).
// 2026-10-11: 연락 방법은 선택(값이 있을 때만 검사) — deal_connection_events.method not null 해제(운영 SQL 실행 완료)
// deal_connections.status 허용값(F-2 SQL)과 같은 순서. 앞으로만 이동(건너뛰기 허용), ⑥ 결과(closed)는 어느 단계에서나.

export const CONNECTION_STEPS = ["requested", "accepted", "seller_confirmed", "buyer_confirmed", "contact_sent", "closed"] as const;
export type ConnectionStatus = (typeof CONNECTION_STEPS)[number];

export const STEP_LABEL: Record<ConnectionStatus, string> = {
  requested: "① 연결 요청",
  accepted: "② 접수",
  seller_confirmed: "③ 판매자 확인",
  buyer_confirmed: "④ 상호 안내·구매자 확인",
  contact_sent: "⑤ 연락처 전달",
  closed: "⑥ 결과",
};

/** 단계 시각 칸 — 단계 전환 API가 now()로 채움 */
export const STEP_AT_COLUMN: Record<Exclude<ConnectionStatus, "requested">, string> = {
  accepted: "accepted_at",
  seller_confirmed: "seller_confirmed_at",
  buyer_confirmed: "buyer_confirmed_at",
  contact_sent: "contact_sent_at",
  closed: "closed_at",
};

export const CONNECTION_METHODS = ["phone", "sms", "kakao"] as const;
export type ConnectionMethod = (typeof CONNECTION_METHODS)[number];
export const METHOD_LABEL: Record<ConnectionMethod, string> = { phone: "전화", sms: "문자", kakao: "카톡" };

export const CONNECTION_RESULTS = ["success", "failed", "cancelled"] as const;
export type ConnectionResult = (typeof CONNECTION_RESULTS)[number];
export const RESULT_LABEL: Record<ConnectionResult, string> = { success: "성사", failed: "불발", cancelled: "취소" };

/** 리드(interests·quick_leads) outcome — 리드 카드 PATCH와 같은 값. 취소는 리드 outcome을 바꾸지 않음(성사율에 섞이지 않게) */
export const RESULT_TO_LEAD_OUTCOME: Record<Exclude<ConnectionResult, "cancelled">, "completed" | "no_deal"> = {
  success: "completed",
  failed: "no_deal",
};

export const STUCK_MS = 24 * 60 * 60 * 1000;
/** ④ 결과 확인: 연락처 전달 뒤 이 시간이 지나야 성사·불발을 물음(그 전엔 판매자가 구매자에게 연락하는 중) */
export const RESULT_WAIT_MS = 3 * 24 * 60 * 60 * 1000;
export const MEMO_MAX = 200;
export const MEMO_PLACEHOLDER = "번호·주소 등 개인정보는 적지 마세요";

export const stepIndex = (s: ConnectionStatus) => CONNECTION_STEPS.indexOf(s);
export const isConnectionStatus = (v: unknown): v is ConnectionStatus => CONNECTION_STEPS.includes(v as ConnectionStatus);

/** 지금 단계에서 갈 수 있는지 — 앞으로만(건너뛰기 허용), 종료된 연결은 더 못 감 */
export function canMoveTo(current: ConnectionStatus, next: ConnectionStatus): boolean {
  return current !== "closed" && next !== "requested" && stepIndex(next) > stepIndex(current);
}

/** 멈춘 연결: 진행 중인데 마지막 변경이 24시간 넘게 전. 2026-10-11: ⑤ 연락처 전달 뒤는 멈춤으로 세지 않음
 *  (3일 전 = 판매자가 연락하는 중, 3일 후 = "결과 확인" 차례 — isResultDue) */
export function isStuck(status: ConnectionStatus, updatedAt: string, now = Date.now()): boolean {
  return status !== "closed" && status !== "contact_sent" && now - Date.parse(updatedAt) > STUCK_MS;
}

// ---------------- 2026-10-11 PR ② 연결 보드 4단계(feat/connection-board-simple) ----------------
// 카드는 4칸 진행 막대 + "다음 할 일" 한 문장 + 답 버튼. 답 버튼 하나 = 기존 단계 전환(/step) 한 번.
//   ① 판매자 확인(requested·accepted) → ② 구매자 확인(seller_confirmed) → ③ 연락처 전달(buyer_confirmed) → ④ 결과 확인(contact_sent)

export const BOARD_STEPS = ["판매자 확인", "구매자 확인", "연락처 전달", "결과 확인"] as const;

/** 진행 막대의 지금 칸(0~3). 종료(closed)는 4 = 전부 끝남 */
export function boardStep(status: ConnectionStatus): 0 | 1 | 2 | 3 | 4 {
  switch (status) {
    case "requested":
    case "accepted":
      return 0;
    case "seller_confirmed":
      return 1;
    case "buyer_confirmed":
      return 2;
    case "contact_sent":
      return 3;
    default:
      return 4;
  }
}

/** ④ 결과를 물을 때가 됐는지 — 연락처 전달 시각 + 3일(정각 포함) */
export function isResultDue(status: ConnectionStatus, contactSentAt: string | null, now = Date.now()): boolean {
  if (status !== "contact_sent" || !contactSentAt) return false;
  const t = Date.parse(contactSentAt);
  return Number.isFinite(t) && now - t >= RESULT_WAIT_MS;
}

/** 결과 확인 시작 시각(연락처 전달 + 3일) — "M.D부터 결과 확인" 표시용 */
export function resultDueAt(contactSentAt: string): number {
  return Date.parse(contactSentAt) + RESULT_WAIT_MS;
}

/** "이 건 끝내기" 사유 → 결과. 테스트·구매자 취소 = 취소(성사율에 안 섞임), 판매자 재고 없음·연락 안 됨·거래 안 됨 = 불발.
 *  거래 안 됨은 ④ [안 됐어요 (불발)]가 미리 골라 주지만 목록에는 단계 상관없이 항상 보임(단순하게) */
export const END_REASONS = [
  { key: "test", label: "테스트", result: "cancelled" },
  { key: "buyer_cancel", label: "구매자 취소", result: "cancelled" },
  { key: "no_stock", label: "판매자 재고 없음", result: "failed" },
  { key: "no_answer", label: "연락 안 됨", result: "failed" },
  { key: "no_deal", label: "거래 안 됨", result: "failed" },
] as const satisfies readonly { key: string; label: string; result: ConnectionResult }[];
export type EndReasonKey = (typeof END_REASONS)[number]["key"];

/** ③ 판매자에게 보내는 문구 */
export function contactMessage(title: string, phone: string): string {
  return `[덤핑점핑] ${title} 구매 희망 고객 연락처입니다.\n구매자 번호: ${phone}\n거래 조건은 직접 협의해 주세요. 거래가 되면 덤핑점핑에 알려주세요.`;
}

/** 목록 정렬 순위 — 멈춤(0) → 3일 지난 결과 확인(1) → 나머지(2) → 테스트 건 맨 아래(3). 같은 순위는 마지막 변경이 오래된 순 */
export function boardRank(c: { stuck: boolean; result_due: boolean; is_test: boolean }): number {
  if (c.is_test) return 3;
  if (c.stuck) return 0;
  if (c.result_due) return 1;
  return 2;
}
export function sortBoard<T extends { stuck: boolean; result_due: boolean; is_test: boolean; updated_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => boardRank(a) - boardRank(b) || Date.parse(a.updated_at) - Date.parse(b.updated_at));
}

/** 메모·사유에 휴대폰 번호(01X + 7~8자리, 하이픈·공백·점 유무 무관)가 있는지 */
export function hasPhoneNumber(text: string): boolean {
  return /(^|[^0-9])01[0-9][-\s.]?[0-9]{3,4}[-\s.]?[0-9]{4}([^0-9]|$)/.test(text);
}
