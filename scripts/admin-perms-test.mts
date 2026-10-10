// 관리자 권한표 단위 시험 — src/lib/adminPerms.ts (2026-10-10, claude/22 확정본 + 10/10 결정)
// 실행: node --experimental-strip-types scripts/admin-perms-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
// 서버 강제(API별 200/403·자기 건 거르기)는 화면 시험(가짜 Supabase)으로 따로 확인 — PROGRESS 기록 참고.
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ADMIN_PERMS, can, ownOnly, rolesFor } = await import(pathToFileURL(join(root, "src/lib/adminPerms.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const R = ["최고관리자", "관리자", "점핑매니저"];
const row = (perm: string) => R.map((r) => (ownOnly(r, perm) ? "own" : can(r, perm) ? "O" : "X")).join(" ");

// 권한표 그대로 (최고관리자 관리자 점핑매니저)
const TABLE: Record<string, string> = {
  dealEdit: "O O O",
  dealDelete: "O X X",
  sellerPrivate: "O O own",
  sellerRequests: "O O O",
  connections: "O O own",
  connectionAssign: "O O X",
  members: "O O X",
  memberPhoneFull: "O X X",
  leads: "O O X",
  buyRequests: "O O X",
  businessLicense: "O O X",
  partnerApprove: "O X X",
  partnerView: "O O X",
  noticeSend: "O X X",
  noticeManage: "O O X",
  dashboard: "O O X",
  adminList: "O O X",
  adminManage: "O X X",
  export: "O X X",
  changePassword: "O O O",
};
for (const [perm, want] of Object.entries(TABLE)) eq(row(perm), want, perm);
eq(Object.keys(ADMIN_PERMS).sort(), Object.keys(TABLE).sort(), "권한 이름이 표와 같음(빠진 것·남는 것 없음)");
eq([can(null, "dealEdit"), can("", "dealEdit"), can("손님", "dealEdit")], [false, false, false], "모르는 역할·빈 값 → 거부");
eq(rolesFor("connectionAssign"), ["최고관리자", "관리자"], "403 응답 required = 허용 역할");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
