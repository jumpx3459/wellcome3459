// 매물 사진 장수 한도 (2026-09-29) — sell 폼·업로드 API·판매신청 API·안내 문구가 모두 이 값을 쓴다.
// 한도 = 기본 6장 + 추천 보너스(bonus_photo_slots, 최대 10장까지만 반영) → 최대 16장.
// bonus_photo_slots 적립(grant_referral_bonus 트리거)은 그대로 — 추천할 때마다 +2씩 쌓이지만 한도 계산에서만 10으로 자름.
export const BASE_PHOTO_SLOTS = 6;
export const MAX_BONUS_PHOTO_SLOTS = 10;
export const MAX_PHOTO_SLOTS = BASE_PHOTO_SLOTS + MAX_BONUS_PHOTO_SLOTS; // 16

export function getPhotoLimit(member: { bonus_photo_slots?: number | null } | null | undefined): number {
  const bonus = Math.max(0, Math.floor(member?.bonus_photo_slots ?? 0));
  return BASE_PHOTO_SLOTS + Math.min(bonus, MAX_BONUS_PHOTO_SLOTS);
}

export function isPhotoLimitMaxed(member: { bonus_photo_slots?: number | null } | null | undefined): boolean {
  return getPhotoLimit(member) >= MAX_PHOTO_SLOTS;
}

export function photoLimitError(limit: number): string {
  return `사진은 최대 ${limit}장까지 올릴 수 있어요`;
}
