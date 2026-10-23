// 최소 주문량(MOQ) 표시·검증 단위 시험 — src/lib/moq.ts (formatMoq·moqUnit) + 등록·수정 서버 검증 (2026-10-23 feat/admin-media-viewer).
// 실행: node --experimental-strip-types scripts/moq-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "moq-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["moq", "dealEdit", "titleGuard", "dealFields", "priceUnit", "priceMode", "stockType", "format"]) {
  const src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8").replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
const m = await import(pathToFileURL(join(dir, "lib/moq.ts")).href);
const de = await import(pathToFileURL(join(dir, "lib/dealEdit.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

// formatMoq — 단위는 그 매물의 quantity_unit
eq(m.formatMoq(5, "개"), "최소 5개 이상", "단위 개");
eq(m.formatMoq(5, "박스"), "최소 5박스 이상", "단위 박스");
eq(m.formatMoq(30, "kg"), "최소 30kg 이상", "단위 kg");
eq(m.formatMoq(2, "파렛트"), "최소 2파렛트 이상", "단위 파렛트");
eq(m.formatMoq(10, null), "최소 10개 이상", "단위 null(기존 매물) → 개");
eq(m.formatMoq(10, undefined), "최소 10개 이상", "단위 undefined → 개");
eq(m.formatMoq(10, ""), "최소 10개 이상", "단위 빈 값 → 개");
eq(m.formatMoq(10, "  "), "최소 10개 이상", "단위 공백 → 개");
eq(m.formatMoq(5, "박스", "20kg 박스"), "최소 5박스 이상 · 포장 20kg 박스", "포장 단위 있으면 · 포장 …");
eq(m.formatMoq(5, "박스", "  "), "최소 5박스 이상", "포장 단위 공백 → 안 붙임");
eq(m.formatMoq(5, "박스", null), "최소 5박스 이상", "포장 단위 null → 안 붙임");
eq(m.formatMoq(null, "박스", "20kg"), null, "MOQ 없음(null) → null");
eq(m.formatMoq(0, "박스"), null, "MOQ 0 → null");
eq(m.moqUnit("kg"), "kg", "moqUnit kg");
eq(m.moqUnit(null), "개", "moqUnit null → 개");

// 수정 API 검증 — 1 이상 정수, ≤ 총수량
const NOW = Date.parse("2026-10-23T00:00:00Z");
const cur = { deal_price: 1000, price_mode: "fixed", original_price: 1000, total_qty: 100, price_unit: "개", stock_type: "general", expiry_date: null, closes_at: "2026-10-30T00:00:00Z", min_order_qty: null };
const f = (input: Record<string, unknown>) => de.validateDealEdit(input, cur, NOW)?.field ?? null;
eq(f({ minOrderQty: 10 }), null, "수정: MOQ 10 → 허용");
eq(f({ minOrderQty: 100 }), null, "수정: MOQ = 총수량 → 허용");
eq(f({ minOrderQty: 101 }), "minOrderQty", "수정: MOQ > 총수량 → 막음");
eq(f({ minOrderQty: 0 }), "minOrderQty", "수정: MOQ 0 → 막음");
eq(f({ minOrderQty: 2.5 }), "minOrderQty", "수정: MOQ 소수 → 막음");
eq(f({ minOrderQty: -3 }), "minOrderQty", "수정: MOQ 음수 → 막음");
eq(f({ minOrderQty: null }), null, "수정: MOQ 비움(null) → 허용");
eq(de.validateDealEdit({ minOrderQty: 2.5 }, cur, NOW)?.error, "최소 주문량은 1 이상의 정수로 입력해주세요.", "문구");

// 등록 API 소스에 같은 규칙(정수·≤ 총수량)이 있음
const post = readFileSync(join(root, "src/app/api/admin/deals/route.ts"), "utf8");
eq(/minOrderQty != null && \(!isPositive\(minOrderQty\) \|\| !Number\.isInteger\(minOrderQty\)\)/.test(post), true, "등록 API: MOQ 1 이상 정수 검사");
eq(/minOrderQty > totalQty/.test(post), true, "등록 API: MOQ ≤ 총수량 검사");

// 회원 상세가 한 헬퍼로 표시(예전 '최소주문 ${…}${…|| "개"}' 직접 조립 없음)
const detail = readFileSync(join(root, "src/app/deals/[id]/page.tsx"), "utf8");
eq((detail.match(/formatMoq\(/g) ?? []).length, 3, "회원 상세 3곳이 formatMoq 사용");
eq(/최소주문 \$\{/.test(detail), false, "회원 상세에 직접 조립한 '최소주문' 문구 없음");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
