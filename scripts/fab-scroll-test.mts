// 매물 등록 버튼 스크롤 숨김 규칙 단위 시험 — src/lib/fabScroll.ts (2026-10-10).
// 실행: node --experimental-strip-types scripts/fab-scroll-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { nextFabScrollState, FAB_SCROLL_DELTA, FAB_SCROLL_MIN_Y } = await import(pathToFileURL(join(root, "src/lib/fabScroll.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
// 스크롤 위치를 차례로 넣어 숨김 상태 흐름을 봄
const run = (ys: number[], start = 0) => {
  let st = { hidden: false, lastY: start };
  return ys.map((y) => (st = nextFabScrollState(st, y)).hidden);
};

eq([FAB_SCROLL_DELTA, FAB_SCROLL_MIN_Y], [4, 40], "기준 4px · 40px");
eq(run([100], 0), [true], "아래로 100px → 숨김");
eq(run([30], 0), [false], "아래로 내려도 scrollY 40 이하 → 표시");
eq(run([44], 40), [false], "4px 이동(초과 아님) → 그대로");
eq(run([45], 40), [true], "5px 이동 · scrollY 45 → 숨김");
eq(run([102, 104, 106], 100), [false, false, true], "2px씩 쌓여 6px → 숨김");
eq(run([300, 290], 0), [true, false], "아래로 숨김 → 위로 10px → 표시");
eq(run([300, 297], 0), [true, true], "위로 3px(4px 이하) → 숨김 유지");
eq(run([300, 20], 0), [true, false], "맨 위 근처로 올라옴 → 표시");
eq(run([300, 400, 380, 500], 0), [true, true, false, true], "내림·내림·올림·내림");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
