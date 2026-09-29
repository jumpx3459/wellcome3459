// 기능 플래그. 코드는 남겨두고 화면 노출만 끈다.

// 회원간 쪽지 — 2026-09-28 당분간 숨김 (사용 이력 0건, 새 쪽지 알림/안 읽음 표시가 없어
// 판매자가 쪽지를 알아챌 방법이 없음). DB insert 정책도 제거돼 있어서 true로만 바꾸면
// 전송이 실패한다 — 재오픈 절차는 supabase/schema.sql의 "[재오픈용]" 주석 참고.
export const MESSAGES_ENABLED = false;

// 내 견적함 — 2026-09-29 아직 실제 기능 없음. false인 동안 마이페이지엔 "곧 오픈" 예고 카드
// (QuotesTeaserCard)만 보이고, 오픈 알림 신청은 feature_waitlist(feature = "quotes")에 쌓인다.
export const QUOTES_ENABLED = false;

// 예시 매물(mockData) 사진·영상 스위치 — 2026-09-29. 출처 미확인 미디어(저장소 예시 사진·영상,
// loremflickr 외부 무작위 이미지)는 파일과 경로를 모두 삭제했고, 대표 사진을 받으면 새로 넣은 뒤 true로.
// false인 동안 예시 카드·예시 상세는 전부 "사진 준비 중"(NoPhotoPlaceholder).
export const EXAMPLE_MEDIA_ENABLED = false;

// JUMP X 브릿지(매물 상세 "지금 바로 입찰하고 싶다면 · JUMP X 경매") — 2026-09-29 실제 브릿지는 꺼져 있고
// 버튼을 누르면 "준비 중" 안내 + bridge_interests 기록만 남는 상태라 섹션 전체를 숨김. 코드는 유지 —
// 거래 플랫폼이 열리면 true로 바꾸고 deals/[id]의 handleBridgeClick을 원래 브릿지(/api/jumpx-bridge)로.
export const JUMPX_BRIDGE_ENABLED = false;

// 점프엑스 둘러보기(매물 상세 "점프엑스에서 거래하기 · 오픈 준비 중") — 2026-09-29. jumpx.co.kr에 프리런치 문구
// 배포 확인 후 켬. JUMPX_BRIDGE_ENABLED(실제 입찰 브릿지)가 false인 동안만 보임 — 브릿지가 열리면 그쪽이 대신함.
export const JUMPX_PREVIEW_ENABLED = true;
export const JUMPX_SITE_URL = "https://jumpx.co.kr";
