// 관리자 회원 검색 규칙 시험 — 실행: node --experimental-strip-types scripts/admin-member-search-test.mts
// 검색어 해석(JX·숫자·문자) + 서버 로더가 거는 조건(가짜 쿼리 빌더로 기록) + 소스 규칙. 네트워크·DB 없음.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sPath = "../src/lib/adminMemberSearch.ts";
const s = (await import(sPath)) as typeof import("../src/lib/adminMemberSearch");
const lPath = "../src/lib/adminLists.ts";
const l = (await import(lPath)) as typeof import("../src/lib/adminLists");

let n = 0;
const eq = (x: unknown, y: unknown, msg: string) => {
  assert.deepEqual(x, y, msg);
  n++;
  console.log("ok  ", msg);
};
const root = join(import.meta.dirname, "..");

// 검색어 해석
for (const q of ["JX-00013", "jx-00013", "Jx00013", "jx 13", "  JX-13  ", "JX-0013"]) {
  eq(s.parseMemberSearch(q), { kind: "code", no: q.replace(/\D/g, "") ? Number(q.replace(/\D/g, "")) : null }, `JX 접두어 → member_no만: "${q}"`);
}
eq(s.parseMemberSearch("JX-abc"), { kind: "code", no: null }, "JX 뒤가 번호 모양이 아니면 code·no null(결과 없음)");
eq(s.parseMemberSearch("jx"), { kind: "code", no: null }, "JX만 입력 → no null");
eq(s.parseMemberSearch("JX-0"), { kind: "code", no: null }, "JX-0 → no null(회원번호는 1부터)");
eq(s.parseMemberSearch("00013"), { kind: "digits", digits: "00013", no: 13 }, "00013 → 번호 13 + 전화 부분 일치 '00013'");
eq(s.parseMemberSearch("13"), { kind: "digits", digits: "13", no: 13 }, "13 → 번호 13 + 전화 부분 일치");
eq(s.parseMemberSearch("7001"), { kind: "digits", digits: "7001", no: 7001 }, "7001 → 회원번호 7001과 전화 뒷자리 7001 둘 다 대상(자릿수로 가르지 않음)");
eq(s.parseMemberSearch("010-1234-7001"), { kind: "digits", digits: "01012347001", no: null }, "010-1234-7001 → 9자리 넘음: 번호로는 안 쓰고 전화만");
eq(s.parseMemberSearch("01012347001"), { kind: "digits", digits: "01012347001", no: null }, "전화 전체 번호 → 전화만");
eq(s.parseMemberSearch("123456789"), { kind: "digits", digits: "123456789", no: 123456789 }, "9자리까지는 번호도 대상");
eq(s.parseMemberSearch("1234567890"), { kind: "digits", digits: "1234567890", no: null }, "10자리부터는 번호 대상 아님(정수 범위 보호)");
eq(s.parseMemberSearch("0"), { kind: "digits", digits: "0", no: null }, "0 → 번호 대상 아님, 전화 부분 일치만");
eq(s.parseMemberSearch("덤핑상사"), { kind: "text", text: "덤핑상사" }, "문자 → 상호·닉네임(현행)");
eq(s.parseMemberSearch("상사 2호"), { kind: "text", text: "상사 2호" }, "문자+숫자 섞임 → 상호·닉네임");
eq(s.parseMemberSearch("-"), { kind: "text", text: "-" }, "하이픈만 → 숫자 검색 아님");
eq(s.parseMemberSearch("  "), { kind: "none" }, "공백만 → 검색 없음");
eq(s.parseMemberSearch(null), { kind: "none" }, "null → 검색 없음");
eq(["JX-1", "13", "상호"].map((q) => s.isServerSearch(s.parseMemberSearch(q))), [true, true, false], "서버 검색은 code·digits만");

// 서버 로더가 거는 조건 — 호출을 기록하는 가짜 쿼리 빌더
function fake() {
  const calls: Array<[string, ...unknown[]]> = [];
  let tableRows: unknown[] = [];
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "ilike", "order", "limit", "in"]) b[m] = (...a: unknown[]) => { calls.push([m, ...a]); return b; };
  b.then = (res: (v: unknown) => unknown) => res({ data: tableRows, error: null });
  const db = {
    from: (t: string) => { calls.push(["from", t]); return b; },
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: {} } } }) } },
  };
  return { db: db as never, calls, setRows: (r: unknown[]) => { tableRows = r; } };
}
const has = (calls: Array<unknown[]>, m: string, ...args: unknown[]) => calls.some((c) => c[0] === m && args.every((x, i) => c[i + 1] === x));

{
  const f = fake();
  await l.loadAdminMembers(f.db);
  eq([has(f.calls, "eq", "is_test", false), f.calls.some((c) => c[0] === "or" || c[0] === "ilike" || (c[0] === "eq" && c[1] === "member_no"))], [false, false], "opts 없음(내보내기): 테스트 계정 포함·검색 조건 없음 — 예전과 같음");
  eq(has(f.calls, "limit", 300), true, "opts 없음: 최근 300명 그대로");
}
{
  const f = fake();
  await l.loadAdminMembers(f.db, { includeTest: false });
  eq(has(f.calls, "eq", "is_test", false), true, "includeTest=false → is_test=false 조건");
}
{
  const f = fake();
  await l.loadAdminMembers(f.db, { includeTest: true });
  eq(f.calls.some((c) => c[0] === "eq" && c[1] === "is_test"), false, "includeTest=true → 테스트 계정 거르지 않음");
}
{
  const f = fake();
  await l.loadAdminMembers(f.db, { includeTest: false, search: s.parseMemberSearch("JX-00013") });
  eq([has(f.calls, "eq", "member_no", 13), f.calls.some((c) => c[0] === "or" || c[0] === "ilike")], [true, false], "JX-00013 → member_no=13 일치만(전화 검색 없음)");
}
{
  const f = fake();
  await l.loadAdminMembers(f.db, { search: s.parseMemberSearch("7001") });
  eq([has(f.calls, "eq", "member_no", 7001), has(f.calls, "ilike", "phone", "%7001%"), f.calls.some((c) => c[0] === "or")], [true, true, false], "7001 → member_no 일치 조회 + 전화 부분 일치 조회(둘 다, 번호 일치는 따로 먼저 가져와 300명 상한에 밀리지 않음)");
}
{
  const f = fake();
  await l.loadAdminMembers(f.db, { search: s.parseMemberSearch("010-1234-7001") });
  eq([has(f.calls, "ilike", "phone", "%01012347001%"), f.calls.some((c) => c[0] === "eq" && c[1] === "member_no")], [true, false], "전체 번호 → 전화 부분 일치만(번호 조회 없음)");
}
{
  const f = fake();
  const r = await l.loadAdminMembers(f.db, { search: s.parseMemberSearch("JX-abc") });
  eq([r, f.calls.length], [{ items: [] }, 0], "JX 뒤가 번호가 아니면 DB를 부르지 않고 빈 결과");
}
{
  const f = fake();
  f.setRows([{ id: "m1", phone: "01000000001", is_business: false, company_name: null, member_no: 5, referred_by: null, created_at: "2026-11-01T00:00:00Z", business_verified: false, business_license_path: null, is_test: true }, { id: "m2", phone: "01000000002", member_no: 6, created_at: "2026-11-01T00:00:00Z", is_test: null }]);
  const r = (await l.loadAdminMembers(f.db)) as { items: Array<{ id: string; is_test: boolean }> };
  eq(r.items.map((m) => [m.id, m.is_test]), [["m1", true], ["m2", false]], "목록 응답에 is_test(null은 false)");
}

// 번호 일치가 전화 일치 300건에 밀리지 않고 맨 위, 같은 회원은 한 번만
{
  const rowsOf = (id: string, no: number) => ({ id, phone: "0100000" + id, member_no: no, created_at: "2026-11-01T00:00:00Z", is_test: false });
  const calls: string[] = [];
  const mk = (rows: unknown[], tag: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "ilike", "order", "limit", "in"]) b[m] = (...a: unknown[]) => { calls.push(tag + ":" + m + ":" + a.join(",")); return b; };
    b.then = (res: (v: unknown) => unknown) => res({ data: rows, error: null });
    return b;
  };
  let nth = 0;
  const db = { from: () => (nth++ === 0 ? mk([rowsOf("OLD", 13)], "no") : nth > 2 ? mk([], "x") : mk(Array.from({ length: 300 }, (_, i) => rowsOf("P" + i, 900 + i)).concat([rowsOf("OLD", 13)]), "ph")), auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: {} } } }) } } } as never;
  const r = (await l.loadAdminMembers(db, { search: s.parseMemberSearch("13") })) as { items: Array<{ id: string }> };
  eq([r.items[0].id, r.items.length, r.items.filter((m) => m.id === "OLD").length], ["OLD", 300, 1], "번호 일치(오래된 회원)가 맨 위 · 전화 300건과 합쳐도 상한 300 · 중복 없음");
}

// 소스 규칙
{
  const list = readFileSync(join(root, "src/app/api/admin/members/route.ts"), "utf8");
  eq([/include_test"\) === "1"/.test(list), /isServerSearch\(parsed\)/.test(list)], [true, true], "목록 라우트: include_test는 '1'일 때만 포함(기본 제외), code·digits만 서버 검색");
  const exp = readFileSync(join(root, "src/app/api/admin/export/route.ts"), "utf8");
  eq([/sp\.has\("include_test"\)/.test(exp), /isServerSearch\(parsed\)/.test(exp)], [true, true], "내보내기: 조건을 안 주면 예전 동작, 주면 화면과 같은 조건");
  const page = readFileSync(join(root, "src/app/admin/page.tsx"), "utf8");
  eq([/data-member-include-test/.test(page), /data-member-test-chip/.test(page), /useState\(false\);\s*\n\s*const \[searchResults/.test(page.replace(/\r/g, ""))], [true, true, true], "화면: 테스트 포함 토글(기본 꺼짐)·'내부' 칩");
  const detail = readFileSync(join(root, "src/components/admin/MemberDetailView.tsx"), "utf8");
  eq(/can_manage && data\.view_credits\.state !== "not_verified" && <CreditGrantForm/.test(detail), true, "미인증 회원은 수동 지급 칸 숨김");
}

console.log(`\n${n}건 통과`);
