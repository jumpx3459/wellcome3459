// 2026-10-29 관리자 사이드바(feat/admin-sidebar) — 메뉴 9개의 id·순서·권한별 노출·주소의 ?m= 읽기/쓰기. 화면 코드가 아닌 순수 함수만(시험은 scripts/admin-menus-test.mts).
// 메뉴 구성은 대표 확정본: 조치 필요 / 매물 / 긴급 공지 / 구매요청 / 거래 연결 / 회원 / 점핑파트너 / 사업자 조회 / 관리자.
// 권한 없는 블록만 있는 메뉴는 숨김(화면 숨김은 편의일 뿐 — 막는 것은 서버 API).

import type { AdminPerm } from "./adminPerms";

export const ADMIN_MENU_IDS = ["actions", "deals", "notice", "buy", "connections", "members", "partners", "bizcheck", "admins"] as const;
export type AdminMenuId = (typeof ADMIN_MENU_IDS)[number];

export const DEFAULT_ADMIN_MENU: AdminMenuId = "actions";
export const ADMIN_MENU_PARAM = "m";

export const ADMIN_MENU_LABELS: Record<AdminMenuId, string> = {
  actions: "조치 필요",
  deals: "매물",
  notice: "긴급 공지",
  buy: "구매요청",
  connections: "거래 연결",
  members: "회원",
  partners: "점핑파트너",
  bizcheck: "사업자 조회",
  admins: "관리자",
};

// 메뉴 안 블록의 권한(하나라도 쓸 수 있으면 메뉴 노출). 비밀번호 변경은 전 역할이라 관리자 메뉴·조치·매물·사업자 조회·거래 연결(자기 건)은 항상 보임.
const MENU_PERMS: Record<AdminMenuId, AdminPerm[]> = {
  actions: ["dealEdit"], // 조치 타일은 역할별로 알아서 걸러짐 — 전 역할 노출
  deals: ["dealEdit", "sellerRequests"],
  notice: ["noticeManage", "noticeSend"],
  buy: ["buyRequests", "members"], // [+ 찾습니다 대신 등록]은 members 권한
  connections: ["connections"],
  members: ["leads", "members"],
  partners: ["partnerView"],
  bizcheck: ["sellerRequests"],
  admins: ["changePassword", "adminList"],
};

export function isAdminMenuId(v: unknown): v is AdminMenuId {
  return typeof v === "string" && (ADMIN_MENU_IDS as readonly string[]).includes(v);
}

/** 이 권한 판정(can)으로 보이는 메뉴 id 목록(정해진 순서) */
export function visibleAdminMenus(perm: (p: AdminPerm) => boolean): AdminMenuId[] {
  return ADMIN_MENU_IDS.filter((id) => MENU_PERMS[id].some((p) => perm(p)));
}

/** 주소 검색 문자열("?m=buy&x=1")에서 m 값 읽기 — 없으면 null */
export function menuFromSearch(search: string): string | null {
  try {
    return new URLSearchParams(search).get(ADMIN_MENU_PARAM);
  } catch {
    return null;
  }
}

/** 주소의 값 → 쓸 메뉴. 모르는 값·권한 없는 값·없음은 조치 필요(actions). valid=false면 주소를 replaceState로 고쳐야 함(없음은 valid=true — 고치지 않아도 되는 첫 방문) */
export function resolveAdminMenu(raw: string | null, visible: readonly AdminMenuId[]): { id: AdminMenuId; valid: boolean } {
  if (raw === null) return { id: DEFAULT_ADMIN_MENU, valid: true };
  if (isAdminMenuId(raw) && visible.includes(raw)) return { id: raw, valid: true };
  return { id: DEFAULT_ADMIN_MENU, valid: false };
}

/** 같은 주소에서 m만 바꾼 검색 문자열(다른 쿼리는 유지). "?m=buy" 형태 */
export function adminMenuSearch(currentSearch: string, id: AdminMenuId): string {
  const sp = new URLSearchParams(currentSearch);
  sp.set(ADMIN_MENU_PARAM, id);
  return `?${sp.toString()}`;
}
