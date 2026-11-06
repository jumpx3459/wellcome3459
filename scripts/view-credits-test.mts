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

// ---- 클라이언트 번들 금지(소스 검사) + 호출처 0 ----
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
await ok("소스 검사: viewCreditsServer를 import하는 파일 0개(호출처 없음, 모듈 자기 자신 제외)", () => {
  const users = srcFiles.filter((p) => !rel(p).endsWith("src/lib/viewCreditsServer.ts")).filter((p) => importsIt(readFileSync(p, "utf8")));
  assert.deepEqual(users.map(rel), []);
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
