// 마감임박(6h) 판정 단위 시험 — src/lib/admin/needsAction.ts isDeadlineSoon·deadlineChipLabel (2026-10-22 feat/admin-deadline-soon-highlight).
// 실행: node --experimental-strip-types scripts/deadline-soon-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = await import(pathToFileURL(join(root, "src/lib/admin/needsAction.ts")).href);

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

// 같은 함수로 세기 — 타일 숫자 = 카드 제목 건수 = 표시 줄 수
const list = [deal(H), deal(7 * H), deal(-H), deal(5 * H, { status: "closed" }), deal(3 * H), deal(2 * H, { title: "[테스트] x" })];
eq(list.filter((d) => N.isDeadlineSoon(d, now)).length, 2, "목록에서 대상 2건");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
