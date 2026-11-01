// 제휴·소개 칸(슬롯) 정의와 입력 검증 (2026-10-30 feat/stats-foundation) — 노출·클릭 일별 합계(ad_daily_stats) 기록용.
// 이름·경로에 ad·banner·sponsor를 쓰지 않음(광고 차단 도구 회피). 다른 모듈 import 없음(단위 시험용).
// 화면 칸은 PR 2부터 붙임 — 여기서는 칸 이름 목록과 값 검증만.
export const SLOT_IDS = [
  "connect_done", // 연결 요청 완료
  "sell_done", // 판매 신청 완료
  "supply_done", // 공급 제안 완료
  "logistics_shipping", // 점핑 도구함 탭별
  "logistics_pallet",
  "logistics_weather",
  "logistics_fx",
  "home_board_member", // 알림판 (회원 홈)
  "home_board_guest", // 알림판 (비회원 홈)
  "deals_board", // 알림판 (/deals)
] as const;

export type SlotId = (typeof SLOT_IDS)[number];
export type MetricKind = "impression" | "click";

const SLOT_RE = /^[a-z0-9_]{1,40}$/;
const PARTNER_ID_RE = /^[a-z0-9_-]{1,60}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSlot(v: unknown): v is SlotId {
  return typeof v === "string" && SLOT_RE.test(v) && (SLOT_IDS as readonly string[]).includes(v);
}
export function isValidPartnerId(v: unknown): v is string {
  return typeof v === "string" && PARTNER_ID_RE.test(v);
}
export function isValidKind(v: unknown): v is MetricKind {
  return v === "impression" || v === "click";
}
export function isValidDealId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** /api/metrics/slot 본문 검증 — 통과하면 정리된 값, 아니면 null */
export function parseSlotBody(body: unknown): { slot: SlotId; partnerId: string; kind: MetricKind } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isValidSlot(b.slot) || !isValidPartnerId(b.partnerId) || !isValidKind(b.kind)) return null;
  return { slot: b.slot, partnerId: b.partnerId, kind: b.kind };
}

/** /api/metrics/deal-view 본문 검증 */
export function parseDealViewBody(body: unknown): { dealId: string } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  return isValidDealId(b.dealId) ? { dealId: b.dealId } : null;
}
