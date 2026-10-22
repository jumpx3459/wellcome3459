// 사업자 조회 이력 합치기·5건 자르기 단위 시험 — src/lib/businessCheckHistory.ts (2026-10-22 fix/business-check-history-compact).
// 실행: node --experimental-strip-types scripts/business-history-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(pathToFileURL(join(root, "src/lib/businessCheckHistory.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const row = (id: string, at: string, o: Record<string, unknown> = {}) => ({ id, kind: "validate", deal_id: null, seller_request_id: null, checked_at: at, ...o });
const ids = (cards: { check: { id: string }; rechecks: { id: string }[] }[]) => cards.map((c) => [c.check.id, ...c.rechecks.map((r) => r.id)].join("+"));

// 최근순 입력
eq(ids(H.groupHistory([row("r1", "2026-10-21T06:20", { kind: "status_recheck", deal_id: "d1", seller_request_id: "s1" }), row("v1", "2026-10-21T06:10", { deal_id: "d1", seller_request_id: "s1" })])), ["v1+r1"], "같은 deal_id 부모에 합침(카드 1장)");
eq(ids(H.groupHistory([row("r1", "2026-10-21T06:20", { kind: "status_recheck", deal_id: "d1", seller_request_id: null }), row("v1", "2026-10-21T06:10", { deal_id: "d1" })])), ["v1+r1"], "직접 등록(신청 없음)도 deal_id로 합침");
eq(ids(H.groupHistory([row("r1", "2026-10-21T06:20", { kind: "status_recheck", deal_id: "dX", seller_request_id: "s1" }), row("v2", "2026-10-21T06:15", { seller_request_id: "s1" }), row("v1", "2026-10-21T06:10", { seller_request_id: "s1" })])), ["v2+r1", "v1"], "deal_id 없으면 같은 신청의 앞선 가장 가까운 진위확인에 합침");
eq(ids(H.groupHistory([row("r1", "2026-10-21T06:05", { kind: "status_recheck", deal_id: "dX", seller_request_id: "s1" }), row("v1", "2026-10-21T06:10", { seller_request_id: "s1" })])), ["r1", "v1"], "재조회보다 뒤의 조회는 부모 아님 → 단독 카드");
eq(ids(H.groupHistory([row("r1", "2026-10-21T06:20", { kind: "status_recheck", deal_id: "dZ", seller_request_id: null }), row("v1", "2026-10-21T06:10", { deal_id: "d1" })])), ["r1", "v1"], "부모를 못 찾으면 단독 한 줄 카드");
eq(ids(H.groupHistory([row("r1", "2026-10-21T06:20", { kind: "status_recheck", deal_id: "d1" }), row("v1r", "2026-10-21T06:10", { deal_id: "d1", reused_from_check_id: "root" })])), ["v1r+r1"], "재사용 행 부모에도 합침(재사용 칩 표시는 그대로 부모 행 데이터)");
eq(ids(H.groupHistory([row("r2", "2026-10-21T07:00", { kind: "status_recheck", deal_id: "d2" }), row("r1", "2026-10-21T06:20", { kind: "status_recheck", deal_id: "d1" }), row("v2", "2026-10-21T06:50", { deal_id: "d2" }), row("v1", "2026-10-21T06:10", { deal_id: "d1" })])), ["v2+r2", "v1+r1"], "부모 두 장·각자 재조회 — 순서는 부모 위치");

// 5건 자르기와 N
const many = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}` }));
let v = H.visibleCards(many, false);
eq([v.shown.length, v.total, v.canToggle], [5, 8, true], "8장 접힘 → 5장, N=8, 버튼 있음");
v = H.visibleCards(many, true);
eq([v.shown.length, v.total, v.canToggle], [8, 8, true], "8장 펼침 → 8장");
v = H.visibleCards(many.slice(0, 5), false);
eq([v.shown.length, v.total, v.canToggle], [5, 5, false], "5장 → 버튼 없음");
v = H.visibleCards([], false);
eq([v.shown.length, v.total, v.canToggle], [0, 0, false], "0장");
// 재조회가 합쳐지면 N은 줄어든다: 원 행 12(validate 6 + recheck 6) → 카드 6
const rows = Array.from({ length: 6 }, (_, i) => [row(`r${i}`, `2026-10-21T0${i}:30`, { kind: "status_recheck", deal_id: `d${i}` }), row(`v${i}`, `2026-10-21T0${i}:10`, { deal_id: `d${i}` })]).flat().sort((a, b) => (a.checked_at < b.checked_at ? 1 : -1));
const g = H.groupHistory(rows);
eq([g.length, H.visibleCards(g, false).shown.length], [6, 5], "행 12개 → 카드 6장(N=6), 접힘 5장");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
