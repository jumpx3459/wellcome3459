// /sell 판매 신청 가격 방식 검증 단위 시험 — resolveSellerRequestPrice(서버 /api/seller-requests 가 그대로 씀).
// 실행: node --experimental-strip-types scripts/seller-price-mode-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "seller-price-mode-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["priceMode", "format"]) {
  const src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8").replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
const pm = await import(pathToFileURL(join(dir, "lib/priceMode.ts")).href);

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failed++;
    console.error("FAIL", msg);
  } else console.log("ok  ", msg);
};
const r = pm.resolveSellerRequestPrice;

// fixed — 희망가 필수
let x = r({ priceMode: "fixed", hopePrice: 5000, originalPrice: 8000 });
ok(x.ok && x.priceMode === "fixed" && x.hopePrice === 5000 && x.originalPrice === 8000, "fixed + 희망가·정상가 → 그대로");
x = r({ priceMode: "fixed", hopePrice: 5000 });
ok(x.ok && x.originalPrice === null, "fixed + 정상가 없음 → 정상가 null(선택)");
x = r({ priceMode: "fixed", hopePrice: null });
ok(!x.ok && x.field === "hopePrice", "fixed + 희망가 null → 400 hopePrice");
x = r({ priceMode: "fixed", hopePrice: 0 });
ok(!x.ok && x.field === "hopePrice", "fixed + 희망가 0 → 400");
x = r({ priceMode: "fixed", hopePrice: "5000" });
ok(!x.ok && x.field === "hopePrice", "fixed + 희망가 문자열 → 400");
x = r({ priceMode: "fixed", hopePrice: Number.NaN });
ok(!x.ok && x.field === "hopePrice", "fixed + NaN → 400");

// 옛 화면(priceMode 없음) — fixed 와 같음
x = r({ hopePrice: 3000 });
ok(x.ok && x.priceMode === "fixed" && x.hopePrice === 3000, "priceMode 없음 + 희망가 → fixed");
x = r({});
ok(!x.ok && x.field === "hopePrice", "priceMode 없음 + 희망가 없음 → 400 (예전과 같음)");
x = r({ priceMode: null, hopePrice: 3000 });
ok(x.ok && x.priceMode === "fixed", "priceMode null → fixed");

// negotiable — 희망가 없이 통과, 값은 무조건 null
x = r({ priceMode: "negotiable", hopePrice: null, originalPrice: null });
ok(x.ok && x.priceMode === "negotiable" && x.hopePrice === null && x.originalPrice === null, "negotiable + 가격 없음 → 통과, 둘 다 null");
x = r({ priceMode: "negotiable" });
ok(x.ok && x.hopePrice === null, "negotiable + 가격 칸 자체 없음 → 통과");
x = r({ priceMode: "negotiable", hopePrice: 9999, originalPrice: 12000 });
ok(x.ok && x.hopePrice === null && x.originalPrice === null, "negotiable + 가격을 보내도 → null로 버림(DB CHECK 위반 방지)");

// 모르는 값 — 400
for (const bad of ["Fixed", "negotiate", "", 1, true, {}, []]) {
  x = r({ priceMode: bad, hopePrice: 5000 });
  ok(!x.ok && x.field === "priceMode", `priceMode=${JSON.stringify(bad)} → 400 priceMode`);
}

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
