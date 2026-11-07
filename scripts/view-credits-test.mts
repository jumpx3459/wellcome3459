// 열람권 원장 서버 모듈(2-1) 시험 — 실행: node --experimental-strip-types scripts/view-credits-test.mts
// rpc는 목(네트워크·DB 없음). 클라이언트 번들 금지는 소스 검사로 확인.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
// 변수로 import — tsc(빌드)가 .ts 확장자 import를 검사하지 않게
const vPath = "../src/lib/viewCreditsServer.ts";
const v = (await import(vPath)) as typeof import("../src/lib/viewCreditsServer");

let n = 0;
const ok = (name: string, fn: () => void | Promise<void>) =>
  Promise.resolve(fn()).then(() => {
    n++;
    console.log("ok  ", name);
  });

type Reply = { data: unknown; error: { message?: string } | null };
function mockDb(reply: Reply) {
  const calls: { fn: string; args: unknown }[] = [];
  const db = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return reply;
    },
  };
  return { db: db as unknown as import("@supabase/supabase-js").SupabaseClient, calls };
}
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, re);

// ---- consumeViewCredit: 결과 매핑 3종 ----
await ok("consume: used → { used, remaining }, rpc 이름·인자", async () => {
  const m = mockDb({ data: [{ result: "used", remaining: 9 }], error: null });
  assert.deepEqual(await v.consumeViewCredit(m.db, "m1", "d1"), { result: "used", remaining: 9 });
  assert.deepEqual(m.calls, [{ fn: "view_credit_consume", args: { p_member: "m1", p_deal: "d1" } }]);
});
await ok("consume: already → { already, remaining }", async () => {
  const m = mockDb({ data: [{ result: "already", remaining: 9 }], error: null });
  assert.deepEqual(await v.consumeViewCredit(m.db, "m1", "d1"), { result: "already", remaining: 9 });
});
await ok("consume: no_credit → { no_credit, 0 }", async () => {
  const m = mockDb({ data: [{ result: "no_credit", remaining: 0 }], error: null });
  assert.deepEqual(await v.consumeViewCredit(m.db, "m1", "d1"), { result: "no_credit", remaining: 0 });
});
await ok("consume: 배열 첫 행([0])만 사용", async () => {
  const m = mockDb({ data: [{ result: "used", remaining: 4 }, { result: "no_credit", remaining: 0 }], error: null });
  assert.deepEqual(await v.consumeViewCredit(m.db, "m1", "d1"), { result: "used", remaining: 4 });
});

// ---- getViewCreditBalance ----
await ok("balance: 값 매핑(next_expires_at → nextExpiresAt), rpc 이름·인자", async () => {
  const m = mockDb({ data: [{ remaining: 10, next_expires_at: "2026-12-01T00:00:00+09:00" }], error: null });
  assert.deepEqual(await v.getViewCreditBalance(m.db, "m1"), { remaining: 10, nextExpiresAt: "2026-12-01T00:00:00+09:00" });
  assert.deepEqual(m.calls, [{ fn: "view_credit_balance", args: { p_member: "m1" } }]);
});
await ok("balance: 잔량 0이면 next null 허용", async () => {
  const m = mockDb({ data: [{ remaining: 0, next_expires_at: null }], error: null });
  assert.deepEqual(await v.getViewCreditBalance(m.db, "m1"), { remaining: 0, nextExpiresAt: null });
});

// ---- 빈 배열·rpc 오류·이상한 응답은 throw (허용·지급으로 대체하지 않음) ----
await ok("consume: 빈 배열 throw", () => rejects(v.consumeViewCredit(mockDb({ data: [], error: null }).db, "m1", "d1"), /비었어요/));
await ok("consume: null 응답 throw", () => rejects(v.consumeViewCredit(mockDb({ data: null, error: null }).db, "m1", "d1"), /비었어요/));
await ok("consume: rpc 오류 throw", () => rejects(v.consumeViewCredit(mockDb({ data: null, error: { message: "boom" } }).db, "m1", "d1"), /rpc 오류: boom/));
await ok("consume: 오류가 있으면 데이터가 있어도 throw", () =>
  rejects(v.consumeViewCredit(mockDb({ data: [{ result: "used", remaining: 9 }], error: { message: "x" } }).db, "m1", "d1"), /rpc 오류/));
await ok("consume: 모르는 result 값 throw", () => rejects(v.consumeViewCredit(mockDb({ data: [{ result: "ok", remaining: 9 }], error: null }).db, "m1", "d1"), /결과 값 오류/));
await ok("consume: remaining 이 숫자가 아니면 throw", () => rejects(v.consumeViewCredit(mockDb({ data: [{ result: "used", remaining: "9" }], error: null }).db, "m1", "d1"), /형식 오류/));
await ok("consume: remaining 음수 throw", () => rejects(v.consumeViewCredit(mockDb({ data: [{ result: "used", remaining: -1 }], error: null }).db, "m1", "d1"), /형식 오류/));
await ok("balance: 빈 배열 throw", () => rejects(v.getViewCreditBalance(mockDb({ data: [], error: null }).db, "m1"), /비었어요/));
await ok("balance: rpc 오류 throw", () => rejects(v.getViewCreditBalance(mockDb({ data: null, error: { message: "down" } }).db, "m1"), /rpc 오류: down/));
await ok("balance: remaining 형식 오류 throw", () => rejects(v.getViewCreditBalance(mockDb({ data: [{ remaining: null, next_expires_at: null }], error: null }).db, "m1"), /형식 오류/));
await ok("balance: next_expires_at 형식 오류 throw", () => rejects(v.getViewCreditBalance(mockDb({ data: [{ remaining: 3, next_expires_at: 123 }], error: null }).db, "m1"), /형식 오류/));

// ---- revokeViewCredit: 결과 매핑·rpc 인자·throw ----
for (const [result, after] of [["revoked", 1], ["not_found", 0], ["expired", 0], ["exceeds", 3], ["invalid", 0]] as const) {
  await ok(`revoke: ${result} → { ${result}, ${after} }`, async () => {
    const m = mockDb({ data: [{ result, remaining_after: after }], error: null });
    assert.deepEqual(await v.revokeViewCredit(m.db, "m1", "g1", 2, "사유", "a1"), { result, remainingAfter: after });
  });
}
await ok("revoke: rpc 이름·인자(p_member·p_grant·p_quantity·p_reason·p_admin)", async () => {
  const m = mockDb({ data: [{ result: "revoked", remaining_after: 1 }], error: null });
  await v.revokeViewCredit(m.db, "m1", "g1", 2, "사유", "a1");
  assert.deepEqual(m.calls, [{ fn: "view_credit_revoke", args: { p_member: "m1", p_grant: "g1", p_quantity: 2, p_reason: "사유", p_admin: "a1" } }]);
});
await ok("revoke: 빈 배열 throw", () => rejects(v.revokeViewCredit(mockDb({ data: [], error: null }).db, "m1", "g1", 1, "x", "a1"), /비었어요/));
await ok("revoke: rpc 오류 throw", () => rejects(v.revokeViewCredit(mockDb({ data: null, error: { message: "boom" } }).db, "m1", "g1", 1, "x", "a1"), /rpc 오류: boom/));
await ok("revoke: 모르는 result 값 throw", () => rejects(v.revokeViewCredit(mockDb({ data: [{ result: "ok", remaining_after: 1 }], error: null }).db, "m1", "g1", 1, "x", "a1"), /결과 값 오류/));
await ok("revoke: remaining_after 형식 오류 throw", () => rejects(v.revokeViewCredit(mockDb({ data: [{ result: "revoked", remaining_after: null }], error: null }).db, "m1", "g1", 1, "x", "a1"), /형식 오류/));

// ---- listViewCredits: 표 읽기(목) ----
type TableReply = Record<string, Reply>;
function mockTables(replies: TableReply) {
  const seen: string[] = [];
  const db = {
    from: (t: string) => {
      seen.push(t);
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: async () => replies[t],
      };
      return chain;
    },
  };
  return { db: db as unknown as import("@supabase/supabase-js").SupabaseClient, seen };
}
await ok("listViewCredits: grants·events 두 표를 읽어 돌려줌", async () => {
  const m = mockTables({ view_credit_grants: { data: [{ id: "g1" }], error: null }, view_credit_events: { data: [{ id: "e1" }], error: null } });
  assert.deepEqual(await v.listViewCredits(m.db, "m1"), { grants: [{ id: "g1" }], events: [{ id: "e1" }] });
  assert.deepEqual([...m.seen].sort(), ["view_credit_events", "view_credit_grants"]);
});
await ok("listViewCredits: 데이터 null이면 빈 배열", async () => {
  const m = mockTables({ view_credit_grants: { data: null, error: null }, view_credit_events: { data: null, error: null } });
  assert.deepEqual(await v.listViewCredits(m.db, "m1"), { grants: [], events: [] });
});
await ok("listViewCredits: grants 조회 오류 throw", () => rejects(v.listViewCredits(mockTables({ view_credit_grants: { data: null, error: { message: "x" } }, view_credit_events: { data: [], error: null } }).db, "m1"), /view_credit_grants 조회 오류/));
await ok("listViewCredits: events 조회 오류 throw", () => rejects(v.listViewCredits(mockTables({ view_credit_grants: { data: [], error: null }, view_credit_events: { data: null, error: { message: "y" } } }).db, "m1"), /view_credit_events 조회 오류/));

// ---- 클라이언트 번들 금지(소스 검사) ----
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const rel = (p: string) => relative(root, p).replaceAll("\\", "/");
const srcFiles = walk(join(root, "src")).filter((p) => /\.(ts|tsx)$/.test(p));
const importsIt = (text: string) => /viewCreditsServer/.test(text);
const isClientFile = (text: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(text);

await ok("소스 검사: 이 검사 자체가 파일을 찾는지(src 파일 100개 이상)", () => {
  assert.ok(srcFiles.length > 100, String(srcFiles.length));
});
await ok("소스 검사: viewCreditsServer를 import하는 파일은 관리자 회원 상세·회수 API 둘뿐(회원용 라우트 없음 — 2-3에서 추가 시 이 목록 갱신, 모듈 자기 자신 제외)", () => {
  const users = srcFiles.filter((p) => !rel(p).endsWith("src/lib/viewCreditsServer.ts")).filter((p) => importsIt(readFileSync(p, "utf8")));
  assert.deepEqual(users.map(rel).sort(), ["src/app/api/admin/members/[id]/route.ts", "src/app/api/admin/members/[id]/view-credits/revoke/route.ts"]);
});
await ok("소스 검사: 회수 API는 SQL 함수(revokeViewCredit)만 쓰고 원장 표를 직접 쓰지 않음 · SUPER 전용", () => {
  const text = readFileSync(join(root, "src/app/api/admin/members/[id]/view-credits/revoke/route.ts"), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(/revokeViewCredit\(/.test(text) && /requirePerm\(auth\.admin, "viewCreditManage"\)/.test(text));
  assert.ok(!/\.insert\(|\.update\(|\.from\("view_credit/.test(text));
});
await ok("소스 검사: 관리자 상세 API는 view_credit_balance·view_credit_consume(지급·차감 부수효과)를 호출하지 않고 listViewCredits만 씀", () => {
  const text = readFileSync(join(root, "src/app/api/admin/members/[id]/route.ts"), "utf8");
  assert.ok(/listViewCredits/.test(text));
  const code = text.replace(/\/\/.*$/gm, ""); // 주석 속 설명은 제외
  assert.ok(!/getViewCreditBalance|consumeViewCredit|view_credit_balance|view_credit_consume|view_credit_ensure/.test(code));
});
await ok("소스 검사: listViewCredits는 읽기만(insert·update·rpc 없음)", () => {
  const text = readFileSync(join(root, "src/lib/viewCreditsServer.ts"), "utf8");
  const body = text.slice(text.indexOf("export async function listViewCredits"));
  assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(body));
});
await ok("소스 검사: \"use client\" 파일 / src/components/** / src/app/**/page.tsx 가 import하지 않음", () => {
  const bad = srcFiles.filter((p) => {
    const r = rel(p);
    const text = readFileSync(p, "utf8");
    const guarded = isClientFile(text) || r.startsWith("src/components/") || /^src\/app\/.*page\.tsx$/.test(r);
    return guarded && importsIt(text);
  });
  assert.deepEqual(bad.map(rel), []);
});
await ok("소스 검사: 검사 규칙이 실제로 잡아내는지(가짜 입력)", () => {
  assert.ok(isClientFile('"use client";\nimport x from "@/lib/viewCreditsServer";'));
  assert.ok(isClientFile('// 주석\n"use client";\n'));
  assert.ok(!isClientFile('import "x";\n// "use client"\n'));
  assert.ok(importsIt('import { consumeViewCredit } from "@/lib/viewCreditsServer";'));
});
await ok("소스 검사: 모듈이 클라이언트를 만들지 않음(createClient·getAdminDb 없음)", () => {
  const text = readFileSync(join(root, "src/lib/viewCreditsServer.ts"), "utf8");
  assert.ok(!/createClient\s*\(/.test(text) && !/getAdminDb/.test(text));
  assert.ok(!isClientFile(text)); // 주석 속 글귀가 아니라 파일 맨 앞 지시문만 본다
});

console.log(`\nALL PASS (${n})`);
