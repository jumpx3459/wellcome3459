// 회원 홈 카드·매물 상세 남은 시간 글자 단위 시험 — src/lib/format.ts formatTimeLeftLabel (2026-10-11 fix/time-left-label).
// 실행: node --experimental-strip-types scripts/time-left-label-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// 앱 빌드의 타입 검사가 ".ts" 확장자 import를 막아서(다른 시험과 같게) 경로 문자열로 불러옴 — format.ts는 다른 모듈 import 없음
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { formatTimeLeftLabel, formatCountdown } = await import(pathToFileURL(join(root, "src/lib/format.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

const now = Date.parse("2026-10-11T00:00:00Z");
const M = 60e3, H = 60 * M, D = 24 * H;
const at = (ms: number) => new Date(now + ms).toISOString();
const label = (ms: number) => formatTimeLeftLabel(at(ms), now).label;

// ── 경계값
eq(label(28 * D + 18 * H + 22 * M), "28일 남음", "28일 18시간 22분 → 내림");
eq(label(2 * D + 14 * H + 59 * M), "2일 남음", "2일 14:59 → 2일");
eq(label(D), "1일 남음", "24시간 정각 → 1일");
eq(label(D - M), "23시간 남음", "23시간 59분 → 23시간");
eq(label(D - 1000), "23시간 남음", "23:59:59 → 23시간");
eq(label(H), "1시간 남음", "1시간 정각 → 1시간");
eq(label(H - 1000), "59분 남음", "59분 59초 → 59분");
eq(label(59 * M), "59분 남음", "59분 → 59분");
eq(label(M), "1분 남음", "1분 정각");
eq(label(30 * 1000), "1분 남음", "0분(30초) → 1분 남음(\"0분 남음\" 안 씀)");
eq(label(1), "1분 남음", "0분(1ms) → 1분 남음");
eq(formatTimeLeftLabel(at(0), now), { label: "마감", urgent: true }, "딱 마감 시각 → 지금과 같은 \"마감\"");
eq(formatTimeLeftLabel(at(-5 * M), now), { label: "마감", urgent: true }, "마감 지남 → \"마감\"");

// ── urgent(3시간 미만)는 formatCountdown과 같은 기준
eq(formatTimeLeftLabel(at(3 * H), now).urgent, false, "3시간 정각 → urgent 아님");
eq(formatTimeLeftLabel(at(3 * H - 1000), now).urgent, true, "2:59:59 → urgent");

// ── 공용 formatCountdown(/deals 카드 배지)은 그대로
const cd = (ms: number) => formatCountdown(new Date(Date.now() + ms).toISOString()).label;
eq(/^\d+일 \d+:\d\d$/.test(cd(2 * D + 14 * H + 59 * M + 30e3)), true, "formatCountdown 24시간 이상 \"N일 H:MM\" 그대로");
eq(/^\d\d:\d\d:\d\d$/.test(cd(4 * H + 59 * M + 56e3)), true, "formatCountdown 24시간 미만 \"HH:MM:SS\" 그대로");
eq(cd(-1000), "마감", "formatCountdown 마감 그대로");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
