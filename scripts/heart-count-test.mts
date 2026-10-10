// 공개 하트 규칙 단위 시험 — src/lib/heartCount.ts (2026-10-09 PR 4a).
// 실행: node --experimental-strip-types scripts/heart-count-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
// DB 함수 deal_heart_counts의 셈(시작일 전/후·is_test 제외·비회원 리드)은 PGlite(WASM Postgres)로 따로 시험함 — PROGRESS 4a 기록 참고.
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { HEART_COUNT_START, HEART_MIN_SHOW, heartToShow, heartMap } = await import(pathToFileURL(join(root, "src/lib/heartCount.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

// 시작일 = 2026-10-19 00:00 KST
eq(new Date(HEART_COUNT_START).toISOString(), "2026-10-18T15:00:00.000Z", "집계 시작 = 2026-10-18T15:00:00Z");
eq(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(HEART_COUNT_START)), "2026-10-19 00:00", "한국 시각 10/19 00:00");
// 3 미만 숨김
eq(HEART_MIN_SHOW, 3, "표시 기준 3");
eq([0, 1, 2].map(heartToShow), [null, null, null], "0·1·2 → 숨김");
eq([3, 4, 120].map(heartToShow), [3, 4, 120], "3 이상 → 그대로");
eq([null, undefined, NaN].map(heartToShow), [null, null, null], "모름(조회 실패·SQL 전) → 숨김");
// 결과 → 맵
eq(heartMap([{ deal_id: "a", heart_count: 3 }, { deal_id: "b", heart_count: 0 }]), { a: 3, b: 0 }, "deal_id → 수");
eq(heartMap(null), {}, "결과 없음 → 빈 맵");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
process.exit(failed ? 1 : 0);
