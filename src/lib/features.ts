// 기능 플래그. 코드는 남겨두고 화면 노출만 끈다.

// 회원간 쪽지 — 2026-09-28 당분간 숨김 (사용 이력 0건, 새 쪽지 알림/안 읽음 표시가 없어
// 판매자가 쪽지를 알아챌 방법이 없음). DB insert 정책도 제거돼 있어서 true로만 바꾸면
// 전송이 실패한다 — 재오픈 절차는 supabase/schema.sql의 "[재오픈용]" 주석 참고.
export const MESSAGES_ENABLED = false;

// 내 견적함 — 2026-09-29 아직 실제 기능 없음. false인 동안 마이페이지엔 "곧 오픈" 예고 카드
// (QuotesTeaserCard)만 보이고, 오픈 알림 신청은 feature_waitlist(feature = "quotes")에 쌓인다.
export const QUOTES_ENABLED = false;
