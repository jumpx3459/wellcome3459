// 매물 등록 버튼 숨김 규칙 단위 시험 — src/lib/fabScroll.ts (2026-10-10, fix/deals-fab-visibility에서 맨 위 고정 px 기준 삭제·푸터·배너 우선순위 추가).
// 실행: node --experimental-strip-types scripts/fab-scroll-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { nextFabScrollState, fabHidden, FAB_SCROLL_DELTA } = await import(pathToFileURL(join(root, "src/lib/fabScroll.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
// 스크롤 위치를 차례로 넣어 방향 숨김 흐름을 봄
const run = (ys: number[], start = 0) => {
  let st = { hidden: false, lastY: start };
  return ys.map((y) => (st = nextFabScrollState(st, y)).hidden);
};

// ── 방향(흔들림 방지 4px 유지)
eq(FAB_SCROLL_DELTA, 4, "흔들림 기준 4px");
eq(run([100], 0), [true], "아래로 100px → 숨김");
eq(run([20], 0), [true], "맨 위 근처도 아래로 20px → 숨김(고정 px 예외 없음 — 맨 위는 배너가 맡음)");
eq(run([44], 40), [false], "4px 이동(초과 아님) → 그대로");
eq(run([45], 40), [true], "5px 이동 → 숨김");
eq(run([102, 104, 106], 100), [false, false, true], "2px씩 쌓여 6px → 숨김");
eq(run([300, 290], 0), [true, false], "아래로 숨김 → 위로 10px → 표시");
eq(run([300, 297], 0), [true, true], "위로 3px(4px 이하) → 숨김 유지");
eq(run([300, 400, 380, 500], 0), [true, true, false, true], "내림·내림·올림·내림");

// ── 최종 숨김: 배너([무료 등록] 다 보임) × 방향 × 푸터
for (const footerVisible of [false, true]) {
  for (const bannerVisible of [false, true]) {
    for (const scrollHidden of [false, true]) {
      const want = footerVisible ? false : bannerVisible ? true : scrollHidden;
      eq(fabHidden({ footerVisible, bannerVisible, scrollHidden }), want, `푸터 ${footerVisible ? "보임" : "안 보임"} · 무료 등록 ${bannerVisible ? "보임" : "안 보임"} · ${scrollHidden ? "아래로" : "위로"} → ${want ? "숨김" : "표시"}`);
    }
  }
}

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
