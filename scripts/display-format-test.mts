// 표시 정리 4b-1 단위 시험 — 억 표기(formatKrwAmount·formatDealPrice·푸시 pushPriceParts·관리자 exact)·PriceText 나누기 (2026-10-08).
// 실행: node --experimental-strip-types scripts/display-format-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
// 앱 코드는 "@/lib/…" 별칭을 쓰므로, 시험 폴더에 복사하면서 별칭을 상대 경로로 바꿔 불러옴(supabase 클라이언트는 빈 껍데기로 대체).
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "display-format-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["priceMode", "format", "dealPriceAccess", "dealFields", "priceUnit"]) {
  let src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8");
  src = src.replace(/from "@\/lib\/supabase"/g, 'from "./supabase.ts"').replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
writeFileSync(join(dir, "lib", "supabase.ts"), "export const supabase = null;\n");
// PriceText는 JSX라 나누기 함수만 떼어 시험
const pt = readFileSync(join(root, "src/components/PriceText.tsx"), "utf8");
const splitSrc = pt.slice(pt.indexOf("export function splitPriceText"), pt.indexOf("export default"));
writeFileSync(join(dir, "split.ts"), splitSrc);

const fm = await import(pathToFileURL(join(dir, "lib/format.ts")).href);
const pm = await import(pathToFileURL(join(dir, "lib/priceMode.ts")).href);
const sp = await import(pathToFileURL(join(dir, "split.ts")).href);
const da = await import(pathToFileURL(join(dir, "lib/dealPriceAccess.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

// ── 억 변환
eq(fm.formatKrwAmount(99_999_999), "99,999,999원", "1억 미만은 예전 그대로");
eq(fm.formatKrwAmount(100_000_000), "1억원", "1억");
eq(fm.formatKrwAmount(120_000_000), "1억 2,000만원", "1억 2,000만");
eq(fm.formatKrwAmount(123_456_789), "1억 2,345만 6,789원", "만 미만 자리는 원까지");
eq(fm.formatKrwAmount(100_000_500), "1억 500원", "만 자리 0이면 건너뜀");
eq(fm.formatKrwAmount(1_234_500_000_000), "12,345억원", "억 자리 콤마");
eq(fm.formatKrwAmount(0), "0원", "0원");
eq(fm.formatKrwAmount(30_000), "30,000원", "보통 단가 그대로");
// ── 매물 가격(단위 포함)
eq(fm.formatDealPrice(30_000, "kg"), "30,000원/kg", "단가 1억 미만 변화 없음");
eq(fm.formatDealPrice(120_000_000, "박스", "일괄"), "1억 2,000만원(일괄)", "일괄 1억 이상");
eq(fm.formatDealPrice(150_000_000, "kg"), "1억 5,000만원/kg", "단가 1억 이상");
eq(fm.formatPriceWithUnit(250_000_000, "총액"), "2억 5,000만원(일괄)", "예전 총액도 일괄");
// ── 관리자(exact) — 예전 형식 유지
eq(fm.formatDealPrice(123_456_789, "kg", null, { exact: true }), "123,456,789원/kg", "관리자 정확한 원 단위");
eq(fm.formatPriceWithUnit(150_000_000, "일괄", { exact: true }), "150,000,000원(일괄)", "관리자 희망가 정확한 원 단위");
// ── 화면 문구·null
eq(pm.dealPriceLabel({ deal_price: 120_000_000, quantity_unit: "박스", price_unit: "일괄" }), "1억 2,000만원(일괄)", "판매가 문구");
eq(pm.dealPriceLabel({ deal_price: null, quantity_unit: "kg" }), "가격 협의", "판매가 null → 가격 협의(0원·NaN원 아님)");
// ── 푸시 본문(sendPush.ts가 쓰는 pushPriceParts)
eq(pm.pushPriceParts({ deal_price: 120_000_000, original_price: 150_000_000, quantity_unit: "박스", price_unit: "일괄" }), { discountPrefix: "20%↓ · ", priceText: "1억 2,000만원(일괄)" }, "푸시 가격 억 표기");
eq(pm.pushPriceParts({ deal_price: 30_000, original_price: null, quantity_unit: "kg" }), { discountPrefix: "", priceText: "30,000원/kg" }, "푸시 1억 미만 그대로");
// ── PriceText 나누기: "원"은 금액 쪽, 줄바꿈은 단위 앞(+ 금액 안 억·만 사이 띄어쓰기)에서만 — 숫자 중간은 안 끊김
eq(sp.splitPriceText("1억 2,000만원(일괄)"), { amount: ["1억", "2,000만원"], unit: "(일괄)" }, "PriceText 1억 2,000만원(일괄)");
eq(sp.splitPriceText("1억 2,345만 6,789원/박스"), { amount: ["1억", "2,345만", "6,789원"], unit: "/박스" }, "PriceText 만 미만 자리");
eq(sp.splitPriceText("1억원/kg"), { amount: ["1억원"], unit: "/kg" }, "PriceText 1억원");
eq(sp.splitPriceText("30,000원/kg"), { amount: ["30,000원"], unit: "/kg" }, "PriceText 1억 미만 — 원은 금액 쪽");
eq(sp.splitPriceText("30,000원"), { amount: ["30,000원"], unit: "" }, "PriceText 단위 없음");
eq(sp.splitPriceText("가격 협의"), null, "PriceText 원 없음");

// ── 정상가 숨김(줄 그은 가격·할인율 배지) — 5경우 + 정상
const row = (original_price: number | null, deal_price: number | null) => ({ original_price, deal_price, price_mode: "fixed", price_hidden: false });
for (const [name, r] of [
  ["정상가 없음", row(null, 30_000)],
  ["정상가 0", row(0, 30_000)],
  ["정상가 = 판매가", row(30_000, 30_000)],
  ["정상가 < 판매가", row(20_000, 30_000)],
  ["판매가 없음", row(50_000, null)],
  ["판매가 0(예전엔 100% 배지)", row(50_000, 0)],
] as const) {
  eq([da.showStrikePrice(r), da.cardDiscountPct(r)], [false, 0], `${name} → 줄 그은 가격·배지 없음`);
}
eq([da.showStrikePrice(row(50_000, 30_000)), da.cardDiscountPct(row(50_000, 30_000))], [true, 40], "정상가 > 판매가 → 둘 다 표시(40%)");
eq(da.showStrikePrice({ original_price: 50_000, deal_price: 30_000, price_mode: "negotiable" }), false, "협의 매물은 줄 그은 가격 없음");
eq([da.showStrikePrice({ original_price: 0, deal_price: 0, discount_pct: 30, price_hidden: true }), da.cardDiscountPct({ original_price: 0, deal_price: 0, discount_pct: 30, price_hidden: true })], [false, 30], "비회원 행은 DB 할인율 배지만");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
process.exit(failed ? 1 : 0);
