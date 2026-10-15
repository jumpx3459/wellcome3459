// SNS 유입(UTM) 기기 저장 단위 시험 — src/lib/utmStore.ts (2026-10-15).
// 실행: node --experimental-strip-types scripts/utm-store-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "utm-store-"));
mkdirSync(join(dir, "lib"), { recursive: true });
writeFileSync(join(dir, "lib", "utmStore.ts"), readFileSync(join(root, "src/lib/utmStore.ts"), "utf8"));
const mem = new Map<string, string>();
let blocked = false;
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => { if (blocked) throw new Error("blocked"); return mem.get(k) ?? null; },
  setItem: (k: string, v: string) => { if (blocked) throw new Error("blocked"); mem.set(k, v); },
  removeItem: (k: string) => { if (blocked) throw new Error("blocked"); mem.delete(k); },
};
const u = await import(pathToFileURL(join(dir, "lib/utmStore.ts")).href);

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failed++; console.error("FAIL", msg); } else console.log("ok  ", msg);
};
const DAY = 24 * 60 * 60 * 1000;
const clear = () => mem.clear();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// 허용 값
for (const s of ["blog", "youtube", "insta", "kakao_ch", "kakao_open", "cafe", "band", "linkedin"]) {
  clear();
  ok(u.saveUtmFromSearch(`?utm_source=${s}&utm_medium=social&utm_campaign=w1`) === true && u.getSavedUtm()?.source === s, `source=${s} 저장`);
}
clear();
ok(u.saveUtmFromSearch("?utm_source=blog&utm_medium=social&utm_campaign=w1") === true, "전체 링크 저장");
ok(same(u.getSavedUtm(), { source: "blog", medium: "social", campaign: "w1" }), "저장값 = blog/social/w1");
ok(same(u.savedUtmColumns(), { utm_source: "blog", utm_medium: "social", utm_campaign: "w1" }), "가입용 컬럼 3개");

// 거부 값
clear();
ok(u.saveUtmFromSearch("?utm_source=facebook&utm_medium=social&utm_campaign=w1") === false && u.getSavedUtm() === null, "허용 안 된 source는 통째로 저장 안 함");
ok(u.saveUtmFromSearch("?utm_source=BLOG") === false, "source 대문자 거부");
ok(u.saveUtmFromSearch("?utm_source=blog%20") === false, "source 공백 거부");
ok(u.saveUtmFromSearch("?utm_medium=social&utm_campaign=w1") === false && u.getSavedUtm() === null, "source 없이 medium·campaign만은 저장 안 함");
ok(u.saveUtmFromSearch("?utm_source=<script>") === false, "이상한 source 거부");
ok(u.saveUtmFromSearch("") === false && u.saveUtmFromSearch("?x=1") === false, "UTM 없는 주소는 저장 안 함");
clear();
u.saveUtmFromSearch("?utm_source=blog&utm_medium=email&utm_campaign=W1");
ok(same(u.getSavedUtm(), { source: "blog", medium: null, campaign: null }), "medium(social 외)·campaign(대문자) 거부 → source만 저장");
for (const bad of ["", "a b", "w1!", "한글", "a".repeat(33), "W1", "w1;drop", "w1<"]) {
  clear();
  u.saveUtmFromSearch(`?utm_source=cafe&utm_campaign=${encodeURIComponent(bad)}`);
  ok(u.getSavedUtm()?.campaign === null, `campaign 거부: "${bad.slice(0, 12)}"`);
}
for (const good of ["w1", "launch_2026-10", "a", "a".repeat(32), "0", "-_-"]) {
  clear();
  u.saveUtmFromSearch(`?utm_source=cafe&utm_campaign=${good}`);
  ok(u.getSavedUtm()?.campaign === good, `campaign 허용: "${good.slice(0, 12)}${good.length > 12 ? "…" : ""}"`);
}
clear();
u.saveUtmFromSearch("?utm_source=cafe");
ok(same(u.savedUtmColumns(), { utm_source: "cafe" }), "medium·campaign 없으면 source 컬럼만");
clear();
ok(same(u.savedUtmColumns(), {}), "저장값 없으면 빈 객체");

// 첫 접촉 유지
clear();
u.saveUtmFromSearch("?utm_source=blog&utm_campaign=w1");
ok(u.saveUtmFromSearch("?utm_source=youtube&utm_campaign=w2") === false && u.getSavedUtm()?.source === "blog" && u.getSavedUtm()?.campaign === "w1", "유효한 값이 있으면 덮어쓰지 않음(첫 접촉)");
ok(u.saveUtmFromSearch("?x=1") === false && u.getSavedUtm()?.source === "blog", "UTM 없는 주소는 저장값을 건드리지 않음");

// 30일 만료
const t0 = Date.now();
clear();
u.saveUtmFromSearch("?utm_source=blog", t0);
ok(u.getSavedUtm(t0 + 29 * DAY)?.source === "blog", "29일 뒤에도 유효");
ok(u.saveUtmFromSearch("?utm_source=insta", t0 + 29 * DAY) === false && u.getSavedUtm(t0 + 29 * DAY)?.source === "blog", "29일째엔 새 값으로 안 바뀜");
ok(u.getSavedUtm(t0 + 31 * DAY) === null && mem.size === 0, "30일 지나면 만료·삭제");
u.saveUtmFromSearch("?utm_source=blog", t0);
ok(u.saveUtmFromSearch("?utm_source=insta&utm_campaign=n2", t0 + 31 * DAY) === true && u.getSavedUtm(t0 + 31 * DAY)?.source === "insta", "만료 뒤엔 새 값 저장");
clear();
mem.set("dj_utm", JSON.stringify({ s: "blog", at: t0 + 10 * DAY }));
ok(u.getSavedUtm(t0) === null && mem.size === 0, "미래 시각(시계 조작) 값은 버림");

// 깨진 저장값
clear();
mem.set("dj_utm", "{not json");
ok(u.getSavedUtm() === null, "깨진 JSON → null");
ok(u.saveUtmFromSearch("?utm_source=band") === true && u.getSavedUtm()?.source === "band", "깨진 값이 있어도 새로 저장");
clear();
mem.set("dj_utm", JSON.stringify({ s: "evil", at: Date.now() }));
ok(u.getSavedUtm() === null, "저장값의 source가 허용 밖이면 버림");
mem.set("dj_utm", JSON.stringify({ s: "blog", m: "x", c: "BAD", at: Date.now() }));
ok(same(u.getSavedUtm(), { source: "blog", medium: null, campaign: null }), "저장값 medium·campaign이 허용 밖이면 null로");

// 삭제
clear();
u.saveUtmFromSearch("?utm_source=blog");
u.clearSavedUtm();
ok(u.getSavedUtm() === null, "가입 성공 후 삭제");

// 외부 브라우저 주소
clear();
u.saveUtmFromSearch("?utm_source=kakao_ch&utm_medium=social&utm_campaign=w1");
ok(u.withSavedUtm("https://www.dumpingjumping.com/signup") === "https://www.dumpingjumping.com/signup?utm_source=kakao_ch&utm_medium=social&utm_campaign=w1", "외부 주소에 UTM 3개 붙음");
ok(u.withSavedUtm("https://www.dumpingjumping.com/signup?returnTo=%2Fdeals%2F1&ref=ABC") === "https://www.dumpingjumping.com/signup?returnTo=%2Fdeals%2F1&ref=ABC&utm_source=kakao_ch&utm_medium=social&utm_campaign=w1", "기존 쿼리(returnTo·ref) 유지하고 뒤에 붙음");
ok(u.withSavedUtm("https://www.dumpingjumping.com/?utm_source=blog") === "https://www.dumpingjumping.com/?utm_source=blog", "주소에 이미 utm이 있으면 그대로");
ok(u.withSavedUtm("not a url") === "not a url", "주소가 이상하면 그대로");
clear();
ok(u.withSavedUtm("https://www.dumpingjumping.com/signup") === "https://www.dumpingjumping.com/signup", "저장값 없으면 그대로");
clear();
u.saveUtmFromSearch("?utm_source=cafe");
ok(u.withSavedUtm("https://www.dumpingjumping.com/signup") === "https://www.dumpingjumping.com/signup?utm_source=cafe", "source만 있으면 source만 붙음");

// 저장소 오류
blocked = true;
ok(u.saveUtmFromSearch("?utm_source=blog") === false, "저장소 막힘: 저장 false(예외 없음)");
ok(u.getSavedUtm() === null, "저장소 막힘: 읽기 null");
ok(same(u.savedUtmColumns(), {}), "저장소 막힘: 가입용 컬럼 빈 객체(가입 정상 진행)");
u.clearSavedUtm();
ok(u.withSavedUtm("https://x.test/signup") === "https://x.test/signup", "저장소 막힘: 외부 주소 그대로");
blocked = false;

if (failed) { console.error(`\n${failed}건 실패`); process.exit(1); }
console.log("\n전부 통과");
