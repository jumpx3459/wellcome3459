// 관리자 사이드바 메뉴 모델 단위 시험 — src/lib/adminMenus.ts (2026-10-29, feat/admin-sidebar)
// 실행: node --experimental-strip-types scripts/admin-menus-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { can } = await import(pathToFileURL(join(root, "src/lib/adminPerms.ts")).href);
const M = await import(pathToFileURL(join(root, "src/lib/adminMenus.ts")).href);

let failed = 0;
let total = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  total++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

eq(M.ADMIN_MENU_IDS, ["actions", "deals", "notice", "buy", "connections", "members", "partners", "bizcheck", "admins"], "메뉴 9개 id·순서");
eq(Object.keys(M.ADMIN_MENU_LABELS), [...M.ADMIN_MENU_IDS], "라벨이 모든 id에 있음");

const vis = (role: string) => M.visibleAdminMenus((p: string) => can(role, p));
eq(vis("최고관리자"), [...M.ADMIN_MENU_IDS], "최고관리자 = 9개 전부");
eq(vis("관리자"), [...M.ADMIN_MENU_IDS], "관리자 = 9개 전부(관리자 메뉴는 비밀번호 변경·이름·역할만)");
eq(vis("점핑매니저"), ["actions", "deals", "connections", "bizcheck", "admins"], "점핑매니저 = 조치·매물·거래 연결·사업자 조회·관리자(비밀번호 변경)");
eq(vis("모르는역할"), [], "모르는 역할 = 메뉴 없음");
eq(M.visibleAdminMenus(() => false), [], "권한 판정 전부 false = 메뉴 없음");

eq(M.menuFromSearch(""), null, "m 없음 → null");
eq(M.menuFromSearch("?m=buy"), "buy", "?m=buy → buy");
eq(M.menuFromSearch("?x=1&m=members"), "members", "다른 쿼리와 함께");

const all = [...M.ADMIN_MENU_IDS];
const mgr = vis("점핑매니저");
eq(M.resolveAdminMenu(null, all), { id: "actions", valid: true }, "m 없음 → actions(주소 고칠 필요 없음)");
eq(M.resolveAdminMenu("buy", all), { id: "buy", valid: true }, "알려진 값·권한 있음 → 그대로");
eq(M.resolveAdminMenu("zzz", all), { id: "actions", valid: false }, "모르는 값 → actions + 주소 교정");
eq(M.resolveAdminMenu("", all), { id: "actions", valid: false }, "빈 값 → actions + 주소 교정");
eq(M.resolveAdminMenu("members", mgr), { id: "actions", valid: false }, "권한 없는 메뉴(점핑매니저·members) → actions + 주소 교정");
eq(M.resolveAdminMenu("connections", mgr), { id: "connections", valid: true }, "점핑매니저도 거래 연결은 가능");
eq(M.resolveAdminMenu("__proto__", all), { id: "actions", valid: false }, "프로토타입 이름 방어");

eq(M.adminMenuSearch("", "buy"), "?m=buy", "쿼리 없음 → ?m=buy");
eq(M.adminMenuSearch("?m=deals", "members"), "?m=members", "m만 바꿈");
eq(M.adminMenuSearch("?x=1&m=deals", "notice"), "?x=1&m=notice", "다른 쿼리 유지");

console.log(failed === 0 ? `\nALL PASS (${total})` : `\n${failed} FAILED / ${total}`);
process.exit(failed === 0 ? 0 : 1);
