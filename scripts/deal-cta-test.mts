// 매물 상세 주 버튼 상태 판정 단위 시험 — src/lib/dealCta.ts (2026-10-09 PR 4a).
// 실행: node --experimental-strip-types scripts/deal-cta-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { connectionRequested, ctaState, isDealClosed } = await import(pathToFileURL(join(root, "src/lib/dealCta.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const state = (rows: { status: string; result: string | null }[], dealClosed = false) => ctaState(dealClosed, connectionRequested(rows));

// 6경우
eq(state([]), "request", "① 연결 없음 → 판매자 연결 요청");
eq(state([{ status: "requested", result: null }]), "requested", "② requested(방금 요청) → 연결 요청함");
eq(state([{ status: "contact_sent", result: null }]), "requested", "② contact_sent(번호 전달) → 연결 요청함");
eq(state([{ status: "closed", result: "success" }]), "requested", "② closed + 성사 → 연결 요청함");
eq(state([{ status: "closed", result: "failed" }, { status: "closed", result: "cancelled" }]), "request", "① closed + 불발·취소 → 다시 요청 가능");
eq(state([{ status: "accepted", result: null }], true), "closed", "③ 매물 마감 → 마감된 매물이에요(진행 중 연결보다 먼저)");
// 경계·보조
eq(state([{ status: "closed", result: "failed" }, { status: "seller_confirmed", result: null }]), "requested", "불발 뒤 재요청이 진행 중 → 연결 요청함");
eq(connectionRequested(null), false, "조회 실패(null) → 요청 안 함으로");
const now = Date.parse("2026-10-20T00:00:00Z");
eq(isDealClosed("active", "2026-10-19T23:59:59Z", now), true, "마감 시각 지남 → 마감");
eq(isDealClosed("active", "2026-10-21T00:00:00Z", now), false, "마감 전 → 진행 중");
eq(isDealClosed("closed", "2026-10-21T00:00:00Z", now), true, "상태 closed → 마감");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
process.exit(failed ? 1 : 0);
