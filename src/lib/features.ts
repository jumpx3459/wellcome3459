// 기능 플래그. 코드는 남겨두고 화면 노출만 끈다.

// 회원간 쪽지 — 2026-09-28 당분간 숨김 (사용 이력 0건, 새 쪽지 알림/안 읽음 표시가 없어
// 판매자가 쪽지를 알아챌 방법이 없음). DB insert 정책도 제거돼 있어서 true로만 바꾸면
// 전송이 실패한다 — 재오픈 절차는 supabase/schema.sql의 "[재오픈용]" 주석 참고.
export const MESSAGES_ENABLED = false;

// 내 견적함 — 2026-09-29 아직 실제 기능 없음. false인 동안 마이페이지엔 "곧 오픈" 예고 카드
// (QuotesTeaserCard)만 보이고, 오픈 알림 신청은 feature_waitlist(feature = "quotes")에 쌓인다.
export const QUOTES_ENABLED = false;

// 예시 매물(mockData) 사진·영상 — 2026-09-29. 앞 4건은 저장소 사진(public/images/mock),
// 나머지는 loremflickr 외부 무작위 이미지라 출처·사용권이 확인되지 않음. 공개 전 확인이 안 되면
// false로 → 예시 카드·예시 상세가 전부 "사진 준비 중"(NoPhotoPlaceholder)으로 표시.
// 2026-09-29: 출처 미확인이라 false로 공개. 대표 사진을 받으면 교체 후 true로.
export const EXAMPLE_MEDIA_ENABLED = false;
