// 회원 홈 "알림이 꺼져 있어요" 판정 단위 시험 — src/lib/alertsNotice.ts (2026-10-09 PR 4a).
// 실행: node --experimental-strip-types scripts/alerts-notice-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { alertsOffNotice } = await import(pathToFileURL(join(root, "src/lib/alertsNotice.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const saved = { thisDeviceSaved: true, optedOut: false };

// 확실히 꺼짐 → 안내
eq(alertsOffNotice("denied", true, null), true, "권한 거부 → 안내");
eq(alertsOffNotice("off", true, null), true, "이 기기 구독 없음(권한 전 포함) → 안내");
eq(alertsOffNotice("off", null, null), true, "구독 없음은 동의 조회 전이어도 확실 → 안내");
eq(alertsOffNotice("subscribed", false, saved), true, "구독 있음 + 동의 없음·옛 버전 → 안내");
eq(alertsOffNotice("subscribed", true, { thisDeviceSaved: true, optedOut: true }), true, "구독 있음 + 서버 '알림 끔' → 안내");
// 켜짐 → 없음
eq(alertsOffNotice("subscribed", true, saved), false, "구독 + 서버 저장 + 최신 동의 = 켜짐 → 없음");
// 모름 → 없음
eq(alertsOffNotice(null, true, saved), false, "상태 확인 전 → 없음");
eq(alertsOffNotice("subscribed", null, saved), false, "동의 조회 전·실패 → 없음");
eq(alertsOffNotice("subscribed", true, null), false, "서버 조회 실패 → 없음");
eq(alertsOffNotice("subscribed", true, { thisDeviceSaved: false, optedOut: false }), false, "서버에 이 기기 아직 저장 안 됨 → 모름 → 없음");
// 알림이 안 되는 환경 → 기존 안내에 맡김
for (const k of ["inapp", "ios_needs_install", "unsupported", "noncanonical"]) eq(alertsOffNotice(k, false, null), false, `${k} → 기존 안내(이 안내 없음)`);

console.log(failed ? `\n${failed}건 실패` : "\n전부 통과");
process.exit(failed ? 1 : 0);
