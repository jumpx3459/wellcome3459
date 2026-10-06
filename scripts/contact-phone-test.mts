// 연락처 번호 검증 단위 시험 — checkContactPhone (화면 buy·sell + 서버 /api/buy-requests·seller-requests 가 같이 씀, 2026-10-06).
// 실행: node --experimental-strip-types scripts/contact-phone-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "contact-phone-"));
mkdirSync(join(dir, "lib"), { recursive: true });
const rewrite = (src: string) => src.replace(/from "(?:@\/lib|\.)\/([A-Za-z]+)"/g, 'from "./$1.ts"');
for (const f of ["auth", "phone"]) writeFileSync(join(dir, "lib", `${f}.ts`), rewrite(readFileSync(join(root, "src/lib", `${f}.ts`), "utf8")));
// auth.ts가 부르는 Supabase·디버그 로그는 이 시험과 무관 — 빈 대역
writeFileSync(join(dir, "lib", "supabase.ts"), "export const supabase = null; export const isSupabaseConfigured = false;\n");
writeFileSync(join(dir, "lib", "debugLog.ts"), "export function debugLog(_m: string) {}\n");
const auth = await import(pathToFileURL(join(dir, "lib/auth.ts")).href);

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failed++;
    console.error("FAIL", msg);
  } else console.log("ok  ", msg);
};
const check = auth.checkContactPhone as (v: string) => string | null;

for (const bad of ["010-000-0000", "010-1234-567", "011-123-4567", "011-1234-5678", "016-123-4567", "0101234567", "010-1234-56789"]) {
  ok(check(bad) === auth.CONTACT_MOBILE_ERROR, `${bad} → 실패 "${auth.CONTACT_MOBILE_ERROR}"`);
}
for (const good of ["010-1234-5678", "01012345678", "+82 10-1234-5678", "02-123-4567", "02-1234-5678", "031-123-4567", "064-1234-5678", "070-1234-5678", "1588-1234", "1644-1234"]) {
  ok(check(good) === null, `${good} → 통과`);
}
for (const bad of ["", "123", "02-12-345", "030-123-4567", "070-123-4567", "1234-5678"]) {
  ok(check(bad) === auth.CONTACT_PHONE_ERROR, `${JSON.stringify(bad)} → 실패 "${auth.CONTACT_PHONE_ERROR}"`);
}
ok(auth.isValidContactPhone("010-1234-5678") === true && auth.isValidContactPhone("010-000-0000") === false, "isValidContactPhone = checkContactPhone 통과 여부");

// 화면·서버가 같은 함수를 쓰는지 (다른 검사가 끼어들면 결과가 달라짐)
for (const f of ["src/app/buy/page.tsx", "src/app/sell/page.tsx", "src/app/api/buy-requests/route.ts", "src/app/api/seller-requests/route.ts"]) {
  const src = readFileSync(join(root, f), "utf8");
  ok(/checkContactPhone\(contactPhone\)/.test(src) && !/isValidContactPhone\(/.test(src), `${f} → checkContactPhone(contactPhone)만 사용`);
}

console.log(failed ? `\n${failed}건 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
