import { supabase } from "@/lib/supabase";
import { isNegotiable, type PriceMode } from "@/lib/priceMode";

// 2026-10-03 A안: 비회원 가격 비공개 — 판매가·정상가는 가입 회원(authenticated)에게만.
// DB(supabase/migrations/20261003_*): anon은 deals.deal_price·original_price select 권한이 없고(B),
// 대신 할인율 칸 deals.discount_pct(generated, A)만 읽는다. 가격 칸을 select에 넣은 anon 요청은
// 칸만 비는 게 아니라 요청 전체가 42501(permission denied)로 실패하므로, 세션을 먼저 보고 select 문자열을 나눈다.
// 회원 요청이 42501이면(세션이 요청 시점에 사라진 경우 등) 가격 없는 select로 한 번 더 — 화면은 비회원 표시.

// 2026-10-04 가격 협의: price_mode는 anon도 읽는 칸(가격 칸은 계속 숨김) — 협의 매물은 가격 숨김 문구 대신 "가격 협의"
export const MEMBER_PRICE_COLS = "deal_price, original_price, price_mode";
export const GUEST_PRICE_COLS = "discount_pct, price_mode";
export const MEMBER_PRICE_CTA = "회원가 보기";

type QueryResult<T> = { data: T | null; error: { code?: string; message?: string } | null; count?: number | null };

export async function hasMemberSession(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session?.user;
  } catch {
    return false;
  }
}

export function isPriceDenied(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42501";
}

/** run(가격 칸 문자열)로 조회 — 회원이면 가격 칸, 비회원(또는 회원 요청 42501)이면 discount_pct. priceHidden = 가격 없이 받은 결과 */
export async function selectWithPriceAccess<T>(
  run: (priceCols: string) => PromiseLike<QueryResult<T>>,
): Promise<QueryResult<T> & { priceHidden: boolean }> {
  if (await hasMemberSession()) {
    const r = await run(MEMBER_PRICE_COLS);
    if (!isPriceDenied(r.error)) return { ...r, priceHidden: false };
  }
  const r = await run(GUEST_PRICE_COLS);
  return { ...r, priceHidden: true };
}

/** 조회 행 → Deal 가격 칸. 가격 없이 받은 행은 0으로 채우고 price_hidden 표시(화면은 가격 대신 "회원가 보기").
 * 2026-10-04: 가격 협의 매물(price_mode negotiable)은 가릴 가격이 없음 — 회원·비회원 모두 price_hidden false, 가격 null, 화면은 "가격 협의" */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dealPriceFields(row: Record<string, any>, priceHidden: boolean): {
  deal_price: number | null;
  original_price: number | null;
  discount_pct?: number | null;
  price_mode: PriceMode;
  price_hidden: boolean;
} {
  if (isNegotiable(row)) {
    return { deal_price: null, original_price: null, discount_pct: null, price_mode: "negotiable", price_hidden: false };
  }
  return priceHidden
    ? { deal_price: 0, original_price: 0, discount_pct: (row.discount_pct as number | null) ?? null, price_mode: "fixed", price_hidden: true }
    : { deal_price: row.deal_price as number, original_price: row.original_price as number, price_mode: "fixed", price_hidden: false };
}

/** 카드 할인율(정수, 0이면 배지 없음) — 회원 행은 지금까지와 같은 계산, 가격 없는 행은 DB discount_pct */
type PctRow = { original_price: number | null; deal_price: number | null; discount_pct?: number | null; price_hidden?: boolean; price_mode?: PriceMode };
export function cardDiscountPct(d: PctRow): number {
  if (isNegotiable(d)) return 0;
  if (d.price_hidden) return d.discount_pct ?? 0;
  return d.original_price && d.deal_price != null ? Math.round(((d.original_price - d.deal_price) / d.original_price) * 100) : 0;
}

/** 할인율순 정렬 키(비율) — 회원 행은 지금까지와 같은 계산 */
export function discountSortKey(d: PctRow): number {
  if (isNegotiable(d)) return 0; // 할인율 null은 뒤로(현행 유지)
  if (d.price_hidden) return (d.discount_pct ?? 0) / 100;
  return d.original_price && d.deal_price != null ? (d.original_price - d.deal_price) / d.original_price : 0;
}

/** 가격 자리 문구: "-N% · 회원가 보기" (할인율 없으면 "회원가 보기") */
export function memberPriceTeaser(discountPct: number | null | undefined): string {
  return discountPct && discountPct > 0 ? `-${discountPct}% · ${MEMBER_PRICE_CTA}` : MEMBER_PRICE_CTA;
}
