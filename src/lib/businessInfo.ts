// 운영 사업자 정보 (2026-09-30, 커밋 D) — 푸터·문의 경로가 모두 여기 값을 쓴다. 바뀌면 이 파일만 고칠 것.
// 계좌번호·법인등록번호·팩스는 넣지 않는다. mailOrderNo(통신판매업 신고번호)는 신고 전이라 null → 푸터에서 줄을 숨김.
export const BUSINESS_INFO = {
  companyName: "점프엑스 주식회사 (JumpX Inc.)",
  ceo: "김현정, 김태현",
  bizRegNo: "283-88-03842",
  mailOrderNo: null as string | null,
  address: "경기도 남양주시 화도읍 마석로 87-7, 201호",
  tel: "070-4006-0890",
  email: "info@jumpx.co.kr",
  // 문의(채팅 상담)는 /chat 주소. 채널 추가(공지 소식)는 KakaoChannelButton·가입 화면의 /friend 주소를 그대로 씀
  kakaoChannel: { url: "https://pf.kakao.com/_xcFZrX/chat", searchId: "@덤핑점핑" },
  privacyOfficer: "김현정",
  hosting: "Vercel Inc.",
} as const;

export const telHref = (tel: string) => `tel:${tel.replace(/[^0-9+]/g, "")}`;
export const mailHref = (email: string) => `mailto:${email}`;

export const SERVICE_ROLE_NOTICE = "덤핑점핑은 판매자와 구매자를 연결하는 서비스로, 거래 당사자가 아닙니다.";
