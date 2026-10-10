// 매물 등록 버튼 숨김 규칙 단위 시험 — src/lib/fabScroll.ts (2026-10-10 대표 확정: 방향과 관계없이 항상 표시, [무료 등록]이 다 보일 때만 숨김).
// 실행: node --experimental-strip-types scripts/fab-scroll-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(pathToFileURL(join(root, "src/lib/fabScroll.ts")).href);
const { fabHidden, FAB_BANNER_FULL_RATIO } = mod;

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

eq(FAB_BANNER_FULL_RATIO, 0.99, "다 보임 기준 0.99(관찰 비율 소수점 오차)");
// 배너 [무료 등록] 다 보임 / 일부 / 안 보임 × 위·아래 방향 — 규칙은 방향을 입력으로 받지 않음(방향과 관계없이 같은 결과)
const CASES: [string, number, boolean][] = [["다 보임", 1, true], ["거의 다(0.995)", 0.995, true], ["일부(0.5)", 0.5, false], ["끝만(0.98)", 0.98, false], ["안 보임·배너 없음", 0, false]];
for (const dir of ["위로", "아래로"]) {
  for (const [label, ratio, want] of CASES) eq(fabHidden(ratio), want, `[무료 등록] ${label} · ${dir} 스크롤 → ${want ? "숨김" : "표시"}`);
}
eq(fabHidden.length, 1, "규칙 입력은 보이는 비율 하나(스크롤 방향·위치·푸터 없음)");
eq(["nextFabScrollState", "FAB_SCROLL_DELTA", "FAB_SCROLL_MIN_Y"].filter((k) => k in mod), [], "예전 방향 추적 규칙 삭제됨");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
