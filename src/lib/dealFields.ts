// 매물 등록 폼 공통 값 (2026-10-01 PR-B) — 관리자 DealForm·/sell·두 API·상세·카드가 같이 쓴다.
// 보관 조건·소비기한은 deals/seller_requests의 storage_type·expiry_date (supabase/migrations/20261001_deal_form_fields.sql).
// 예전 행은 storage_condition(자유 입력 "냉동 · 26.12")만 있음 — 새 칸이 비어 있으면 그 값을 그대로 보여준다.

// DB check와 같은 값 — 바꾸면 migration·schema.sql의 check도 같이
export const STORAGE_TYPES = ["상온", "냉장", "냉동"] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];
export const STORAGE_ICONS: Record<StorageType, string> = { 상온: "🌡️", 냉장: "🧊", 냉동: "❄️" };

export function isStorageType(v: unknown): v is StorageType {
  return typeof v === "string" && (STORAGE_TYPES as readonly string[]).includes(v);
}

// 입력 예시 (칸 아래 칩 + datalist) — 여기만 고치면 두 폼에 같이 반영
export const PACKAGE_UNIT_EXAMPLES = ["1kg 팩", "5kg 박스", "10kg 박스", "20kg 박스", "낱개", "묶음(10개)", "파렛트"];
export const SPEC_EXAMPLES = ["소", "중", "대", "특대", "500ml", "1L", "S~L 혼합"];
export const ORIGIN_EXAMPLES = ["국내산", "중국산", "베트남산", "미국산", "호주산", "칠레산", "수입산(혼합)"];

// 소비기한 "YYYY-MM-DD" (input type=date 값)
export function isValidExpiryDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// "2026-10-20" → "~2026.10.20까지"
export function formatExpiry(v: string | null | undefined): string | null {
  if (!v || !isValidExpiryDate(v.slice(0, 10))) return null;
  return `~${v.slice(0, 10).replace(/-/g, ".")}까지`;
}

export const EXPIRY_REQUIRED_MESSAGE = "소비기한 임박 재고는 소비기한(날짜)을 입력해주세요.";

// 보관·소비기한 한 줄 — 새 칸 우선, 둘 다 비면 예전 storage_condition
export function storageSummary(d: {
  storage_type?: string | null;
  expiry_date?: string | null;
  storage_condition?: string | null;
}): string | null {
  const parts = [isStorageType(d.storage_type) ? d.storage_type : null, formatExpiry(d.expiry_date)].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return d.storage_condition?.trim() || null;
}

// 할인율(%) — 정상가가 없거나 판매가 이하가 아니면 null
export function discountPercent(original: number | null | undefined, deal: number | null | undefined): number | null {
  if (!original || !deal || original <= 0 || deal <= 0 || deal >= original) return null;
  return Math.round(((original - deal) / original) * 100);
}

export const HIGH_DISCOUNT_PCT = 80;
export const HIGH_DISCOUNT_WARNING = "정상가를 다시 확인해 주세요. 할인율이 너무 높으면 신뢰도가 떨어질 수 있어요.";
export function priceWarnings(original: number | null | undefined, deal: number | null | undefined): string[] {
  const pct = discountPercent(original, deal);
  return pct !== null && pct >= HIGH_DISCOUNT_PCT ? [`할인율 ${pct}% — ${HIGH_DISCOUNT_WARNING}`] : [];
}

// 공개 화면 조회에 붙이는 새 컬럼 — SQL 실행 전(컬럼 없음)이면 빼고 다시 조회
export const DEAL_NEW_COLS = ", expiry_date, storage_type";
const NEW_COL_NAMES = ["expiry_date", "storage_type", "original_price"];
export function isMissingNewColumn(error: { message?: string } | null | undefined): boolean {
  const m = error?.message ?? "";
  return NEW_COL_NAMES.some((c) => m.includes(c));
}

// 조회 컬럼 문자열을 동적으로 만들면 supabase-js가 행 타입을 못 읽음 — 화면 코드가 원래 하던 대로 느슨한 행으로
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DealRowLoose = Record<string, any>;
