// 마감임박(6h) 판정 단위 시험 — src/lib/dealSoon.ts isDeadlineSoon(2026-10-29 공용 lib로 이동) · src/lib/admin/needsAction.ts deadlineChipLabel·isDeadlinePassed (2026-10-22 feat/admin-deadline-soon-highlight).
// 실행: node --experimental-strip-types scripts/deadline-soon-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const N0 = await import(pathToFileURL(join(root, "src/lib/admin/needsAction.ts")).href);
const D = await import(pathToFileURL(join(root, "src/lib/dealSoon.ts")).href);
const N = { ...N0, isDeadlineSoon: D.isDeadlineSoon };

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const now = Date.parse("2026-10-22T03:00:00.000Z");
const at = (ms: number) => new Date(now + ms).toISOString();
const MIN = 60_000, H = 3_600_000;
const deal = (ms: number, o: Record<string, unknown> = {}) => ({ closes_at: at(ms), title: "사과", status: "active", ...o });

eq(N.isDeadlineSoon(deal(6 * H), now), true, "정확히 6시간 남음 → 대상(≤ 6h)");
eq(N.isDeadlineSoon(deal(6 * H + MIN), now), false, "6시간 1분 남음 → 제외");
eq(N.isDeadlineSoon(deal(6 * H - 1), now), true, "6시간 직전 → 대상");
eq(N.isDeadlineSoon(deal(1), now), true, "마감 1ms 전 → 대상");
eq(N.isDeadlineSoon(deal(0), now), false, "정확히 지금 마감 → 제외(now < 마감)");
eq(N.isDeadlineSoon(deal(-MIN), now), false, "이미 지남 → 제외");
eq(N.isDeadlineSoon(deal(2 * H, { status: "closed" }), now), false, "마감 상태 매물 → 제외");
eq(N.isDeadlineSoon(deal(2 * H, { status: "sold_out" }), now), false, "active 아닌 상태 → 제외");
eq(N.isDeadlineSoon({ closes_at: at(2 * H) }, now), true, "status 없음(목록 API는 active만 줌) → 대상");
eq(N.isDeadlineSoon(deal(2 * H, { title: "[테스트] 사과" }), now), false, "[테스트] 매물 → 제외(기존 타일과 같음)");
eq(N.isDeadlineSoon(deal(2 * H), new Date(now)), true, "now에 Date도 허용");

eq(N.deadlineChipLabel(at(45 * MIN), now), "마감 45분", "45분 → 분");
eq(N.deadlineChipLabel(at(59 * MIN + 59_000), now), "마감 59분", "59분 59초 → 59분(내림)");
eq(N.deadlineChipLabel(at(60 * MIN), now), "마감 1시간", "정확히 1시간 → 1시간");
eq(N.deadlineChipLabel(at(5 * H + 30 * MIN), now), "마감 5시간", "5시간 30분 → 5시간(내림)");
eq(N.deadlineChipLabel(at(6 * H), now), "마감 6시간", "6시간 → 6시간");
eq(N.deadlineChipLabel(at(10_000), now), "마감 1분", "1분 미만 → 1분(최소)");

// ── 마감 지남(isDeadlinePassed) — 2026-10-24: active인데 closes_at ≤ now, [테스트] 제외, 마감임박과 배타
eq(N.isDeadlinePassed(deal(0), now), true, "마감 지남: closes_at = now → 대상(≤)");
eq(N.isDeadlinePassed(deal(-1), now), true, "마감 지남: now - 1ms → 대상");
eq(N.isDeadlinePassed(deal(1), now), false, "마감 지남: now + 1ms → 제외(아직 진행)");
eq(N.isDeadlinePassed(deal(-H), now), true, "마감 지남: 1시간 지남 → 대상");
eq(N.isDeadlinePassed(deal(-3 * 24 * H), now), true, "마감 지남: 3일 지남 → 대상");
eq(N.isDeadlinePassed(deal(-H, { status: "closed" }), now), false, "마감 지남: 이미 closed → 제외(진행 중 아님)");
eq(N.isDeadlinePassed(deal(-H, { title: "[테스트] 사과" }), now), false, "마감 지남: [테스트] 제외");
eq(N.isDeadlinePassed({ closes_at: at(-H) }, now), true, "마감 지남: status 없음(목록 API는 active만) → 대상");
eq(N.isDeadlinePassed(deal(-H), new Date(now)), true, "마감 지남: now에 Date 허용");
// 마감임박과 배타: 어떤 시각이든 둘 중 하나만(또는 둘 다 아님) — 경계 0·±1ms·6h 근처 전부 확인
{
  const probes = [-3 * 24 * H, -H, -1, 0, 1, MIN, H, 5 * H + 59 * MIN, 6 * H - 1, 6 * H, 6 * H + 1, 7 * H, 3 * 24 * H];
  const both = probes.filter((ms) => N.isDeadlineSoon(deal(ms), now) && N.isDeadlinePassed(deal(ms), now));
  eq(both, [], "마감임박과 마감 지남이 동시에 참인 시각 없음(0ms·±1ms·6h 경계 포함)");
  eq(probes.filter((ms) => N.isDeadlinePassed(deal(ms), now)).length + probes.filter((ms) => N.isDeadlineSoon(deal(ms), now)).length, probes.filter((ms) => ms <= 0).length + probes.filter((ms) => ms > 0 && ms <= 6 * H).length, "각 판정의 합 = 구간별 개수(겹침 없음)");
  eq(N.isDeadlinePassed(deal(0), now) && !N.isDeadlineSoon(deal(0), now), true, "정확히 지금 마감: 마감 지남만 참(마감임박은 now < closes_at)");
}
// 회색 강조 스타일 — 빨강 아님, 마감임박(주황)과 다름
eq(N.NEEDS_ACTION_PASSED_ROW_STYLE.borderLeftWidth, 4, "마감 지남: 세로선 4px");
eq([N.NEEDS_ACTION_PASSED_ROW_STYLE.borderLeftColor, N.NEEDS_ACTION_PASSED_ROW_STYLE.background], ["#6B7280", "#F3F4F6"], "마감 지남: 회색 세로선·연한 회색 바탕");
eq(N.NEEDS_ACTION_PASSED_ROW_STYLE.borderLeftColor !== N.NEEDS_ACTION_ROW_STYLE.borderLeftColor, true, "마감임박(주황)과 색이 다름");
{
  const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  eq(ratio(N.NEEDS_ACTION_PASSED_CHIP_STYLE.color, N.NEEDS_ACTION_PASSED_CHIP_STYLE.background) >= 4.5, true, "칩 글자 대비 4.5:1 이상");
  eq(ratio("#374151", "#F3F4F6") >= 4.5, true, "카드 바탕(#F3F4F6) 위 회색 글자(#374151) 대비 4.5:1 이상");
  const red = /^#(DC|EF|B9|C2|E5)/i;
  eq([N.NEEDS_ACTION_PASSED_ROW_STYLE.borderLeftColor, N.NEEDS_ACTION_PASSED_ROW_STYLE.background, N.NEEDS_ACTION_PASSED_CHIP_STYLE.color].some((c: string) => red.test(c)), false, "빨강 계열 색 없음");
}

// 같은 함수로 세기 — 타일 숫자 = 카드 제목 건수 = 표시 줄 수
const list = [deal(H), deal(7 * H), deal(-H), deal(5 * H, { status: "closed" }), deal(3 * H), deal(2 * H, { title: "[테스트] x" })];
eq(list.filter((d) => N.isDeadlineSoon(d, now)).length, 2, "목록에서 대상 2건");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
// 2026-10-29: hours 인자 — 생략 = 6, 회원 홈 "곧 마감"은 24
eq(D.isDeadlineSoon(deal(10 * H), now), false, "인자 없음(6h): 10시간 남음 → 제외");
eq(D.isDeadlineSoon(deal(10 * H), now, 24), true, "24h: 10시간 남음 → 대상");
eq(D.isDeadlineSoon(deal(24 * H), now, 24), true, "24h: 정확히 24시간 → 대상(≤)");
eq(D.isDeadlineSoon(deal(24 * H + MIN), now, 24), false, "24h: 24시간 1분 → 제외");
eq(D.isDeadlineSoon(deal(-MIN), now, 24), false, "24h: 이미 지남 → 제외");
eq(D.isDeadlineSoon(deal(2 * H, { status: "closed" }), now, 24), false, "24h: 종료 매물 → 제외");
eq(D.isDeadlineSoon(deal(2 * H, { title: "[테스트] 사과" }), now, 24), false, "24h: [테스트] → 제외");
eq(D.DEADLINE_SOON_MS, 6 * H, "DEADLINE_SOON_MS = 6시간");

console.log("\n전부 통과");
