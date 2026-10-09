// 푸시 구독 정리 판정 단위 시험 — src/lib/pushGone.ts (2026-10-09 4a: 403 삭제 중지).
// 실행: node --experimental-strip-types scripts/push-gone-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { isGoneSubscription, isKeyMismatch } = await import(pathToFileURL(join(root, "src/lib/pushGone.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

eq(isGoneSubscription({ statusCode: 404 }), true, "404 → 삭제");
eq(isGoneSubscription({ statusCode: 410 }), true, "410 → 삭제");
eq(isGoneSubscription({ statusCode: 403 }), false, "403 → 삭제 안 함(유지)");
eq(isKeyMismatch({ statusCode: 403 }), true, "403 → 키 불일치로 기록");
for (const code of [400, 413, 429, 500, 502, 503]) eq(isGoneSubscription({ statusCode: code }), false, `${code} → 유지`);
eq(isGoneSubscription(new Error("network")), false, "상태 코드 없는 오류(네트워크) → 유지");
eq(isGoneSubscription(null), false, "null → 유지");
eq(isGoneSubscription({ statusCode: "410" }), false, "문자열 코드는 무시(웹푸시는 숫자)");

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
process.exit(failed ? 1 : 0);
