// 매물 알림 대상 조건 단위 시험 — 지역은 조건이 아님(카테고리만). 운영 접속 없음.
// 실행: node --experimental-strip-types scripts/alert-target-test.mts   (Node 24)
// 대상 = 이 카테고리를 고른 회원 ∩ push_opt_out 아님 ∩ deal_alert_ad 최신 agreed·현재 버전 이상 ∩(발송 때) 구독 보유.
// 앱 코드의 "@/lib/…" 별칭을 상대 경로로 바꿔 시험 폴더에 복사해 불러옴.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "alert-target-"));
mkdirSync(join(dir, "lib"), { recursive: true });
for (const f of ["dealMatching", "consent"]) {
  const src = readFileSync(join(root, "src/lib", `${f}.ts`), "utf8").replace(/from "@\/lib\/([A-Za-z]+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, "lib", `${f}.ts`), src);
}
const dm = await import(pathToFileURL(join(dir, "lib/dealMatching.ts")).href);
const cs = await import(pathToFileURL(join(dir, "lib/consent.ts")).href);

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failed++;
    console.error("FAIL", msg);
  } else console.log("ok  ", msg);
};
const eq = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// 동의 행 → 동의 집합 (sendPush.ts selectDealAlertAgreedIds와 같은 규칙: agreed=true 이고 버전이 현재 이상)
const CUR = cs.DEAL_ALERT_CONSENT_VERSION as string;
const rows = [
  { member_id: "서울", terms_version: CUR },
  { member_id: "부산", terms_version: CUR },
  { member_id: "지역없음", terms_version: CUR },
  { member_id: "옵트아웃", terms_version: CUR },
  { member_id: "옛버전", terms_version: "2026-10-07" },
  { member_id: "버전없음", terms_version: null },
  // "동의없음" 회원은 행 자체가 없음
];
const agreed = new Set(rows.filter((r) => cs.isDealAlertVersionCurrent(r.terms_version)).map((r) => r.member_id));
const optedOut = new Set(["옵트아웃"]);

// 이 매물은 "경기" 지역 — 서울·부산·지역없음 회원 모두 카테고리를 골랐다(지역은 입력에 없음)
const categoryMemberIds = ["서울", "부산", "지역없음", "옵트아웃", "옛버전", "버전없음", "동의없음"];
const targets = dm.selectDealAlertMembers({ categoryMemberIds, optedOut, agreed });
ok(eq(targets, ["서울", "부산", "지역없음"]), "지역이 다른 회원(서울·부산)·지역 미선택 회원도 대상 → " + targets.join(","));
ok(!targets.includes("옵트아웃"), "push_opt_out 회원 제외");
ok(!targets.includes("동의없음"), "매물 알림 동의 기록 없는 회원 제외");
ok(!targets.includes("옛버전") && !targets.includes("버전없음"), "옛 버전·버전 없는 동의 제외");

// 카테고리를 고르지 않은 회원은 후보(categoryMemberIds)에 없으므로 제외
const noCat = dm.selectDealAlertMembers({ categoryMemberIds: ["서울"], optedOut, agreed });
ok(eq(noCat, ["서울"]) && !noCat.includes("부산"), "다른 카테고리만 고른 회원(부산)은 후보가 아니라 제외");
ok(dm.selectDealAlertMembers({ categoryMemberIds: [], optedOut, agreed }).length === 0, "카테고리 선택자 0명이면 대상 0");

// 중복 id 방어
ok(eq(dm.selectDealAlertMembers({ categoryMemberIds: ["서울", "서울", "부산"], optedOut, agreed }), ["서울", "부산"]), "중복 회원 한 번만");

// 지역 값을 넘겨도 결과가 같음(함수가 지역을 읽지 않음)
const withRegion = dm.selectDealAlertMembers({ categoryMemberIds, optedOut, agreed, regionsByMember: new Map([["서울", [1]], ["부산", [9]]]), dealRegion: 3 } as never);
ok(eq(withRegion, targets), "지역 정보가 있어도 결과 동일");

// 카테고리 매칭(회원 홈)
ok(dm.matchesCategory(3, [1, 3]) === true && dm.matchesCategory(2, [1, 3]) === false && dm.matchesCategory(null, [1]) === false && dm.matchesCategory(1, []) === false, "matchesCategory");
ok(!("matchesConditions" in dm), "지역을 받는 예전 matchesConditions는 제거됨");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
