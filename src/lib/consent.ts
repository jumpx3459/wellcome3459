// 수신·약관 동의 기록 (2026-09-30) — member_consents 테이블, 타입별 최신 상태는 member_consent_latest 뷰.
// 기록은 서버(/api/consents, service role)만 남기고, 화면은 본인 최신 상태만 읽는다(RLS 본인 조회).
// 값 목록은 supabase/schema.sql의 check 제약과 같아야 함.
export const TERMS_VERSION = "2026-10-07";

export const CONSENT_TYPES = ["tos", "privacy", "deal_alert_ad", "night_ad", "kakao_marketing"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
export const CONSENT_SOURCES = ["signup", "push_enable", "reconsent", "mypage"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const isConsentType = (v: unknown): v is ConsentType =>
  typeof v === "string" && (CONSENT_TYPES as readonly string[]).includes(v);
export const isConsentSource = (v: unknown): v is ConsentSource =>
  typeof v === "string" && (CONSENT_SOURCES as readonly string[]).includes(v);

// 화면 문구 — 가입·재동의 시트·알림 켜기 시트·MY 토글이 같이 쓴다
export const CONSENT_TEXT = {
  tos: { label: "서비스 이용약관", href: "/terms" },
  privacy: { label: "개인정보 수집·이용", href: "/privacy" },
  deal_alert_ad: {
    label: "매물 알림 수신 동의 (광고성 정보)",
    desc: "관심 조건에 맞는 매물을 앱 푸시로 빠르게 알려드려요. 밤 9시~아침 8시에 등록된 매물은 아침 8시에 보내드려요. 동의하지 않아도 매물 둘러보기는 할 수 있어요.",
  },
  kakao_marketing: { label: "카카오톡 채널 소식 수신 동의 (광고성 정보)", desc: "공지·이벤트 소식" },
} as const;

// 동의/철회 직후 안내 — "YYYY.MM.DD"는 한국 날짜
export function formatConsentDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts.replaceAll("-", ".");
}

const NOTICE_NAME: Partial<Record<ConsentType, string>> = {
  deal_alert_ad: "매물 알림 수신",
  kakao_marketing: "카카오톡 채널 소식 수신",
};

export function consentNotice(type: ConsentType, agreed: boolean, recordedAt?: string | null) {
  const name = NOTICE_NAME[type];
  if (!name) return null;
  const date = formatConsentDate(recordedAt);
  return agreed ? `${name}에 동의하셨어요 (${date}, 덤핑점핑)` : `${name} 동의를 철회하셨어요 (${date})`;
}
