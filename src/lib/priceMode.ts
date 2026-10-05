import { formatDealPrice } from "@/lib/format";

// 2026-10-04 "가격 협의" 매물 — deals.price_mode 'fixed'(판매가·정상가 있음, 지금까지와 같음) | 'negotiable'(두 가격 모두 null).
// DB: supabase/migrations/20261004_deal_price_negotiable.sql (CHECK deals_price_by_mode_check). 서버·브라우저 모두 import 가능(format.ts 외 import 없음).
// 2026-10-05: /sell 판매 신청(seller_requests.price_mode)도 같은 개념. "협의 가능"(fixed + 협의) 표시는 범위 밖.
export type PriceMode = "fixed" | "negotiable";

export const NEGOTIABLE_LABEL = "가격 협의";
export const NEGOTIABLE_NOTE = "점핑매니저가 연결해드려요";
export const NEGOTIABLE_TEXT = `${NEGOTIABLE_LABEL} · ${NEGOTIABLE_NOTE}`;
// 비회원 가입 버튼 — 협의 매물은 "가격 보기"가 아니라 연결이 목적
export const NEGOTIABLE_GUEST_CTA = "무료 회원가입하고 점핑매니저 연결";

export const isPriceMode = (v: unknown): v is PriceMode => v === "fixed" || v === "negotiable";

type ModeRow = { price_mode?: unknown } | null | undefined;

/** 협의 매물인가 — price_mode 칸이 없는 예전 행·예시 데이터는 fixed */
export const isNegotiable = (d: ModeRow): boolean => d?.price_mode === "negotiable";

/** 가격 문자열 — 협의면 "가격 협의". fixed인데 가격이 비어 있으면(CHECK로 생기지 않아야 함) "0원"·"NaN원" 대신 같은 문구 */
export function dealPriceLabel(d: {
  price_mode?: unknown;
  deal_price: number | null | undefined;
  quantity_unit?: string | null;
  price_unit?: string | null;
}): string {
  if (isNegotiable(d) || d.deal_price == null || !Number.isFinite(Number(d.deal_price))) return NEGOTIABLE_LABEL;
  return formatDealPrice(Number(d.deal_price), d.quantity_unit, d.price_unit);
}

/** 푸시 본문의 가격 부분(즉시·아침 발송 공통) — 협의 매물은 할인율 접두어 없이 "가격 협의". "0원"은 어떤 경우에도 나오지 않음 */
export function pushPriceParts(d: {
  price_mode?: unknown;
  deal_price: number | null | undefined;
  original_price: number | null | undefined;
  quantity_unit?: string | null;
  price_unit?: string | null;
}): { discountPrefix: string; priceText: string } {
  if (isNegotiable(d) || d.deal_price == null || !Number.isFinite(Number(d.deal_price)) || Number(d.deal_price) <= 0) {
    return { discountPrefix: "", priceText: NEGOTIABLE_LABEL };
  }
  const orig = d.original_price == null ? 0 : Number(d.original_price);
  const pct = orig > 0 ? Math.round(((orig - Number(d.deal_price)) / orig) * 100) : 0;
  return {
    discountPrefix: pct > 0 ? `${pct}%↓ · ` : "",
    priceText: formatDealPrice(Number(d.deal_price), d.quantity_unit, d.price_unit),
  };
}

// 2026-10-05 /sell 판매 신청 — 가격 방식 검증(서버 /api/seller-requests와 시험이 같이 씀).
// priceMode 가 없으면(예전 화면·캐시된 스크립트) fixed. 모르는 값은 400. fixed 는 희망가 필수, negotiable 은 보낸 가격과 무관하게 희망가·정상가 null.
// 정상가의 양수 검사는 호출 쪽에서 fixed 일 때만 함(협의면 정상가를 아예 쓰지 않음).
export const SELL_PRICE_REQUIRED_MESSAGE = "판매 단가를 입력해주세요";
export const SELL_PRICE_MODE_INVALID_MESSAGE = "가격 방식이 올바르지 않아요.";

export type SellerRequestPrice =
  | { ok: true; priceMode: PriceMode; hopePrice: number | null; originalPrice: number | null }
  | { ok: false; error: string; field: "priceMode" | "hopePrice" };

export function resolveSellerRequestPrice(input: { priceMode?: unknown; hopePrice?: unknown; originalPrice?: unknown }): SellerRequestPrice {
  const raw = input.priceMode;
  if (raw != null && !isPriceMode(raw)) return { ok: false, error: SELL_PRICE_MODE_INVALID_MESSAGE, field: "priceMode" };
  const priceMode: PriceMode = raw === "negotiable" ? "negotiable" : "fixed";
  if (priceMode === "negotiable") return { ok: true, priceMode, hopePrice: null, originalPrice: null };
  const hope = input.hopePrice;
  if (typeof hope !== "number" || !Number.isFinite(hope) || hope <= 0) return { ok: false, error: SELL_PRICE_REQUIRED_MESSAGE, field: "hopePrice" };
  return { ok: true, priceMode, hopePrice: hope, originalPrice: typeof input.originalPrice === "number" ? input.originalPrice : null };
}
