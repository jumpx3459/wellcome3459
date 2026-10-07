// 추천 코드(ref) 기기 저장 단위 시험 — src/lib/refStore.ts (2026-10-07).
// 실행: node --experimental-strip-types scripts/ref-store-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "ref-store-"));
mkdirSync(join(dir, "lib"), { recursive: true });
writeFileSync(join(dir, "lib", "refStore.ts"), readFileSync(join(root, "src/lib/refStore.ts"), "utf8"));
// localStorage 대역 (브라우저 아님)
const mem = new Map<string, string>();
let blocked = false;
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => { if (blocked) throw new Error("blocked"); return mem.get(k) ?? null; },
  setItem: (k: string, v: string) => { if (blocked) throw new Error("blocked"); mem.set(k, v); },
  removeItem: (k: string) => { if (blocked) throw new Error("blocked"); mem.delete(k); },
};
const r = await import(pathToFileURL(join(dir, "lib/refStore.ts")).href);

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failed++; console.error("FAIL", msg); } else console.log("ok  ", msg);
};
const DAY = 24 * 60 * 60 * 1000;

ok(r.saveRefFromSearch("?ref=ABC234") === true && r.getSavedRef() === "ABC234", "?ref= 저장 → 읽기");
ok(r.saveRefFromSearch("?x=1&ref=ZZZ999&y=2") === true && r.getSavedRef() === "ZZZ999", "최근 링크가 이전 저장값을 덮어씀");
ok(r.saveRefFromSearch("?x=1") === false && r.getSavedRef() === "ZZZ999", "ref 없는 주소는 저장값을 건드리지 않음");
ok(r.saveRefFromSearch("?ref=<script>") === false && r.getSavedRef() === "ZZZ999", "이상한 값은 저장 안 함");
ok(r.saveRefFromSearch("?ref=") === false, "빈 ref는 저장 안 함");
ok(r.resolveSignupRef("URL123") === "URL123", "가입: URL ref가 저장값보다 우선");
ok(r.resolveSignupRef(null) === "ZZZ999", "가입: URL ref 없으면 저장값");
ok(r.resolveSignupRef("bad value!") === "ZZZ999", "가입: URL ref가 이상하면 저장값");
ok(r.getSavedRef(Date.now() + 29 * DAY) === "ZZZ999", "29일 뒤에도 유효");
ok(r.getSavedRef(Date.now() + 31 * DAY) === null && r.getSavedRef() === null, "30일 지나면 만료·삭제");
r.saveRefFromSearch("?ref=KEEP22");
ok(r.withSavedRef("https://www.dumpingjumping.com/signup?returnTo=%2Fdeals%2F1") === "https://www.dumpingjumping.com/signup?returnTo=%2Fdeals%2F1&ref=KEEP22", "외부 전환 주소: ref 없으면 저장값을 붙이고 returnTo 유지");
ok(r.withSavedRef("https://www.dumpingjumping.com/signup?ref=URL999") === "https://www.dumpingjumping.com/signup?ref=URL999", "외부 전환 주소: URL에 ref가 있으면 그대로");
r.clearSavedRef();
ok(r.getSavedRef() === null && r.resolveSignupRef(null) === null, "가입 뒤 삭제 → 저장값 없음");
ok(r.withSavedRef("https://www.dumpingjumping.com/login") === "https://www.dumpingjumping.com/login", "저장값 없으면 주소 그대로");
mem.set("dj_ref", "{깨진 json");
ok(r.getSavedRef() === null, "깨진 저장값은 무시");
blocked = true;
ok(r.saveRefFromSearch("?ref=ABC234") === false && r.getSavedRef() === null && r.resolveSignupRef("URL123") === "URL123", "저장소가 막혀도 오류 없이 동작(URL ref는 그대로 사용)");

console.log(failed ? `\n실패 ${failed}건` : "\n전부 통과");
process.exit(failed ? 1 : 0);
