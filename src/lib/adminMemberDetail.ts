// 관리자 회원 상세(보기 전용) 조립 규칙 (2026-10-23 feat/admin-member-detail) — 서버 API와 단위 시험이 같이 씀. 다른 모듈 import 없음.
// 개인정보 원칙: 응답에 신청서 연락처(contact_phone)·사업자등록번호 원문·등록증 경로를 넣지 않는다(이 파일의 타입에도 칸이 없음).

/** 상세에 보여 주는 동의 종류(night_ad는 아직 안 받음) — 순서 그대로 화면에 */
export const DETAIL_CONSENT_TYPES = ["tos", "privacy", "eligibility", "deal_alert_ad", "kakao_marketing", "seller_terms", "biz_info"] as const;
export type DetailConsentType = (typeof DETAIL_CONSENT_TYPES)[number];

export type ConsentRow = { consent_type: string; agreed: boolean; terms_version: string | null; source: string | null; created_at: string };
export type ConsentState = { type: DetailConsentType; status: "agreed" | "withdrawn" | "none"; terms_version: string | null; source: string | null; at: string | null };

/** member_consents(변경 이력이 쌓이는 표)에서 종류별 최신 1행만 — 동의/철회/기록 없음 */
export function latestConsents(rows: ConsentRow[]): ConsentState[] {
  const latest = new Map<string, ConsentRow>();
  for (const r of rows) {
    const cur = latest.get(r.consent_type);
    if (!cur || Date.parse(r.created_at) > Date.parse(cur.created_at)) latest.set(r.consent_type, r);
  }
  return DETAIL_CONSENT_TYPES.map((type) => {
    const r = latest.get(type);
    return r
      ? { type, status: r.agreed ? "agreed" : "withdrawn", terms_version: r.terms_version, source: r.source, at: r.created_at }
      : { type, status: "none", terms_version: null, source: null, at: null };
  });
}

export type BusinessState = { state: "verified" | "license_only" | "none"; verified_at: string | null };

/** 사업자 인증 상태 — 인증(business_verified)·등록증만 있음(승인 전)·없음. 인증일은 감사 로그 business_verify 최신 1건(없으면 null → 화면 "인증일 기록 없음") */
export function businessState(m: { business_verified: boolean | null; has_license: boolean }, verifiedAt: string | null): BusinessState {
  if (m.business_verified) return { state: "verified", verified_at: verifiedAt ?? null };
  return { state: m.has_license ? "license_only" : "none", verified_at: null };
}

/** 2026-11-05 1단계: 회원 셀프 확인(member_business_checks) 최신 일치 기록 1건 — 사업자번호는 마스킹 값만(원문 칸 없음) */
export type SelfCheckLine = {
  checked_at: string;
  status_code: "01" | "02" | "03" | null;
  b_no_masked: string | null;
  /** 같은 사업자번호로 일치 확인된 다른 회원 수(차단 없음, 표시만) */
  same_bno_members: number;
};

/** 같은 사업자번호로 일치(01) 확인된 "다른" 회원 수 — 같은 회원 중복·회원 키 없는 행은 셈에서 뺌 */
export function countOtherMembers(rows: { member_id: string | null }[] | null | undefined, memberId: string): number {
  return new Set((rows ?? []).map((r) => r.member_id).filter((v): v is string => !!v && v !== memberId)).size;
}

/** 관리자 상세 문구 — "국세청 자동 확인 M/D · 계속사업자 · 123-45-*****" (KST 월/일) */
export function selfCheckText(c: Pick<SelfCheckLine, "checked_at" | "status_code" | "b_no_masked">): string {
  const d = new Date(Date.parse(c.checked_at) + 9 * 3600e3);
  const word = c.status_code === "01" ? "계속" : c.status_code === "02" ? "휴업" : c.status_code === "03" ? "폐업" : null;
  return ["국세청 자동 확인 " + (d.getUTCMonth() + 1) + "/" + d.getUTCDate(), word, c.b_no_masked].filter(Boolean).join(" · ");
}

/** 이 회원의 행만 — 회원 키가 정확히 같은 행. 키가 null인 비회원 행·다른 회원 행은 번호가 같아도 버림(조회 쿼리 + 이중 방어) */
export function onlyOwn<T extends Record<string, unknown>>(rows: T[] | null | undefined, key: string, memberId: string): T[] {
  return (rows ?? []).filter((r) => r[key] != null && r[key] === memberId);
}

/** 활동 구역 공통: 최신순 상한 */
export const DETAIL_LIST_LIMIT = 20;

export type MemberDetail = {
  member: {
    id: string;
    member_no: number | null;
    phone: string; // 최고관리자 전체 / 관리자 가린 번호(010-****-1234)
    phone_masked: boolean;
    created_at: string;
    is_test: boolean;
    nickname: string | null;
    company_name: string | null;
    is_business: boolean;
    is_official_partner: boolean;
    push_opt_out: boolean;
    utm: { source: string | null; medium: string | null; campaign: string | null } | null; // null = 기록 없음(칸이 없거나 값 없음)
    referrer: { member_no: number | null; phone_masked: string } | null;
    referred_count: number;
    partner_request: { status: string; created_at: string } | null;
  };
  business: BusinessState;
  self_check: SelfCheckLine | null;
  consents: ConsentState[];
  push_device_count: number;
  categories: string[];
  regions: string[];
  seller_requests: { id: string; product_name: string | null; status: string | null; created_at: string; linked_deal: { title: string; status: string | null; closes_at: string } | null }[];
  buy_requests: { id: string; product_name: string; category: string | null; outcome: string | null; contacted: boolean | null; created_at: string }[];
  interests: { id: string; deal_title: string | null; deal_status: string | null; contacted: boolean | null; outcome: string | null; created_at: string }[];
  connections: { id: string; deal_title: string; status: string; result: string | null; created_at: string }[];
};
