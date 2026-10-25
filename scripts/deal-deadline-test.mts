// 매물 마감 기간 선택지·검증 단위 시험 — src/lib/dealDeadline.ts + 수정 API 검증(dealEdit) + 등록 API 소스 (2026-10-24 feat/deal-deadline-options).
// 실행: node --experimental-strip-types scripts/deal-deadline-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "deadline-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["dealDeadline", "dealEdit", "titleGuard", "dealFields", "priceUnit", "priceMode", "stockType", "format"]) {
  const src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8").replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
const dd = await import(pathToFileURL(join(dir, "lib/dealDeadline.ts")).href);
const de = await import(pathToFileURL(join(dir, "lib/dealEdit.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const DAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-10-24T00:00:00Z");

// ── 선택지 6개·기본 7일
eq(dd.DEADLINE_OPTIONS.map((o: { l: string }) => o.l), ["24시간", "3일", "7일", "14일", "30일", "날짜 직접 선택"], "선택지 6개(3·12시간 제외)");
eq(dd.DEADLINE_OPTIONS.map((o: { v: string }) => o.v), ["24", "72", "168", "336", "720", "custom"], "선택지 값(시간 수 + custom)");
eq(dd.DEADLINE_DEFAULT, "168", "기본 7일");

// ── /sell 희망 기간 매핑(가장 가까운 큰 값, 협의는 미선택)
eq([3, 12, 24, 72, 168].map(dd.mapHopeHoursToChoice), ["24", "24", "24", "72", "168"], "3·12 → 24시간, 24·72·168 그대로");
eq([1, 25, 100, 200, 336, 337, 720].map(dd.mapHopeHoursToChoice), ["24", "72", "168", "336", "336", "720", "720"], "그 밖의 값은 가장 가까운 큰 선택지");
eq(dd.mapHopeHoursToChoice(721), "custom", "30일 초과 → 직접 선택");
eq([null, undefined, 0, NaN].map(dd.mapHopeHoursToChoice), ["", "", "", ""], "협의(없음) → 미선택(필수 선택)");

// ── 마감 검사: 지금 이후 · 60일 상한 · 소비기한 23:59(KST)
eq(dd.checkClosesAt(NOW + 7 * DAY, NOW), null, "7일 후 → 통과");
eq(dd.checkClosesAt(NOW + 60 * DAY, NOW), null, "정확히 60일 → 통과");
eq(dd.checkClosesAt(NOW + 60 * DAY + 1, NOW), "마감은 최대 60일까지예요", "60일 + 1ms → 막힘");
eq(dd.checkClosesAt(NOW + 61 * DAY, NOW), "마감은 최대 60일까지예요", "61일 → 막힘(등록·수정 공통)");
eq(dd.checkClosesAt(NOW, NOW), "마감 시간은 지금 이후여야 해요.", "지금 → 막힘");
eq(dd.checkClosesAt(NOW - 1000, NOW), "마감 시간은 지금 이후여야 해요.", "지난 시각 → 막힘");
eq(dd.checkClosesAt(NaN, NOW), "마감 시간이 올바르지 않아요.", "잘못된 값 → 막힘");
// 소비기한: 2026-11-01 → 23:59:59 KST = 14:59:59 UTC
const lim = Date.parse("2026-11-01T14:59:59Z");
eq(dd.expiryLimitMs("2026-11-01"), lim, "소비기한 23:59:59 KST = 14:59:59 UTC");
eq(dd.checkClosesAt(lim, NOW, "2026-11-01"), null, "마감 = 소비기한 23:59:59 → 통과");
eq(dd.checkClosesAt(lim + 1000, NOW, "2026-11-01"), "마감 일시는 소비기한(2026.11.01) 23:59 이전이어야 해요.", "마감 > 소비기한 → 막힘");
eq(dd.checkClosesAt(NOW + 30 * DAY, NOW, null), null, "소비기한 없으면(null) 검사 안 함");
eq(dd.checkClosesAt(NOW + 30 * DAY, NOW, ""), null, "소비기한 빈 값도 검사 안 함");
eq(dd.checkClosesAt(NOW + 30 * DAY, NOW, undefined), null, "소비기한 undefined도 검사 안 함");
eq(dd.checkClosesAt(NOW + 59 * DAY, NOW, "2026-12-31"), null, "소비기한이 충분히 뒤면 통과");
eq(dd.checkClosesAt(NOW + 70 * DAY, NOW, "2027-03-01"), "마감은 최대 60일까지예요", "소비기한이 멀어도 60일 상한은 적용");

// ── 수정 API(validateDealEdit)
const cur = { deal_price: 1000, price_mode: "fixed", original_price: 1000, total_qty: 100, price_unit: "개", stock_type: "general", expiry_date: null, closes_at: new Date(NOW + 3 * DAY).toISOString(), min_order_qty: null };
const f = (input: Record<string, unknown>, c: Record<string, unknown> = cur) => de.validateDealEdit(input, c, NOW);
eq(f({ closesAt: new Date(NOW + 30 * DAY).toISOString() }), null, "수정: +30일 허용");
eq(f({ closesAt: new Date(NOW + 61 * DAY).toISOString() })?.field, "closesAt", "수정: 61일 → 막힘(closesAt)");
eq(f({ closesAt: new Date(NOW + 61 * DAY).toISOString() })?.error, "마감은 최대 60일까지예요", "수정: 61일 문구");
eq(f({ closesAt: new Date(NOW - 1000).toISOString() })?.field, "closesAt", "수정: 지난 시각 → 막힘");
eq(f({ closesAt: new Date(NOW + 20 * DAY).toISOString(), expiryDate: "2026-11-01" })?.field, "closesAt", "수정: 마감 > 소비기한 → 막힘(closesAt)");
eq(f({ expiryDate: "2026-10-25" }, { ...cur, closes_at: new Date(NOW + 5 * DAY).toISOString() })?.field, "expiryDate", "수정: 소비기한만 앞당겨 마감이 그 뒤 → 막힘(expiryDate)");
eq(f({ description: "설명만" }, { ...cur, closes_at: new Date(NOW + 90 * DAY).toISOString() }), null, "수정: 마감·소비기한을 안 건드리면 예전 매물(마감 > 60일)도 다른 칸은 저장");
eq(f({ closesAt: new Date(NOW + 20 * DAY).toISOString() })?.field ?? null, null, "수정: 소비기한 없으면 소비기한 검사 안 함");

// ── 등록 API 소스에 같은 규칙
const post = readFileSync(join(root, "src/app/api/admin/deals/route.ts"), "utf8");
eq(/checkClosesAt\(Date\.parse\(closesAt\), Date\.now\(\), expiry_date\)/.test(post), true, "등록 API: checkClosesAt(마감·60일·소비기한) 호출");
eq(/bad\(closesErr, "closesAt"\)/.test(post), true, "등록 API: 위반 시 closesAt 칸 오류로 400");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
