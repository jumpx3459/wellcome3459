// /deals 첫 화면 정리 판정 단위 시험 — src/lib/dealsCompact.ts (2026-10-13 feat/deals-first-screen-compact)
// 실행: node --experimental-strip-types scripts/deals-compact-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = await import(pathToFileURL(join(root, "src/lib/dealsCompact.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

eq(C.DEALS_FILTER_MIN, 15, "기준 15건");
eq(C.isDealsCompact(0), true, "0건(불러오는 중 포함) → 숨김");
eq(C.isDealsCompact(14), true, "14건 → 숨김");
eq(C.isDealsCompact(15), false, "15건 → 고르기·정렬 줄 표시");
eq(C.isDealsCompact(30), false, "30건 → 표시");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
