// 2026-10-04 F-4 거래 연결 보드 — 단계·방법·결과 값과 규칙 (화면·서버 공용, 다른 모듈 import 없음).
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

/** 리드(interests·quick_leads) outcome — 리드 카드 PATCH와 같은 값. 취소도 거래가 없었으니 불발(no_deal) */
export const RESULT_TO_LEAD_OUTCOME: Record<ConnectionResult, "completed" | "no_deal"> = {
  success: "completed",
  failed: "no_deal",
  cancelled: "no_deal",
};

export const STUCK_MS = 24 * 60 * 60 * 1000;
export const MEMO_MAX = 200;
export const MEMO_PLACEHOLDER = "번호·주소 등 개인정보는 적지 마세요";

export const stepIndex = (s: ConnectionStatus) => CONNECTION_STEPS.indexOf(s);
export const isConnectionStatus = (v: unknown): v is ConnectionStatus => CONNECTION_STEPS.includes(v as ConnectionStatus);

/** 지금 단계에서 갈 수 있는지 — 앞으로만(건너뛰기 허용), 종료된 연결은 더 못 감 */
export function canMoveTo(current: ConnectionStatus, next: ConnectionStatus): boolean {
  return current !== "closed" && next !== "requested" && stepIndex(next) > stepIndex(current);
}

/** 멈춘 연결: 진행 중인데 마지막 변경이 24시간 넘게 전 */
export function isStuck(status: ConnectionStatus, updatedAt: string, now = Date.now()): boolean {
  return status !== "closed" && now - Date.parse(updatedAt) > STUCK_MS;
}

/** 메모·사유에 휴대폰 번호(01X + 7~8자리, 하이픈·공백·점 유무 무관)가 있는지 */
export function hasPhoneNumber(text: string): boolean {
  return /(^|[^0-9])01[0-9][-\s.]?[0-9]{3,4}[-\s.]?[0-9]{4}([^0-9]|$)/.test(text);
}
