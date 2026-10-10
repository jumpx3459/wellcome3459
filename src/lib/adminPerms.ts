// 2026-10-10 관리자 권한표 (claude/22 확정본 + 10/10 결정) — 서버(requirePerm)·관리자 화면 공용 한 곳. 다른 모듈 import 없음.
// 화면에서 숨기는 것은 편의일 뿐, 막는 것은 반드시 서버(API마다 requirePerm).
//   · "own"(점핑매니저): 전체가 아니라 자기 건만 — 거래 연결은 배정된 건, 비공개 판매자는 담당 매물
//     (담당 매물 = 이 관리자에게 배정된 연결의 매물 + deal_seller_private.created_by_admin_id가 본인인 매물)
//   · 회원 정지·KPI 제외 설정은 화면 없음(SQL 유지)

export const ADMIN_ROLES = ["최고관리자", "관리자", "점핑매니저"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

type Access = boolean | "own";
const SUPER: Record<AdminRole, Access> = { 최고관리자: true, 관리자: false, 점핑매니저: false };
const STAFF: Record<AdminRole, Access> = { 최고관리자: true, 관리자: true, 점핑매니저: false };
const ALL: Record<AdminRole, Access> = { 최고관리자: true, 관리자: true, 점핑매니저: true };
const OWN: Record<AdminRole, Access> = { 최고관리자: true, 관리자: true, 점핑매니저: "own" };

export const ADMIN_PERMS = {
  dealEdit: ALL, //               매물 등록·수정·마감 (deals POST, deals/manage GET·PATCH)
  dealDelete: SUPER, //           매물 영구 삭제
  sellerPrivate: OWN, //          비공개 판매자 실제 업체명 (deals/manage/seller, connections/[id]/seller)
  sellerRequests: ALL, //         판매 신청 처리 (seller-requests, 승인 = deals POST, 사업자 조회)
  connections: OWN, //            거래 연결 목록·단계·번호 보기
  connectionAssign: STAFF, //     연결 배정 (connections/[id]/assign)
  members: STAFF, //              회원 목록 — 최고관리자 전체 번호, 관리자 가린 번호 + [번호 보기](감사 기록)
  memberPhoneFull: SUPER, //      회원 목록에 전체 번호 그대로
  leads: STAFF, //                리드 목록·변경 (interests)
  buyRequests: STAFF, //          재고 문의
  businessLicense: STAFF, //      사업자 등록증 열람·인증 승인
  partnerApprove: SUPER, //       공식 파트너 지정 (partner-requests PATCH)
  partnerView: STAFF, //          파트너 신청 목록·실적 (partner-requests GET, partners-overview)
  noticeSend: SUPER, //           긴급 공지 푸시 (notices POST)
  noticeManage: STAFF, //         공지 목록·마감 (notices GET·PATCH)
  dashboard: STAFF, //            대시보드·KPI (dashboard-metrics, kpi-daily, category-kpis, feature-waitlist)
  adminList: STAFF, //            관리자 목록 — 관리자는 이름·역할만
  adminManage: SUPER, //          관리자 임명·해제·역할 변경
  export: SUPER, //               데이터 내보내기(CSV)
  changePassword: ALL, //         비밀번호 변경(본인)
} as const satisfies Record<string, Record<AdminRole, Access>>;
export type AdminPerm = keyof typeof ADMIN_PERMS;

/** 이 역할이 이 권한을 쓸 수 있는지 — "own"(자기 건만)도 true. 자기 건 거르기는 API가 따로 함 */
export function can(role: AdminRole | string | null | undefined, perm: AdminPerm): boolean {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) return false;
  return ADMIN_PERMS[perm][role as AdminRole] !== false;
}

/** 자기 건만인지(점핑매니저의 거래 연결·비공개 판매자) */
export function ownOnly(role: AdminRole | string | null | undefined, perm: AdminPerm): boolean {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) return false;
  return ADMIN_PERMS[perm][role as AdminRole] === "own";
}

/** 권한이 있는 역할 목록 — 403 응답의 required 칸 */
export function rolesFor(perm: AdminPerm): AdminRole[] {
  return ADMIN_ROLES.filter((r) => ADMIN_PERMS[perm][r] !== false);
}
