// "찾습니다" 공개 노출 판정 (2026-10-20) — 띠(/api/buy-requests/summary)와 목록(/api/buy-requests/public)이 같이 쓴다.
// 다른 모듈 import 없음(단위 시험용 — scripts/buy-exposure-test.mts). 전화번호는 호출하는 쪽이 normalizePhone으로 맞춰서 넘김.
//
// 노출 조건(공통): 점핑매니저가 연락함(contacted=true) AND 결과 진행중(outcome='pending') AND 최근 30일.
// 판정 순서 (2026-10-20 수정 — 대표 회원이 is_test=true라 시험 회원 제외가 먼저면 대표 글이 전부 숨어서):
//   1) 관리자 글(작성 회원이 관리자·설립자이거나 contact_phone이 관리자 번호) → is_test·제외 번호는 보지 않고
//      2026-10-19 00:00 KST 이후 글 또는 예외 허용 id만 노출, 나머지(오픈 전 시험 글)는 숨김
//   2) 관리자 글이 아니면 → 시험 회원(members.is_test)·제외 번호 표(kpi_excluded_phones) 숨김, 그 밖은 노출
//   (KPI 집계 kpiExclusion은 그대로 — 대표 계정은 KPI에서 계속 제외. 이 판정은 공개 노출 전용)

export const BUY_VISIBLE_DAYS = 30;

/** 이 시각 이후에 관리자가 올린 글은 대리 등록(정상 운영)으로 보고 노출 — 2026-10-19 00:00 +09:00 */
export const BUY_ADMIN_VISIBLE_FROM = "2026-10-18T15:00:00.000Z";

/**
 * 예외 허용 id — 오픈 전(10/12)에 대표 번호로 올라온 실제 의뢰(대표 확인 2026-10-20).
 * 관리자 글이라 날짜 규칙(10/19 이후)에 걸려 숨겨지지만, 시험이 아니라 진짜 의뢰라서 이 건만 노출(관리자 글 판정 안에서만 적용).
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

  const byAdmin = (!!row.member_id && ctx.adminMemberIds.has(row.member_id)) || (!!row.phone && ctx.adminPhones.has(row.phone));
  if (byAdmin) return BUY_ALWAYS_VISIBLE_IDS.includes(row.id) || created >= Date.parse(BUY_ADMIN_VISIBLE_FROM);

  if (row.member_id && ctx.testMemberIds.has(row.member_id)) return false;
  if (row.phone && ctx.excludedPhones.has(row.phone)) return false;
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
