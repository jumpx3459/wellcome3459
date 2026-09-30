// 수신·약관 동의 기록 (2026-09-30) — member_consents 테이블, 타입별 최신 상태는 member_consent_latest 뷰.
// 기록은 서버(/api/consents, service role)만 남기고, 화면은 본인 최신 상태만 읽는다(RLS 본인 조회).
// 값 목록은 supabase/schema.sql의 check 제약과 같아야 함.
// 문구 기준: docs/legal/consent-texts-2026-10-07.md (동의 종류 1번, 가입·재동의 2번, 수집·이용 전문 3번,
// 알림 켜기 4번, 동의·철회 안내 5번). 약관 전문은 docs/legal/terms-2026-10-07.md(/terms).
export const TERMS_VERSION = "2026-10-07";

// seller_terms(판매 신청 확인 사항)는 커밋 E부터 /api/seller-requests가 source 'sell'로 기록.
// biz_info(사업자 인증 정보, 공개 후)·night_ad(예약)는 아직 받지 않음
export const CONSENT_TYPES = [
  "tos",
  "privacy",
  "eligibility",
  "deal_alert_ad",
  "night_ad",
  "kakao_marketing",
  "seller_terms",
  "biz_info",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
// 'sell'은 판매 신청(/api/seller-requests) — DB check에 'sell' 추가 SQL(schema.sql 커밋 E 블록) 실행 후 배포
export const CONSENT_SOURCES = ["signup", "push_enable", "reconsent", "mypage", "sell"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const isConsentType = (v: unknown): v is ConsentType =>
  typeof v === "string" && (CONSENT_TYPES as readonly string[]).includes(v);
export const isConsentSource = (v: unknown): v is ConsentSource =>
  typeof v === "string" && (CONSENT_SOURCES as readonly string[]).includes(v);

// 가입·재동의에서 받는 필수 동의 — 하나라도 최신 동의 기록이 없으면 재동의 시트
export const REQUIRED_CONSENTS = ["tos", "privacy", "eligibility"] as const;

// 화면 문구 — 가입·재동의 시트·알림 켜기 시트가 같이 쓴다 (consent-texts 2·4번)
export const CONSENT_TEXT = {
  tos: { label: "서비스 이용약관 동의", href: "/terms" },
  privacy: { label: "개인정보 수집·이용 동의" }, // 보기 → PRIVACY_CONSENT_TEXT(3번 전문)
  eligibility: { label: "사업 목적으로 이용하며, 만 14세 이상입니다" },
  deal_alert_ad: {
    label: "매물 알림 수신 동의 (광고성 정보)",
    desc: "관심 조건에 맞는 매물을 앱 푸시로 빠르게 알려드려요.\n밤 9시~아침 8시에 등록된 매물은 아침 8시에 보내드려요.\n동의하지 않아도 매물 둘러보기는 할 수 있어요.",
    // 알림 켜기 시트(4번)
    pushTitle: "매물 알림을 받으려면 동의가 필요해요",
    pushDesc: "관심 조건에 맞는 매물을 앱 푸시로 빠르게 알려드려요.\n밤 9시~아침 8시에 등록된 매물은 아침 8시에 보내드려요.\nMY > 이 기기 푸시 알림에서 언제든 끌 수 있어요.",
  },
  kakao_marketing: { label: "카카오톡 채널 소식 수신 동의 (광고성 정보)", desc: "공지·이벤트 소식을 카카오톡으로 받아요." },
  // 판매 신청 확인 사항 (consent-texts 7-2)
  seller_terms: {
    label: "[필수] 판매자 확인 사항에 동의합니다",
    items: [
      "매물 정보(수량·가격·정상가·소비기한 등)를 사실대로 적었어요.",
      "판매에 필요한 인허가를 갖추고 있어요.",
      "사진·설명을 게시할 권리가 있어요.",
      "점핑매니저가 매물 정보를 확인·보완해 게시하고, 알림·공유에 이용하는 데 동의해요.",
      "연결된 구매자의 정보는 거래 상담에만 쓰고, 상담이 끝나면 파기할게요.",
    ],
  },
} as const;

// 판매 신청 업체명 공개 설정 (consent-texts 7-2) — 기본 비공개
export const COMPANY_DISCLOSURE_TEXT = {
  title: "업체명 공개 설정 (기본: 비공개)",
  private: { label: "비공개", desc: "구매자에게 \"비공개 판매자\"로 보여요. 점핑매니저에게는 실제 업체명이 보여요." },
  public: { label: "공개", desc: "매물 상세에 업체명이 보여요." },
} as const;

// 개인정보 수집·이용 동의(필수) 전문 — consent-texts 3번. [확인] 자리는 가입 화면이 실제로 받는 항목으로 채움
// (사업자 회원 여부·업체명 입력 칸, 추천 링크 가입 시 추천인 기록 — signup/page.tsx).
export const PRIVACY_CONSENT_TEXT = `점프엑스 주식회사는 덤핑점핑 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.

· 수집 항목: 휴대폰 번호, 관심 카테고리·지역, 서비스 이용 기록, 접속 기기·브라우저 정보, 사업자 회원 여부, 업체명(입력한 경우), 추천인(추천 링크로 가입한 경우)
· 이용 목적: 회원 가입·본인 확인, 조건 맞춤 매물 제공, 거래 연결 상담, 고객 문의 처리, 부정 이용 방지
· 보유 기간: 회원 탈퇴 시까지. 단, 관계 법령에 따라 보관이 필요한 정보는 해당 기간 동안 보관합니다.

동의를 거부할 수 있으며, 거부 시 회원 가입이 제한됩니다.`;

// 동의/철회 직후 안내 — "YYYY.MM.DD"는 저장된 created_at의 한국 날짜
export function formatConsentDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts.replaceAll("-", ".");
}

const NOTICE_NAME: Partial<Record<ConsentType, string>> = {
  deal_alert_ad: "매물 알림 수신",
  kakao_marketing: "카카오톡 채널 소식 수신",
};

// consent-texts 5번
export function consentNotice(type: ConsentType, agreed: boolean, recordedAt?: string | null) {
  const name = NOTICE_NAME[type];
  if (!name) return null;
  const date = formatConsentDate(recordedAt);
  return agreed ? `${name}에 동의하셨어요 (${date}, 덤핑점핑)` : `${name} 동의를 철회하셨어요 (${date}, 덤핑점핑)`;
}
