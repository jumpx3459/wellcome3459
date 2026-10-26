// 찾습니다 공급 제안 단위 시험 — src/lib/supplyProposal.ts (서버 /api/seller-requests 가 그대로 씀).
// 실행: node --experimental-strip-types scripts/seller-supply-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "seller-supply-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["supplyProposal", "buyExposure"]) {
  const src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8").replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
const sp = await import(pathToFileURL(join(dir, "lib/supplyProposal.ts")).href);

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failed++;
    console.error("FAIL", msg);
  } else console.log("ok  ", msg);
};

// isSupplyRef — body.buyRef 가 "있는지"만
ok(sp.isSupplyRef("11111111-1111-4111-8111-111111111111") === true, "isSupplyRef: uuid → true");
ok(sp.isSupplyRef("abc") === true, "isSupplyRef: 형식 불량 문자열도 true(유효성 무관)");
ok(sp.isSupplyRef(123) === true && sp.isSupplyRef({}) === true, "isSupplyRef: 문자열이 아니어도 값이 있으면 true");
ok(sp.isSupplyRef("") === false && sp.isSupplyRef(null) === false && sp.isSupplyRef(undefined) === false && sp.isSupplyRef(false) === false, "isSupplyRef: 빈 문자열·null·undefined·false → false(일반 신청)");

// supplyRefId — uuid 형식만
const U = "11111111-1111-4111-8111-111111111111";
ok(sp.supplyRefId(U) === U, "supplyRefId: uuid → 그대로");
ok(sp.supplyRefId(`  ${U.toUpperCase()} `) === U, "supplyRefId: 공백·대문자 → 정리");
ok(sp.supplyRefId("abc") === null && sp.supplyRefId("") === null && sp.supplyRefId(null) === null && sp.supplyRefId(5) === null, "supplyRefId: 형식 불량·비문자열 → null");
ok(sp.supplyRefId(`${U}'; drop table x;--`) === null, "supplyRefId: 덧붙인 문자열 → null");

// resolveSupplyPrice — 유효 숫자>0 → fixed, 그 외 → negotiable, 정상가 항상 null, 400(ok:false) 없음
let x = sp.resolveSupplyPrice({ hopePrice: 5000 });
ok(x.ok && x.priceMode === "fixed" && x.hopePrice === 5000 && x.originalPrice === null, "단가 5000 → fixed·5000·정상가 null");
for (const [label, v] of [["undefined", undefined], ["null", null], ["0", 0], ["-5", -5], ["NaN", NaN], ["Infinity", Infinity], ["'abc'", "abc"], ["'abc5000'", "abc5000"], ["'-5000'", "-5000"], ["'0x10'", "0x10"], ["'1e3'", "1e3"], ["'0'(문자열)", "0"], ["' '", " "], ["''", ""]] as const) {
  x = sp.resolveSupplyPrice({ hopePrice: v });
  ok(x.ok === true && x.priceMode === "negotiable" && x.hopePrice === null && x.originalPrice === null, `단가 ${label} → negotiable·희망가 null`);
}
for (const v of ["5000", "5,000", " 5 000 ", 5000]) {
  x = sp.resolveSupplyPrice({ hopePrice: v });
  ok(x.ok && x.priceMode === "fixed" && x.hopePrice === 5000 && x.originalPrice === null, `단가 ${JSON.stringify(v)} → fixed·5000`);
}
x = sp.resolveSupplyPrice({ hopePrice: "1,234.5" });
ok(x.ok && x.priceMode === "fixed" && x.hopePrice === 1234.5, "단가 '1,234.5' → fixed·1234.5");
x = sp.resolveSupplyPrice({});
ok(x.ok === true && x.priceMode === "negotiable", "단가 칸 없음 → negotiable");
// 정상가를 넘겨도 무시(입력 타입에 없지만 서버가 body를 그대로 넘기지 않음 — 반환은 항상 null)
x = sp.resolveSupplyPrice({ hopePrice: 3000, originalPrice: 9000 } as never);
ok(x.originalPrice === null, "정상가가 섞여 와도 결과 정상가 null");

// supplyPushBody — 공개 칸 이름만, 그 외·null 은 "찾는 상품"
ok(sp.supplyPushBody("국내산 갈치 20kg 박스") === "국내산 갈치 20kg 박스", "푸시 본문: 공개 이름 그대로");
ok(sp.supplyPushBody(null) === "찾는 상품" && sp.supplyPushBody(undefined) === "찾는 상품" && sp.supplyPushBody("") === "찾는 상품" && sp.supplyPushBody("   ") === "찾는 상품", "푸시 본문: null·빈 이름 → 찾는 상품");
ok(sp.supplyPushBody("갈치   20kg\n박스") === "갈치 20kg 박스", "푸시 본문: 공백 정리");
ok(sp.supplyPushBody("가".repeat(100)).length === 60, "푸시 본문: 60자 제한");
ok(sp.SUPPLY_PUSH_TITLE === "📦 새 공급 제안", "푸시 제목");

console.log(failed ? `\n${failed}건 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
