// 매물 사진 장수 한도 — sell 폼·업로드 API·판매신청 API·관리자 폼·관리자 매물 API가 모두 이 값을 쓴다.
// 2026-10-12 feat/photo12-video30: 판매자 12장 · 관리자 25장. 추천 보너스(bonus_photo_slots)는 한도에 더하지 않음
// (DB 칸·grant_referral_bonus 트리거는 그대로 — 값이 쌓여도 한도는 12).
export const SELLER_PHOTO_LIMIT = 12;
export const ADMIN_PHOTO_LIMIT = 25;

// 시그니처는 예전 그대로(사용처가 회원 행을 넘김) — 보너스와 무관하게 판매자 한도
export function getPhotoLimit(member?: { bonus_photo_slots?: number | null } | null): number {
  void member; // bonus_photo_slots는 더 이상 한도에 반영하지 않음
  return SELLER_PHOTO_LIMIT;
}

export function photoLimitError(limit: number): string {
  return `사진은 최대 ${limit}장까지 올릴 수 있어요`;
}

// 관리자 매물 API(새 매물·승인·수정) 400 문구
export const ADMIN_PHOTO_LIMIT_ERROR = `${photoLimitError(ADMIN_PHOTO_LIMIT)}.`;
