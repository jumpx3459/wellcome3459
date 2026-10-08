// 회원 홈 카드 D안 글자 규칙 단위 시험 — src/lib/homeCard.ts (2026-10-09 4b-2).
// 실행: node --experimental-strip-types scripts/home-card-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { isTimerRed, regionQtyText, TIMER_RED_MS } from "../src/lib/homeCard.ts";

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

// ── 타이머 빨강(24시간 미만)
const now = Date.parse("2026-10-09T00:00:00Z");
const at = (ms: number) => new Date(now + ms).toISOString();
eq(isTimerRed(at(4 * 86400e3), now), false, "4일 남음 → 빨강 아님");
eq(isTimerRed(at(TIMER_RED_MS), now), false, "딱 24시간 → 빨강 아님(미만만)");
eq(isTimerRed(at(TIMER_RED_MS - 1000), now), true, "23:59:59 → 빨강");
eq(isTimerRed(at(3 * 3600e3), now), true, "3시간 → 빨강");
eq(isTimerRed(at(-60e3), now), true, "마감 지남 → 빨강");
eq(isTimerRed("잘못된 날짜", now), false, "날짜 아님 → 빨강 아님");

// ── "지역 · 수량"
eq(regionQtyText("경기", 7200, "개"), "경기 · 7,200개", "천 단위 쉼표");
eq(regionQtyText("경기 · 남양주", 1, "개"), "경기 · 남양주 · 1개", "시·군 있는 경우");
eq(regionQtyText("경남 · 통영", 1250000, "kg"), "경남 · 통영 · 1,250,000kg", "큰 수량·단위");
eq(regionQtyText("경기", null, "개"), "경기", "수량 없음 → 지역만");
eq(regionQtyText("경기", undefined, null), "경기", "수량·단위 없음 → 지역만");
eq(regionQtyText("", 30, "박스"), "30박스", "지역 없음 → 수량만");
eq(regionQtyText("서울", 5, ""), "서울 · 5개", "단위 비면 개");
eq(regionQtyText(null, null, null), "", "둘 다 없음 → 빈 글자");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
process.exit(failed ? 1 : 0);
