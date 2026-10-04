// "가격 협의"(price_mode) 단위 시험 — 푸시 문구(즉시·아침 공통 pushPriceParts)와 가격 접근 분기(dealPriceFields·cardDiscountPct·discountSortKey).
// 실행: node --experimental-strip-types scripts/price-mode-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
// 앱 코드는 "@/lib/…" 별칭을 쓰므로, 시험 폴더에 복사하면서 별칭을 상대 경로로 바꿔 불러옴(supabase 클라이언트는 빈 껍데기로 대체).
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "price-mode-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["priceMode", "format", "dealPriceAccess", "dealEdit", "titleGuard", "dealFields", "priceUnit"]) {
  let src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8");
  src = src.replace(/from "@\/lib\/supabase"/g, 'from "./supabase.ts"').replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
writeFileSync(join(dir, "lib", "supabase.ts"), "export const supabase = null;\n");

const pm = await import(pathToFileURL(join(dir, "lib/priceMode.ts")).href);
const da = await import(pathToFileURL(join(dir, "lib/dealPriceAccess.ts")).href);
const de = await import(pathToFileURL(join(dir, "lib/dealEdit.ts")).href);

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failed++;
    console.error("FAIL", msg);
  } else console.log("ok  ", msg);
};

// --- 푸시 본문 가격 부분
const fixed = pm.pushPriceParts({ price_mode: "fixed", deal_price: 398000, original_price: 620000, quantity_unit: "박스", price_unit: null });
ok(fixed.priceText === "398,000원/박스" && fixed.discountPrefix === "36%↓ · ", "fixed: 할인율 접두어 + 가격 (" + fixed.discountPrefix + fixed.priceText + ")");
const noOrig = pm.pushPriceParts({ deal_price: 1000, original_price: null, quantity_unit: "kg", price_unit: null });
ok(noOrig.discountPrefix === "" && noOrig.priceText === "1,000원/kg", "price_mode 칸이 없는 예전 행도 fixed, 정상가 없으면 접두어 없음");
const neg = pm.pushPriceParts({ price_mode: "negotiable", deal_price: null, original_price: null, quantity_unit: "개", price_unit: null });
ok(neg.priceText === "가격 협의" && neg.discountPrefix === "", "negotiable: 가격 협의, 접두어 없음");
const negBody = `${neg.discountPrefix}${neg.priceText}`;
ok(!/0원|NaN|null|undefined/.test(negBody), "negotiable 본문에 0원·NaN·null 없음 (" + negBody + ")");
for (const bad of [
  { price_mode: "fixed", deal_price: null, original_price: null },
  { price_mode: "fixed", deal_price: 0, original_price: 0 },
  { price_mode: "negotiable", deal_price: 5000, original_price: 9000 }, // CHECK로 생기지 않지만 방어
  { deal_price: undefined, original_price: undefined },
]) {
  const p = pm.pushPriceParts({ ...bad, quantity_unit: "개", price_unit: null });
  ok(p.priceText === "가격 협의" && !/0원/.test(p.discountPrefix + p.priceText), "가격이 없거나 0이거나 협의면 '0원' 불가: " + JSON.stringify(bad));
}

// --- 화면 가격 문구
ok(pm.dealPriceLabel({ price_mode: "negotiable", deal_price: null }) === "가격 협의", "dealPriceLabel negotiable");
ok(pm.dealPriceLabel({ deal_price: 2300, quantity_unit: "kg", price_unit: null }) === "2,300원/kg", "dealPriceLabel fixed");
ok(pm.dealPriceLabel({ price_mode: "fixed", deal_price: null }) === "가격 협의", "dealPriceLabel fixed인데 가격 null → 0원/NaN 아님");

// --- dealPriceFields (가격 숨김 vs 협의 구분)
const mem = da.dealPriceFields({ deal_price: 100, original_price: 200, price_mode: "fixed" }, false);
ok(mem.deal_price === 100 && mem.price_hidden === false && mem.price_mode === "fixed", "회원 fixed: 가격 그대로");
const guest = da.dealPriceFields({ discount_pct: 50, price_mode: "fixed" }, true);
ok(guest.price_hidden === true && guest.deal_price === 0 && guest.discount_pct === 50, "비회원 fixed: price_hidden(회원가 보기)");
const guestNeg = da.dealPriceFields({ price_mode: "negotiable", discount_pct: null }, true);
ok(guestNeg.price_hidden === false && guestNeg.deal_price === null && guestNeg.original_price === null && guestNeg.price_mode === "negotiable", "비회원 negotiable: price_hidden 아님(가격 협의 표시)");
const memNeg = da.dealPriceFields({ price_mode: "negotiable", deal_price: null, original_price: null }, false);
ok(memNeg.price_hidden === false && memNeg.deal_price === null, "회원 negotiable: 가격 null");
const legacy = da.dealPriceFields({ deal_price: 5, original_price: 9 }, false);
ok(legacy.price_mode === "fixed", "price_mode 없는 행은 fixed");

// --- 할인율·정렬 (negotiable은 0 = 뒤로)
ok(da.cardDiscountPct(guestNeg) === 0 && da.discountSortKey(guestNeg) === 0, "negotiable 할인율 0·정렬 키 0");
ok(da.cardDiscountPct(mem) === 50 && da.discountSortKey(mem) === 0.5, "fixed 할인율·정렬 키 그대로");
ok(da.cardDiscountPct({ ...guest }) === 50, "비회원 fixed 할인율은 discount_pct");
ok(da.GUEST_PRICE_COLS.includes("price_mode") && da.MEMBER_PRICE_COLS.includes("price_mode"), "조회 칸에 price_mode 포함(비회원도)");
ok(!da.GUEST_PRICE_COLS.includes("deal_price") && !da.GUEST_PRICE_COLS.includes("original_price"), "비회원 조회 칸에 가격 칸 없음(가격 숨김 유지)");

// --- 수정 검증(가격 방식 전환) — validateDealEdit·effectivePriceMode
const futureIso = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
const fixedCur = { title: "냉동 삼겹살", deal_price: 1000, original_price: 2000, price_mode: "fixed", total_qty: 10, closes_at: futureIso, stock_type: "general" };
const negCur = { ...fixedCur, deal_price: null, original_price: null, price_mode: "negotiable" };
ok(de.validateDealEdit({ priceMode: "negotiable" }, fixedCur) === null, "수정: fixed → negotiable 허용(가격 입력 없이)");
ok(de.validateDealEdit({ priceMode: "negotiable", dealPrice: 100 }, fixedCur)?.field === "dealPrice", "수정: negotiable로 바꾸며 가격을 보내면 거절");
ok(de.validateDealEdit({ priceMode: "fixed" }, negCur)?.field === "dealPrice", "수정: negotiable → fixed는 판매가 필수");
ok(de.validateDealEdit({ priceMode: "fixed", dealPrice: 3000 }, negCur) === null, "수정: negotiable → fixed + 판매가 허용");
ok(de.validateDealEdit({ priceMode: "fixed", dealPrice: 0 }, negCur)?.field === "dealPrice", "수정: negotiable → fixed 판매가 0 거절");
ok(de.validateDealEdit({ dealPrice: 100 }, negCur)?.field === "dealPrice", "수정: negotiable 매물에 가격만 보내면 거절");
ok(de.validateDealEdit({ description: "추가 설명" }, negCur) === null, "수정: negotiable 매물의 다른 칸 수정은 허용");
ok(de.validateDealEdit({ dealPrice: 1500 }, fixedCur) === null, "수정: fixed 가격 수정은 그대로");
ok(de.validateDealEdit({ priceMode: "weird" }, fixedCur)?.field === "priceMode", "수정: 알 수 없는 가격 방식 거절");
ok(de.effectivePriceMode({}, { price_mode: null }) === "fixed" && de.effectivePriceMode({}, negCur) === "negotiable" && de.effectivePriceMode({ priceMode: "fixed" }, negCur) === "fixed", "effectivePriceMode");
ok(de.dealEditWarnings({ priceMode: "negotiable" }, { ...fixedCur, description: null }).price.length === 0, "수정 경고: negotiable은 할인율 경고 없음");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
