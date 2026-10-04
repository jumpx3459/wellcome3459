import { normalizeTitle, checkTitle, checkDescription } from "@/lib/titleGuard";
import { isValidExpiryDate, priceWarnings, EXPIRY_REQUIRED_MESSAGE } from "@/lib/dealFields";
import { isLumpSum } from "@/lib/priceUnit";
import { isPriceMode, type PriceMode } from "@/lib/priceMode";

// 진행 중 매물 수정 (2026-10-03 feat/admin-deal-edit) — 관리자 카드(ActiveDealCard)와 서버(/api/admin/deals/manage PATCH)가 같이 쓰는 검증.
// 규칙·문구는 등록(/api/admin/deals POST·DealForm)과 같음. 보낸 칸만 검사하고, 다른 칸이 필요한 규칙(MOQ ≤ 총수량, 마감 ≤ 소비기한)은
// 지금 저장된 값과 합쳐서 본다. 수정·연장은 알림을 다시 보내지 않음.

export type DealEditInput = {
  title?: string;
  priceMode?: PriceMode; // 2026-10-04 가격 방식 전환 — negotiable이면 가격 칸은 보내지 않음(둘 다 null로 저장), negotiable→fixed는 판매가 필수
  dealPrice?: number | null;
  originalPrice?: number | null; // null = 정상가 없음(저장은 판매가와 같은 값 — 등록과 같음)
  minOrderQty?: number | null;
  expiryDate?: string | null; // "YYYY-MM-DD"
  description?: string | null;
  closesAt?: string; // ISO
};

export type DealEditCurrent = {
  deal_price: number | null; // 가격 협의 매물은 null
  price_mode?: PriceMode | null;
  original_price?: number | null;
  total_qty: number;
  price_unit?: string | null;
  stock_type?: string | null;
  expiry_date?: string | null;
  closes_at: string;
};

export type DealEditField = "priceMode" | "title" | "dealPrice" | "originalPrice" | "minOrderQty" | "expiryDate" | "description" | "closesAt";

export const DEAL_EDIT_KEYS = ["priceMode", "title", "dealPrice", "originalPrice", "minOrderQty", "expiryDate", "description", "closesAt"] as const;

const isPositive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;

/** 소비기한 날 23:59:59(한국 시간)의 ms — 마감은 이 시각을 넘을 수 없음 */
export function expiryLimitMs(expiryDate: string): number {
  return Date.parse(`${expiryDate}T23:59:59+09:00`);
}

export function closesAfterExpiryMessage(expiryDate: string): string {
  return `마감 일시는 소비기한(${expiryDate.replace(/-/g, ".")}) 23:59 이전이어야 해요.`;
}

/** 저장 뒤의 가격 방식 — 보낸 값이 없으면 지금 값(price_mode 칸이 없던 예전 행은 fixed) */
export function effectivePriceMode(input: Pick<DealEditInput, "priceMode">, current: Pick<DealEditCurrent, "price_mode">): PriceMode {
  return input.priceMode ?? (current.price_mode === "negotiable" ? "negotiable" : "fixed");
}

/** 막는 문제(빨강) — 첫 문제 하나를 칸 이름과 함께. 문제 없으면 null */
export function validateDealEdit(
  input: DealEditInput,
  current: DealEditCurrent,
  now: number = Date.now(),
): { error: string; field: DealEditField } | null {
  const bad = (error: string, field: DealEditField) => ({ error, field });
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || !input.title.trim()) return bad("매물명을 입력해주세요.", "title");
    const block = checkTitle(normalizeTitle(input.title, { admin: true }), { admin: true }).block;
    if (block) return bad(block, "title");
  }
  if (input.priceMode !== undefined && !isPriceMode(input.priceMode)) return bad("가격 방식이 올바르지 않아요.", "priceMode");
  if (effectivePriceMode(input, current) === "negotiable") {
    // 가격 협의 — 가격 칸은 받지 않음(전환 때 이전 가격도 지움)
    if (input.dealPrice != null || input.originalPrice != null) return bad("가격 협의 매물에는 가격을 넣을 수 없어요.", "dealPrice");
  } else {
    // negotiable → fixed로 바꾸면 지금 가격이 없으니 판매가가 꼭 필요
    if (current.deal_price == null && input.dealPrice == null) return bad("판매가를 입력해주세요.", "dealPrice");
    if (input.dealPrice !== undefined) {
      if (input.dealPrice == null) return bad("판매가를 입력해주세요.", "dealPrice");
      if (!isPositive(input.dealPrice)) return bad("판매가는 0보다 커야 해요.", "dealPrice");
    }
    if (input.originalPrice !== undefined && input.originalPrice != null && !isPositive(input.originalPrice)) {
      return bad("정상가는 0보다 커야 해요.", "originalPrice");
    }
  }
  if (input.minOrderQty !== undefined && input.minOrderQty != null && !isLumpSum(current.price_unit)) {
    if (!isPositive(input.minOrderQty)) return bad("최소 주문량은 0보다 커야 해요.", "minOrderQty");
    if (input.minOrderQty > current.total_qty) return bad("최소주문량은 재고 총수량보다 클 수 없어요.", "minOrderQty");
  }
  if (input.expiryDate !== undefined) {
    if (input.expiryDate != null && input.expiryDate !== "" && !isValidExpiryDate(input.expiryDate)) {
      return bad("소비기한 날짜가 올바르지 않아요.", "expiryDate");
    }
    if (current.stock_type === "near_expiry" && !input.expiryDate) return bad(EXPIRY_REQUIRED_MESSAGE, "expiryDate");
  }
  if (input.description !== undefined && input.description != null && typeof input.description !== "string") {
    return bad("추가 설명이 올바르지 않아요.", "description");
  }
  if (input.closesAt !== undefined) {
    const t = typeof input.closesAt === "string" ? Date.parse(input.closesAt) : NaN;
    if (Number.isNaN(t)) return bad("마감 시간이 올바르지 않아요.", "closesAt");
    if (t <= now) return bad("마감 일시는 지금 이후여야 해요.", "closesAt");
  }
  // 마감 ≤ 소비기한 23:59 — 마감이나 소비기한을 바꿀 때만 (둘 다 그대로면 예전 매물도 다른 칸 수정은 됨)
  if (input.closesAt !== undefined || input.expiryDate !== undefined) {
    const expiry = input.expiryDate !== undefined ? input.expiryDate : current.expiry_date?.slice(0, 10) ?? null;
    const closes = Date.parse(input.closesAt ?? current.closes_at);
    if (expiry && isValidExpiryDate(expiry) && closes > expiryLimitMs(expiry)) {
      return bad(closesAfterExpiryMessage(expiry), input.closesAt !== undefined ? "closesAt" : "expiryDate");
    }
  }
  return null;
}

/** 확인 후 저장 경고(주황) — 바꾼 칸만. 같은 이름 진행 중 매물 경고는 서버가 DB를 보고 더함 */
export function dealEditWarnings(
  input: DealEditInput,
  current: DealEditCurrent & { title: string; description?: string | null },
): { title: string[]; description: string[]; price: string[] } {
  const titleChanged = input.title !== undefined && normalizeTitle(input.title, { admin: true }) !== current.title;
  const descChanged = input.description !== undefined && (input.description ?? "") !== (current.description ?? "");
  const negotiable = effectivePriceMode(input, current) === "negotiable";
  const priceChanged = !negotiable && (input.dealPrice !== undefined || input.originalPrice !== undefined || input.priceMode !== undefined);
  const deal = input.dealPrice ?? current.deal_price;
  const orig = input.originalPrice !== undefined ? input.originalPrice : current.original_price;
  return {
    title: titleChanged ? checkTitle(normalizeTitle(input.title, { admin: true }), { admin: true }).warnings : [],
    description: descChanged ? checkDescription(input.description) : [],
    price: priceChanged ? priceWarnings(orig, deal) : [],
  };
}
