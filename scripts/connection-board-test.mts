// 거래 연결 보드 4단계 규칙 단위 시험 — src/lib/connectionSteps.ts (2026-10-11 PR ② feat/connection-board-simple).
// 실행: node --experimental-strip-types scripts/connection-board-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// 앱 빌드의 타입 검사가 ".ts" 확장자 import를 막아서(다른 시험과 같게) 경로 문자열로 불러옴 — connectionSteps.ts는 다른 모듈 import 없음
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = await import(pathToFileURL(join(root, "src/lib/connectionSteps.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

const now = Date.parse("2026-10-11T03:00:00Z");
const H = 3600e3, D = 24 * H;
const ago = (ms: number) => new Date(now - ms).toISOString();

// ── 진행 막대 칸
eq(["requested", "accepted", "seller_confirmed", "buyer_confirmed", "contact_sent", "closed"].map((s) => L.boardStep(s)), [0, 0, 1, 2, 3, 4], "단계 → 막대 칸(①①②③④ 끝)");
eq(L.BOARD_STEPS, ["판매자 확인", "구매자 확인", "연락처 전달", "결과 확인"], "막대 4칸 이름");

// ── 3일 경계(결과 확인 차례)
eq(L.isResultDue("contact_sent", ago(3 * D), now), true, "전달 뒤 딱 3일 → 결과 확인 차례");
eq(L.isResultDue("contact_sent", ago(3 * D - 1000), now), false, "2일 23:59:59 → 아직(연락하는 중)");
eq(L.isResultDue("contact_sent", ago(5 * D), now), true, "5일 → 결과 확인 차례");
eq(L.isResultDue("contact_sent", null, now), false, "전달 시각 없음 → 아님");
eq(L.isResultDue("buyer_confirmed", ago(5 * D), now), false, "③ 단계는 해당 없음");
eq(L.isResultDue("closed", ago(5 * D), now), false, "종료 건 해당 없음");
eq(new Date(L.resultDueAt("2026-10-11T03:00:00Z")).toISOString(), "2026-10-14T03:00:00.000Z", "결과 확인 시작 = 전달 + 3일");

// ── 멈춤(24시간) — ⑤ 연락처 전달 뒤는 멈춤 아님
eq(L.isStuck("accepted", ago(D + 1000), now), true, "① 24시간 넘음 → 멈춤");
eq(L.isStuck("accepted", ago(D), now), false, "딱 24시간 → 아직(초과만)");
eq(L.isStuck("buyer_confirmed", ago(2 * D), now), true, "③ 2일 → 멈춤");
eq(L.isStuck("contact_sent", ago(2 * D), now), false, "⑤ 2일(3일 전) → 멈춤 아님");
eq(L.isStuck("contact_sent", ago(10 * D), now), false, "⑤ 10일 → 멈춤 아님(결과 확인 차례로 따로)");
eq(L.isStuck("closed", ago(10 * D), now), false, "종료 → 멈춤 아님");

// ── 끝내기 사유 → 결과
const end = Object.fromEntries(L.END_REASONS.map((r: { label: string; result: string }) => [r.label, r.result]));
eq(end, { 테스트: "cancelled", "구매자 취소": "cancelled", "판매자 재고 없음": "failed", "연락 안 됨": "failed", "거래 안 됨": "failed" }, "끝내기 사유 5개 → 취소·불발");
eq(L.END_REASONS.find((r: { key: string }) => r.key === "no_deal")?.label, "거래 안 됨", "④ [안 됐어요]가 미리 고르는 사유 키 no_deal");
eq("ANSWER_REASON" in L, false, "답 버튼으로 바로 닫는 사유 없음(못 판대요·그만둔대요 제거)");

// ── 정렬: 멈춤 → 결과 확인 → 오래된 순 → 테스트 맨 아래
const mk = (id: string, o: { stuck?: boolean; result_due?: boolean; is_test?: boolean; age: number }) => ({ id, stuck: !!o.stuck, result_due: !!o.result_due, is_test: !!o.is_test, updated_at: ago(o.age) });
const items = [
  mk("normal-new", { age: 1 * H }),
  mk("test-stuck", { stuck: true, is_test: true, age: 9 * D }),
  mk("due-new", { result_due: true, age: 4 * D }),
  mk("stuck-new", { stuck: true, age: 2 * D }),
  mk("normal-old", { age: 20 * H }),
  mk("due-old", { result_due: true, age: 6 * D }),
  mk("stuck-old", { stuck: true, age: 5 * D }),
  mk("test-normal", { is_test: true, age: 2 * H }),
];
eq(L.sortBoard(items).map((c: { id: string }) => c.id), ["stuck-old", "stuck-new", "due-old", "due-new", "normal-old", "normal-new", "test-stuck", "test-normal"], "정렬 순서");
eq(items[0].id, "normal-new", "원본 배열은 그대로");

// ── 판매자에게 보낼 문구
eq(
  L.contactMessage("냉동 삼겹살 10kg", "010-1234-5678"),
  "[덤핑점핑] 냉동 삼겹살 10kg 구매 희망 고객 연락처입니다.\n구매자 번호: 010-1234-5678\n거래 조건은 직접 협의해 주세요. 거래가 되면 덤핑점핑에 알려주세요.",
  "문구 복사 내용"
);

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
