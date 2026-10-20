// "찾습니다" 공개 노출 판정 (2026-10-20) — 띠(/api/buy-requests/summary)와 목록(/api/buy-requests/public)이 같이 쓴다.
// 다른 모듈 import 없음(단위 시험용 — scripts/buy-exposure-test.mts). 전화번호는 호출하는 쪽이 normalizePhone으로 맞춰서 넘김.
//
// 노출 조건: 점핑매니저가 연락함(contacted=true) AND 결과 진행중(outcome='pending') AND 최근 30일.
// 시험 제외:
//   · 시험 회원(members.is_test) · 제외 번호 표(kpi_excluded_phones) → 계속 제외
//   · 관리자 번호(admin_users)·관리자 회원이 올린 글 → 2026-10-19 00:00 KST 이후 글은 노출(대리 등록 = 정상 운영, 오픈 전 시험 글은 계속 숨김)
//   · 예외 허용 글 id → 위 제외·날짜 규칙과 상관없이 노출(단, 노출 조건은 그대로)

export const BUY_VISIBLE_DAYS = 30;

/** 이 시각 이후에 관리자가 올린 글은 대리 등록(정상 운영)으로 보고 노출 — 2026-10-19 00:00 +09:00 */
export const BUY_ADMIN_VISIBLE_FROM = "2026-10-18T15:00:00.000Z";

/**
 * 예외 허용 id — 오픈 전(10/12)에 대표 번호로 올라온 실제 의뢰(대표 확인 2026-10-20).
 * 관리자 번호 글이라 날짜 규칙(10/19 이후)에 걸려 숨겨지지만, 시험이 아니라 진짜 의뢰라서 이 건만 노출.
 */
export const BUY_ALWAYS_VISIBLE_IDS: readonly string[] = ["5c33d493-f77a-476e-a559-38018c795f5f"];

export type BuyExposureRow = {
  id: string;
  contacted: boolean | null;
  outcome: string | null;
  created_at: string;
  member_id: string | null;
  /** 정규화한 연락 번호(없으면 "") */
  phone: string;
};

export type BuyExposureContext = {
  now: number;
  testMemberIds: ReadonlySet<string>;
  /** 제외 번호 표(정규화) */
  excludedPhones: ReadonlySet<string>;
  adminMemberIds: ReadonlySet<string>;
  /** 관리자 번호(정규화) */
  adminPhones: ReadonlySet<string>;
};

export function isBuyVisible(row: BuyExposureRow, ctx: BuyExposureContext): boolean {
  if (row.contacted !== true || row.outcome !== "pending") return false;
  const created = Date.parse(row.created_at);
  if (!Number.isFinite(created) || created < ctx.now - BUY_VISIBLE_DAYS * 24 * 3600e3) return false;

  if (BUY_ALWAYS_VISIBLE_IDS.includes(row.id)) return true;

  if (row.member_id && ctx.testMemberIds.has(row.member_id)) return false;
  if (row.phone && ctx.excludedPhones.has(row.phone)) return false;

  const byAdmin = (!!row.member_id && ctx.adminMemberIds.has(row.member_id)) || (!!row.phone && ctx.adminPhones.has(row.phone));
  if (byAdmin) return created >= Date.parse(BUY_ADMIN_VISIBLE_FROM);
  return true;
}

// 목록 API가 내려주는 칸 — 이 밖의 칸(연락처·희망가·설명·회원 id·이름·상호)은 절대 넣지 않음
export type PublicBuyItem = {
  id: string;
  /** 연락처·링크가 섞인 이름이면 null(화면은 "찾는 상품"으로) */
  name: string | null;
  category: string | null;
  quantity: string | null;
  region: string | null;
  created_at: string;
};
export const PUBLIC_BUY_FIELDS = ["id", "name", "category", "quantity", "region", "created_at"] as const;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "3일 전" — 오늘이면 "오늘" */
export function daysAgoLabel(createdAt: string, now: number): string {
  const d = Math.floor((now - Date.parse(createdAt)) / (24 * 3600e3));
  return d <= 0 ? "오늘" : `${d}일 전`;
}
