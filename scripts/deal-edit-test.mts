// 매물 수정(= 등록 폼 재사용) 검증 단위 시험 — src/lib/dealEdit.ts 2026-10-23 확장(카테고리·지역·총수량·단위·재고 유형·보관·재고 수량).
// 실행: node --experimental-strip-types scripts/deal-edit-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "deal-edit-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["dealEdit", "titleGuard", "dealFields", "priceUnit", "priceMode", "stockType", "format"]) {
  const src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8").replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
const de = await import(pathToFileURL(join(dir, "lib/dealEdit.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const NOW = Date.parse("2026-10-23T00:00:00Z");
const cur = { deal_price: 1000, price_mode: "fixed", original_price: 1000, total_qty: 100, price_unit: "개", stock_type: "general", expiry_date: null, closes_at: "2026-10-30T00:00:00Z", min_order_qty: 10 };
const f = (input: Record<string, unknown>, c: Record<string, unknown> = cur) => de.validateDealEdit(input, c, NOW)?.field ?? null;

// 재고 수량 ≤ 총수량
eq(f({ remainingQty: 100 }), null, "재고 수량 = 총수량 → 허용");
eq(f({ remainingQty: 101 }), "remainingQty", "재고 수량 > 총수량 → 막음");
eq(f({ remainingQty: 0 }), null, "재고 수량 0 → 허용(품절)");
eq(f({ remainingQty: -1 }), "remainingQty", "재고 수량 음수 → 막음");
eq(f({ remainingQty: 1.5 }), "remainingQty", "재고 수량 소수 → 막음");
eq(f({ remainingQty: 150, totalQty: 200 }), null, "총수량을 같이 늘리면 새 총수량 기준");
eq(f({ remainingQty: 100, totalQty: 50 }), "remainingQty", "총수량을 줄이면 새 총수량 기준으로 막음");
eq(de.validateDealEdit({ remainingQty: 101 }, cur, NOW)?.error, "재고 수량은 재고 총수량(100)보다 클 수 없어요.", "문구");
// 총수량·최소 주문량
eq(f({ totalQty: 0 }), "totalQty", "총수량 0 → 막음");
eq(f({ totalQty: 5 }), "minOrderQty", "총수량을 저장된 MOQ(10)보다 작게 → 막음");
eq(f({ totalQty: 5, minOrderQty: 3 }), null, "총수량 5 + MOQ 3 → 허용");
eq(f({ minOrderQty: 101 }), "minOrderQty", "MOQ > 총수량 → 막음(기존 규칙)");
eq(f({ totalQty: 5, priceUnit: "일괄" }), null, "일괄이면 MOQ 검사 없음");
eq(f({ description: "설명만" }, { ...cur, min_order_qty: 500 }), null, "예전 데이터(MOQ>총수량)라도 다른 칸만 고치면 허용");
// 단가 단위·재고 유형·보관
eq(f({ priceUnit: "상자" }), "priceUnit", "알 수 없는 단가 단위 → 막음");
eq(f({ priceUnit: "박스" }), null, "단가 단위 박스 → 허용");
eq(f({ stockType: "weird" }), "stockType", "알 수 없는 재고 유형 → 막음");
eq(f({ stockType: "near_expiry" }), "expiryDate", "소비기한 임박으로 바꾸는데 소비기한 없음 → 막음");
eq(f({ stockType: "near_expiry", expiryDate: "2026-11-01" }), null, "소비기한 임박 + 소비기한 → 허용");
eq(f({ expiryDate: "" }, { ...cur, stock_type: "near_expiry", expiry_date: "2026-11-01" }), "expiryDate", "소비기한 임박 매물에서 소비기한 비우기 → 막음");
eq(f({ storageType: "상온" }), null, "보관 조건 상온 → 허용");
eq(f({ storageType: "얼음" }), "storageType", "알 수 없는 보관 조건 → 막음");
// 카테고리·지역(이름 검증은 서버가 DB에서)
eq(f({ category: "" }), "category", "카테고리 비움 → 막음");
eq(f({ region: "  " }), "region", "지역 비움 → 막음");
eq(f({ category: "수산물", region: "부산", location: "부산항", quantityUnit: "박스", packageUnit: "20kg", origin: "국내산", spec: "특", pid: "A1" }), null, "나머지 칸은 그대로 허용");
// 기존 규칙 회귀
eq(f({ title: "" }), "title", "매물명 비움 → 막음(기존)");
eq(f({ closesAt: "2026-10-22T00:00:00Z" }), "closesAt", "지난 마감 → 막음(기존)");
eq(f({ priceMode: "negotiable", dealPrice: 100 }), "dealPrice", "가격 협의에 가격 → 막음(기존)");
eq(f({ closesAt: "2026-12-01T00:00:00Z", expiryDate: "2026-11-01" }), "closesAt", "마감 > 소비기한 23:59 → 막음(기존)");

// PATCH는 알림을 보내지 않음 — 수정 API 소스가 sendPush를 가져오지 않는다
const route = readFileSync(join(root, "src/app/api/admin/deals/manage/route.ts"), "utf8");
eq(/from "[^"]*sendPush"|from "web-push"|sendDealPush\s*\(/.test(route), false, "manage PATCH 소스에 알림 발송 코드 없음");
eq(/DEAL_EDIT_KEYS/.test(route), true, "manage PATCH가 허용 목록(DEAL_EDIT_KEYS)을 씀");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
