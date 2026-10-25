// 매물 마감 기간 선택지·검증 한 곳 (2026-10-24 feat/deal-deadline-options) — 관리자 DealForm(등록·수정)과 등록·수정 API가 같이 씀.
// 다른 모듈 import 없음(단위 시험용). 마감 시각은 항상 closes_at(ISO)로 주고받고, 선택지는 "지금 + N시간"을 폼이 계산할 뿐이다.
// /sell 희망 기간(hope_duration_hours: 3·12·24·72·168·협의)은 범위 밖 — 신청 → 등록 때만 아래 매핑으로 가장 가까운 큰 선택지로 맞춘다.

export const DEADLINE_DEFAULT = "168"; // 7일
export const DEADLINE_CUSTOM = "custom";
export const DEADLINE_OPTIONS: readonly { v: string; l: string }[] = [
  { v: "24", l: "24시간" },
  { v: "72", l: "3일" },
  { v: "168", l: "7일" },
  { v: "336", l: "14일" },
  { v: "720", l: "30일" },
  { v: DEADLINE_CUSTOM, l: "날짜 직접 선택" },
];

export const DEADLINE_MAX_DAYS = 60;
export const DEADLINE_MAX_MS = DEADLINE_MAX_DAYS * 24 * 3600 * 1000;
export const DEADLINE_MAX_MESSAGE = "마감은 최대 60일까지예요";
export const DEADLINE_PAST_MESSAGE = "마감 시간은 지금 이후여야 해요.";
export const DEADLINE_CHOOSE_MESSAGE = "마감까지 남은 시간을 골라주세요.";

/** /sell 희망 기간(시간) → 새 선택지: 가장 가까운 큰 값(3·12 → 24시간). 값이 없으면(협의) 빈 문자열 = 미선택(필수 선택) */
export function mapHopeHoursToChoice(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "";
  for (const h of [24, 72, 168, 336, 720]) if (hours <= h) return String(h);
  return DEADLINE_CUSTOM; // 30일 초과 — 직접 선택으로
}

/** 소비기한 날 23:59:59(한국 시간)의 ms — 마감은 이 시각을 넘을 수 없음 */
export function expiryLimitMs(expiryDate: string): number {
  return Date.parse(`${expiryDate}T23:59:59+09:00`);
}

export function closesAfterExpiryMessage(expiryDate: string): string {
  return `마감 일시는 소비기한(${expiryDate.replace(/-/g, ".")}) 23:59 이전이어야 해요.`;
}

/** 마감 시각이 허용 범위인지 — 지금 이후 · 지금+60일 이하 · (소비기한이 있으면) 소비기한 23:59 이하. 문제 없으면 null.
 *  expiryDate가 없거나 형식이 아니면 소비기한 검사는 하지 않음. */
export function checkClosesAt(closesMs: number, nowMs: number, expiryDate?: string | null): string | null {
  if (!Number.isFinite(closesMs)) return "마감 시간이 올바르지 않아요.";
  if (closesMs <= nowMs) return DEADLINE_PAST_MESSAGE;
  if (closesMs > nowMs + DEADLINE_MAX_MS) return DEADLINE_MAX_MESSAGE;
  if (expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate) && closesMs > expiryLimitMs(expiryDate)) return closesAfterExpiryMessage(expiryDate);
  return null;
}
