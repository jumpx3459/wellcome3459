// 수량·단가 단위 목록 + 직접 입력 검사 단위 시험 — src/lib/units.ts (2026-11-02 feat/unit-custom).
// 실행: node --experimental-strip-types scripts/units-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "units-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["units", "priceUnit", "format", "homeCard"]) {
  const src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8").replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
const U = await import(pathToFileURL(join(dir, "lib/units.ts")).href);
const P = await import(pathToFileURL(join(dir, "lib/priceUnit.ts")).href);
const F = await import(pathToFileURL(join(dir, "lib/format.ts")).href);
const H = await import(pathToFileURL(join(dir, "lib/homeCard.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error(`FAIL ${msg}\n  got : ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
  } else console.log(`ok   ${msg}`);
};

// ── 목록
eq(U.SELL_QUANTITY_UNITS, ["개", "박스", "kg", "톤", "파렛트", "세트", "L", "톤백", "드럼", "평", "㎡"], "총수량 단위 목록: 기존 7종 + 톤백·드럼·평·㎡");
eq(U.SELL_PRICE_UNITS, ["개", "박스", "kg", "톤", "파렛트", "세트", "L", "일괄", "톤백", "드럼", "평", "㎡"], "단가 단위 목록: 기존 8종(…일괄) 끝에 톤백·드럼·평·㎡");
eq(U.CUSTOM_UNIT_LABEL, "기타(직접 입력)", "맨 끝 선택지 내부 값(바뀌지 않음)");
eq(U.CUSTOM_UNIT_TEXT, "직접 입력", "맨 끝 선택지 보이는 글자");
eq(P.DEAL_PRICE_UNITS, U.SELL_PRICE_UNITS, "priceUnit.ts 목록 = units.ts 한 곳");
eq(F.PRICE_UNITS, ["개", "박스", "kg", "톤", "파렛트", "세트", "L", "일괄"], "찾습니다 단가 단위 목록은 값 변화 없음(8종)");
eq(P.LUMP_SUM, "일괄", "일괄 값");

// ── 직접 입력 검사
const ok = (v: unknown) => U.checkCustomUnit(v).ok;
eq(U.checkCustomUnit("  묶음  "), { ok: true, value: "묶음" }, "앞뒤 공백 제거");
eq(ok("묶음"), true, "한글 2자 허용");
eq(ok("가나다라마바"), true, "6자 허용");
eq(ok("가나다라마바사"), false, "7자 거절");
eq(ok("   가나다라마바   "), true, "공백 포함 8자여도 제거 뒤 6자면 허용");
eq(ok(""), false, "빈 값 거절");
eq(ok("   "), false, "공백만 거절");
eq(ok("123"), false, "숫자만 거절");
eq(ok("%"), false, "기호만 거절");
eq(ok("1-2"), false, "숫자·기호만 거절");
eq(ok("20kg"), true, "숫자 + 글자는 허용");
eq(ok("m²"), true, "글자 + 기호는 허용");
eq(ok("봉\n지"), false, "줄바꿈(\\n) 거절");
eq(ok("봉\r지"), false, "줄바꿈(\\r) 거절");
eq(ok("봉지\n"), false, "끝 줄바꿈도 거절");
eq(ok("봉\t지"), false, "탭 등 제어문자 거절");
eq(ok("톤 백"), true, "중간 공백 허용");
eq(ok(null), false, "null 거절");
eq(ok(5), false, "숫자 타입 거절");
eq(U.checkCustomUnit("𠮷𠮷𠮷𠮷𠮷𠮷").ok, true, "6글자(대체쌍 글자) 허용 — 글자 수는 문자 단위");

// ── 총수량 단위
eq(U.checkQuantityUnit("박스"), { ok: true, value: "박스" }, "총수량: 목록 단어는 그대로");
eq(U.checkQuantityUnit(" 박스 "), { ok: true, value: "박스" }, "총수량: 목록 단어(공백 제거)");
eq(U.checkQuantityUnit("㎡").ok, true, "총수량: ㎡ 허용(목록)");
eq(U.checkQuantityUnit("일괄").ok, false, "총수량: 일괄 거절");
eq(U.checkQuantityUnit(" 일괄 ").ok, false, "총수량: 공백 낀 일괄도 거절");
eq(U.checkQuantityUnit("봉지"), { ok: true, value: "봉지" }, "총수량: 직접 입력 허용");
eq(U.checkQuantityUnit("12").ok, false, "총수량: 숫자만 거절");
eq(U.normalizeQuantityUnit(undefined), { ok: true, value: "개" }, "서버: 비어 있으면 기본 개");
eq(U.normalizeQuantityUnit(""), { ok: true, value: "개" }, "서버: 빈 문자열은 기본 개");
eq(U.normalizeQuantityUnit("가나다라마바사").ok, false, "서버: 7자 거절");
eq(U.normalizeQuantityUnit("일괄").ok, false, "서버: 일괄 거절");

// ── 단가 단위
eq(U.checkPriceUnitValue("일괄"), { ok: true, value: "일괄" }, "단가: 일괄은 목록 값");
eq(U.checkPriceUnitValue("드럼"), { ok: true, value: "드럼" }, "단가: 드럼");
eq(U.checkPriceUnitValue("롤"), { ok: true, value: "롤" }, "단가: 직접 입력 허용");
eq(U.checkPriceUnitValue("롤\n").ok, false, "단가: 줄바꿈 거절");
eq(U.checkPriceUnitValue("1234").ok, false, "단가: 숫자만 거절");
eq(P.isDealPriceUnit("상자"), true, "isDealPriceUnit: 직접 입력 규칙 통과 값 허용");
eq(P.isDealPriceUnit("12"), false, "isDealPriceUnit: 숫자만 거절");

// ── 폼 상태
const Q = U.SELL_QUANTITY_UNITS;
eq(U.initUnitState("톤백", Q, "개"), { unit: "톤백", other: false }, "열기: 목록 단위는 그 값");
eq(U.initUnitState("봉지", Q, "개"), { unit: "봉지", other: true }, "열기: 목록에 없으면 기타 + 입력칸에 그 값");
eq(U.initUnitState(null, Q, "개"), { unit: "개", other: false }, "열기: 비어 있으면 기본");
eq(U.pickUnit(U.CUSTOM_UNIT_LABEL, { unit: "개", other: false }), { unit: "", other: true }, "기타 선택: 입력칸 열림·값 비움");
eq(U.pickUnit(U.CUSTOM_UNIT_LABEL, { unit: "봉지", other: true }), { unit: "봉지", other: true }, "기타 다시 선택: 입력 중인 글 유지");
eq(U.pickUnit("kg", { unit: "봉지", other: true }), { unit: "kg", other: false }, "목록 선택: 기타 해제");
eq(U.typeUnit("박스", Q), { unit: "박스", other: false }, "목록 단어 직접 입력 → 목록 값으로 자동 전환");
eq(U.typeUnit(" 톤백 ", Q), { unit: "톤백", other: false }, "공백 낀 목록 단어도 전환");
eq(U.typeUnit("봉", Q), { unit: "봉", other: true }, "입력 중에는 기타 유지");
eq(U.typeUnit("일괄", Q), { unit: "일괄", other: true }, "총수량 목록에 없는 일괄은 기타로 남아 검사에서 거절");
eq(U.typeUnit("일괄", U.SELL_PRICE_UNITS), { unit: "일괄", other: false }, "단가에서는 일괄이 목록 값");
eq(U.unitSelectValue({ unit: "봉지", other: true }), "기타(직접 입력)", "선택 상자 값: 기타");
eq(U.unitSelectValue({ unit: "kg", other: false }), "kg", "선택 상자 값: 목록 값");
eq(U.canAutoMatchUnits({ unit: "개", other: false }, { unit: "개", other: false }), true, "J: 둘 다 목록이면 자동 맞춤");
eq(U.canAutoMatchUnits({ unit: "봉", other: true }, { unit: "개", other: false }), false, "J: 하나라도 직접 입력이면 자동 맞춤 끔");
eq(U.canAutoMatchUnits({ unit: "개", other: false }, { unit: "봉", other: true }), false, "J: 반대쪽도 끔");

// ── 표시(카드·상세 글자): 직접 입력·추가 단위가 그대로 이어 붙음
eq(H.regionQtyText("경기", 30, "톤백"), "경기 · 30톤백", "홈 카드: 경기 · 30톤백");
eq(H.qtyRegionText(30, "톤백", "경기"), "30톤백 · 경기", "/deals 카드: 30톤백 · 경기");
eq(H.regionQtyText("경기", 1234, "가나다라마바"), "경기 · 1,234가나다라마바", "홈 카드: 6자 단위");
eq(F.formatDealPrice(12000, "톤백", "드럼"), "12,000원/드럼", "가격 줄: 12,000원/드럼");
eq(F.formatDealPrice(12000, "개", "사아자차카타"), "12,000원/사아자차카타", "가격 줄: 6자 단위");
eq(F.formatDealPrice(12000, "개", null), "12,000원/개", "단가 단위 없으면 수량 단위");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
