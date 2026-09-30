// 매물 판매자 표시 (2026-09-30, 커밋 E) — 약관 제2조 7호·제10조 3항·제12조 4항, 동의 문구 consent-texts 7-2.
// 공개 시점의 모든 매물은 중개(회사는 거래 당사자가 아님) — "회사 직접 판매" 표시는 두지 않는다.
// 상호 공개 && 상호 있음 → 상호, 그 외 → "비공개 판매자". 예전 임의 이름("{카테고리} 판매자 #NNNN")은 폐지.

export const PRIVATE_SELLER_NAME = "비공개 판매자";
export const PRIVATE_SELLER_NOTE = "점핑매니저가 연결해드려요";

// deals.is_anonymous·seller_display_name에 저장할 값
export function resolveSellerDisplay(isPublic: boolean, companyName: unknown): { is_anonymous: boolean; seller_display_name: string } {
  const name = typeof companyName === "string" ? companyName.trim() : "";
  if (isPublic && name) return { is_anonymous: false, seller_display_name: name.slice(0, 60) };
  return { is_anonymous: true, seller_display_name: PRIVATE_SELLER_NAME };
}

// 매물 상세에 보일 상호 — null이면 "비공개 판매자"로 표시. 예전 임의 이름 값(SQL로 바꾸기 전)도 비공개로 취급.
export function publicSellerName(deal: { is_anonymous?: boolean | null; seller_display_name?: string | null }): string | null {
  const name = deal.seller_display_name?.trim();
  if (!name || deal.is_anonymous || name === PRIVATE_SELLER_NAME || /판매자 #\d{4}$/.test(name)) return null;
  return name;
}

// 사칭 방지 (약관 제12조 4항) — 판매 신청 상호에 회사·서비스 이름이 들어가면 거부. 대소문자·공백 무시. 관리자 입력은 예외.
const RESERVED_NAMES = ["점프엑스", "jumpx", "덤핑점핑", "dumpingjumping"];
export function isReservedSellerName(companyName: unknown): boolean {
  if (typeof companyName !== "string") return false;
  const normalized = companyName.toLowerCase().replace(/\s+/g, "");
  return RESERVED_NAMES.some((r) => normalized.includes(r));
}
