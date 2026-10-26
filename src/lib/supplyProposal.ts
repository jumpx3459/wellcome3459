import { UUID_RE } from "@/lib/buyExposure";

// 찾습니다 공급 제안 (2026-10-26, feat/buy-supply-proposal) — /sell?buyRef=<id> 로 들어와 보낸 판매 신청 = "공급 제안".
// 서버(/api/seller-requests)와 단위 시험(scripts/seller-supply-test.mts)이 같이 쓰는 순수 함수 — 다른 모듈은 buyExposure.ts의 UUID_RE만 import.
//   · 공급 제안인지는 body.buyRef 가 "있는지"만 본다(유효성 무관 — 무효·만료여도 협의 접수, 400 없음)
//   · 연결(buy_request_id)은 buyRef가 uuid이고 buy_requests에 행이 있으면 노출 여부와 무관하게(서버가 service_role로 조회), 아니면 null

export const SUPPLY_PUSH_TITLE = "📦 새 공급 제안";
export const SUPPLY_PUSH_FALLBACK_NAME = "찾는 상품";

/** body.buyRef 가 들어 왔는가 — 빈 문자열·null·undefined·false 만 "없음" */
export function isSupplyRef(v: unknown): boolean {
  return typeof v === "string" ? v !== "" : v != null && v !== false;
}

/** buyRef 에서 연결에 쓸 uuid — 형식이 맞는 문자열만(앞뒤 공백 제거·소문자), 아니면 null */
export function supplyRefId(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return UUID_RE.test(s) ? s.toLowerCase() : null;
}

export type SupplyPrice = { ok: true; priceMode: "fixed" | "negotiable"; hopePrice: number | null; originalPrice: null };

/**
 * 공급 제안의 제안 단가 — 유효한 숫자(number, 0 초과)면 fixed, 빈칸·0·음수·비숫자(문자열 포함)는 negotiable(희망가 null).
 * 정상 단가는 받지 않아 항상 null. 400을 내지 않는다(seller_requests_price_by_mode_check 와 맞음).
 */
export function resolveSupplyPrice(input: { hopePrice?: unknown }): SupplyPrice {
  const h = input.hopePrice;
  if (typeof h === "number" && Number.isFinite(h) && h > 0) return { ok: true, priceMode: "fixed", hopePrice: h, originalPrice: null };
  return { ok: true, priceMode: "negotiable", hopePrice: null, originalPrice: null };
}

/** 관리자 푸시 본문 — 공개 판정을 통과한 요청의 공개 칸 name 만, 그 외·null 이면 "찾는 상품". 원문·판매자 입력은 절대 쓰지 않음 */
export function supplyPushBody(publicName: string | null | undefined): string {
  const n = typeof publicName === "string" ? publicName.replace(/\s+/g, " ").trim() : "";
  return n ? n.slice(0, 60) : SUPPLY_PUSH_FALLBACK_NAME;
}
