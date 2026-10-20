// "찾습니다" 노출 판정 단위 시험 — src/lib/buyExposure.ts (2026-10-20 feat/buy-request-list).
// 실행: node --experimental-strip-types scripts/buy-exposure-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// 다른 시험과 같게 경로 문자열로 불러옴 — buyExposure.ts는 다른 모듈 import 없음
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = await import(pathToFileURL(join(root, "src/lib/buyExposure.ts")).href);
const N = await import(pathToFileURL(join(root, "src/lib/buyNotice.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

const now = Date.parse("2026-10-20T03:00:00Z"); // 10/20 낮 12시 KST
const ADMIN_PHONE = "01011112222";
const ctx = {
  now,
  testMemberIds: new Set(["m-test"]),
  excludedPhones: new Set(["01099990000"]),
  adminMemberIds: new Set(["m-admin"]),
  adminPhones: new Set([ADMIN_PHONE]),
};
const row = (o: Record<string, unknown>) => ({
  id: "x1", contacted: true, outcome: "pending", created_at: "2026-10-20T01:00:00Z", member_id: null, phone: "01055556666", ...o,
});
const vis = (o: Record<string, unknown>) => L.isBuyVisible(row(o), ctx);

eq(L.BUY_VISIBLE_DAYS, N.BUY_NOTICE_DAYS, "30일 기준이 띠 규칙(buyNotice)과 같음");
eq(L.BUY_ALWAYS_VISIBLE_IDS, ["5c33d493-f77a-476e-a559-38018c795f5f"], "예외 허용 id 상수");
eq(L.BUY_ADMIN_VISIBLE_FROM, new Date("2026-10-19T00:00:00+09:00").toISOString(), "관리자 글 노출 시작 = 2026-10-19 00:00 KST");

// 요청서 시험 ①~⑥
eq(vis({ phone: ADMIN_PHONE, created_at: "2026-10-20T01:00:00Z" }), true, "① 대표 번호 10/20 건 노출");
eq(vis({ id: "5c33d493-f77a-476e-a559-38018c795f5f", phone: ADMIN_PHONE, created_at: "2026-10-12T01:00:00Z" }), true, "② 대표 번호 10/12 예외 id 노출");
eq(vis({ id: "other", phone: ADMIN_PHONE, created_at: "2026-10-12T01:00:00Z" }), false, "③ 대표 번호 10/12 다른 건 숨김");
eq(vis({ id: "other", phone: ADMIN_PHONE, created_at: "2026-10-18T10:00:00Z" }), false, "③ 대표 번호 10/18(KST) 건 숨김");
eq(vis({ member_id: "m-test" }), false, "④ is_test 회원 숨김");
eq(vis({ contacted: false }), false, "⑤ contacted=false 숨김");
eq(vis({ contacted: null }), false, "⑤ contacted=null 숨김");
eq(vis({ outcome: "matched" }), false, "⑥ matched 숨김");
eq(vis({ outcome: "no_match" }), false, "⑥ no_match 숨김");

// 경계·그 밖
eq(vis({ phone: ADMIN_PHONE, created_at: "2026-10-18T14:59:59Z" }), false, "관리자 글: 10/19 00:00 KST 1초 전 숨김");
eq(vis({ phone: ADMIN_PHONE, created_at: "2026-10-18T15:00:00Z" }), true, "관리자 글: 10/19 00:00 KST 정각 노출");
eq(vis({ member_id: "m-admin", phone: "", created_at: "2026-10-20T01:00:00Z" }), true, "관리자 회원 id(번호 없음) 10/20 노출");
eq(vis({ member_id: "m-admin", phone: "", created_at: "2026-10-15T01:00:00Z" }), false, "관리자 회원 id 10/15 숨김");
eq(vis({ phone: "01099990000" }), false, "제외 번호 표 숨김");

// 판정 순서(관리자 글 먼저): 관리자 회원이 is_test=true여도 관리자 규칙 적용
const ctxT = { ...ctx, testMemberIds: new Set(["m-test", "m-admin"]) }; // m-admin = is_test=true인 관리자(대표) 회원
const visT = (o: Record<string, unknown>) => L.isBuyVisible(row(o), ctxT);
eq(visT({ member_id: "m-admin", phone: "", created_at: "2026-10-20T01:00:00Z" }), true, "⑦ is_test 관리자 회원 + 10/20 글 → 노출");
eq(visT({ id: "5c33d493-f77a-476e-a559-38018c795f5f", member_id: "m-admin", phone: "", created_at: "2026-10-12T01:00:00Z" }), true, "⑧ is_test 관리자 회원 + 예외 id(10/12) → 노출");
eq(visT({ member_id: "m-test", phone: "", created_at: "2026-10-20T01:00:00Z" }), false, "⑨ is_test 일반 회원 + 10/20 글 → 숨김");
eq(visT({ id: "other", member_id: "m-admin", phone: "", created_at: "2026-10-18T10:00:00Z" }), false, "⑩ is_test 관리자 회원 + 10/18 글(예외 아님) → 숨김");
eq(visT({ member_id: "m-admin", phone: ADMIN_PHONE, created_at: "2026-10-20T01:00:00Z" }), true, "관리자 회원 + 관리자 번호 + is_test → 노출");
eq(L.isBuyVisible(row({ phone: "01099990000", member_id: "m-admin", created_at: "2026-10-20T01:00:00Z" }), { ...ctx, adminPhones: new Set(["01099990000"]) }), true, "번호가 제외 번호 표에도 있는 관리자 글 → 관리자 규칙 우선 노출");
eq(visT({ member_id: "m-admin", phone: "", contacted: false, created_at: "2026-10-20T01:00:00Z" }), false, "is_test 관리자도 연락 전이면 숨김(공통 조건)");
eq(vis({}), true, "일반 글(연락함·진행중·최근) 노출");
eq(vis({ created_at: "2026-09-20T01:00:00Z" }), false, "30일 지난 글 숨김");
eq(vis({ created_at: "2026-09-21T03:00:00Z" }), true, "딱 29일 23시간 글 노출");
eq(vis({ id: "5c33d493-f77a-476e-a559-38018c795f5f", phone: ADMIN_PHONE, contacted: false, created_at: "2026-10-12T01:00:00Z" }), false, "예외 id도 연락 전이면 숨김");
eq(vis({ id: "5c33d493-f77a-476e-a559-38018c795f5f", phone: ADMIN_PHONE, outcome: "matched", created_at: "2026-10-12T01:00:00Z" }), false, "예외 id도 매칭 끝났으면 숨김");
eq(vis({ created_at: "잘못된 날짜" }), false, "날짜 형식 오류 숨김");

eq(L.UUID_RE.test("5c33d493-f77a-476e-a559-38018c795f5f"), true, "uuid 형식 통과");
eq(["", "abc", "5c33d493-f77a-476e-a559-38018c795f5", "5c33d493-f77a-476e-a559-38018c795f5f'", "../x"].map((v) => L.UUID_RE.test(v)), [false, false, false, false, false], "uuid 형식 아님 거부");
eq(L.daysAgoLabel("2026-10-20T01:00:00Z", now), "오늘", "오늘 표시");
eq(L.daysAgoLabel("2026-10-17T01:00:00Z", now), "3일 전", "3일 전 표시");

if (failed) {
  console.error(`\n실패 ${failed}건`);
  process.exit(1);
}
console.log("\n전부 통과");
