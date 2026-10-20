// 확인된 판매자 재사용 규칙 단위 시험 — src/lib/businessReuse.ts (2026-10-21 feat/seller-check-reuse).
// 실행: node --experimental-strip-types scripts/business-reuse-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = await import(pathToFileURL(join(root, "src/lib/businessReuse.ts")).href);
const B = await import(pathToFileURL(join(root, "src/lib/businessCheck.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

// ── root 판정
const row = (o: Record<string, unknown>) => ({ kind: "validate", reused_from_check_id: null, validate_result: "01", exception_ok: false, ...o });
eq(R.isRootCheck(row({})), true, "직접 조회·진위 일치 → root");
eq(R.isRootCheck(row({ validate_result: "02", exception_ok: true })), true, "직접 조회·예외 확인 → root");
eq(R.isRootCheck(row({ validate_result: "02" })), false, "불일치(예외 없음) → root 아님");
eq(R.isRootCheck(row({ validate_result: "error" })), false, "확인 대기(error) → root 아님");
eq(R.isRootCheck(row({ validate_result: null })), false, "결과 없음 → root 아님");
eq(R.isRootCheck(row({ reused_from_check_id: "r1" })), false, "재사용 행 → root 아님");
eq(R.isRootCheck(row({ kind: "status_recheck", validate_result: null })), false, "상태 재조회 행 → root 아님");
eq(R.isRootCheck(null), false, "null → root 아님");

// ── 재사용의 재사용 → root id
eq(R.rootIdOf({ id: "c1", reused_from_check_id: null }), "c1", "직접 행을 고르면 자기 id");
eq(R.rootIdOf({ id: "c2", reused_from_check_id: "c1" }), "c1", "재사용 행을 고르면 root id(c1)");
eq(R.rootIdOf({ id: "c3" }), "c3", "칸이 없으면 자기 id");

// ── 1년 경계(root.checked_at 기준)
const now = Date.parse("2026-10-21T03:00:00Z");
const ago = (days: number, extraMs = 0) => new Date(now - days * 24 * 3600e3 - extraMs).toISOString();
eq(R.isOverYear(ago(364), now), false, "364일 → 아직");
eq(R.isOverYear(ago(365, -1000), now), false, "365일에 1초 모자람 → 아직");
eq(R.isOverYear(ago(365), now), true, "365일 → 경과");
eq(R.isOverYear(ago(366), now), true, "366일 → 경과");
eq(R.isOverYear("잘못된 날짜", now), false, "날짜 형식 오류 → 경과 아님");

// ── 상호 정규화(businessCheck.ts normCompany와 같은 규칙)
for (const [a, b] of [["(주) 세계 무역", "세계무역"], ["주식회사세계무역", "세계무역 "], ["ABC Trading", "abctrading"]]) {
  eq(R.normCompanyForReuse(a) === R.normCompanyForReuse(b), true, `상호 정규화 같음: "${a}" = "${b}"`);
  eq(R.normCompanyForReuse(a), B.normCompany(a), `businessCheck.normCompany와 같은 값: "${a}"`);
}
eq(R.normCompanyForReuse("세계무역") === R.normCompanyForReuse("세계상사"), false, "다른 상호는 다름");

// ── 경고 ①~⑤ (각각)
const base = {
  status: { kind: "ok", code: "01" },
  rootCheckedAt: ago(10),
  rootException: false,
  rootCompany: "세계무역",
  currentCompany: "(주)세계무역",
  originalPhone: "01012345678",
  currentPhone: "01012345678",
  now,
};
const codes = (o: Record<string, unknown>) => R.buildReuseWarnings({ ...base, ...o }).map((w: { code: string }) => w.code);
eq(codes({}), [], "경고 없음(계속사업자·같은 상호·같은 연락처·10일·직접 확인)");
eq(codes({ status: { kind: "ok", code: "02" } }), ["status_closed"], "① 휴업");
eq(codes({ status: { kind: "ok", code: "03" } }), ["status_closed"], "① 폐업");
eq(R.buildReuseWarnings({ ...base, status: { kind: "ok", code: "02" } })[0].text.includes("휴업"), true, "① 휴업 문구");
eq(R.buildReuseWarnings({ ...base, status: { kind: "ok", code: "03" } })[0].text.includes("폐업"), true, "① 폐업 문구");
eq(codes({ status: { kind: "failed" } }), ["status_failed"], "① 상태 조회 실패");
eq(R.buildReuseWarnings({ ...base, status: { kind: "failed" } })[0].text, "상태 조회 실패 · 다시 조회 권장", "① 실패 문구");
eq(codes({ currentCompany: "세계상사" }), ["company_differs"], "② 상호 상이");
eq(codes({ currentCompany: "주식회사 세계 무역" }), [], "② 정규화 후 같으면 경고 없음");
eq(codes({ currentCompany: null }), [], "② 지금 상호 없음 → 비교 안 함");
eq(codes({ rootCompany: null }), [], "② 원본 상호 없음 → 비교 안 함");
eq(codes({ currentPhone: "01099998888" }), ["phone_differs"], "③ 연락처 상이");
eq(codes({ originalPhone: null }), [], "③ 원본 연락처 모름 → 비교 안 함");
eq(codes({ currentPhone: null }), [], "③ 지금 연락처 없음 → 비교 안 함");
eq(codes({ rootCheckedAt: ago(365) }), ["over_year"], "④ 1년 경과");
eq(codes({ rootCheckedAt: ago(364) }), [], "④ 364일은 경고 없음");
eq(codes({ rootException: true }), ["root_exception"], "⑤ root가 예외 확인");
eq(R.buildReuseWarnings({ ...base, rootException: true })[0].text, "첫 확인이 예외 확인(사본)이에요 · 다시 조회를 권해요", "⑤ 문구");
eq(
  codes({ status: { kind: "ok", code: "03" }, currentCompany: "다른상사", currentPhone: "01000000000", rootCheckedAt: ago(400), rootException: true }),
  ["status_closed", "company_differs", "phone_differs", "over_year", "root_exception"],
  "경고 5개 모두 — 순서 고정(상태·상호·연락처·1년·예외)"
);
eq(codes({ status: { kind: "ok", code: "" } }), ["status_unregistered"], "① 미등록('') 상태 → 노란 경고");
eq(R.buildReuseWarnings({ ...base, status: { kind: "ok", code: "" } })[0].text, "국세청에 등록되지 않은 번호로 조회돼요 · 다시 조회를 권해요", "① 미등록 문구");
eq(
  codes({ status: { kind: "ok", code: "" }, currentCompany: "다른상사", currentPhone: "01000000000", rootCheckedAt: ago(400), rootException: true }),
  ["status_unregistered", "company_differs", "phone_differs", "over_year", "root_exception"],
  "경고 5개 모두(미등록 포함) — 순서 고정(상태·상호·연락처·1년·예외)"
);
eq(codes({ status: { kind: "ok", code: "01" } }), [], "계속사업자('01')는 상태 경고 없음");

// ── 권한: 예외 root는 최고관리자·관리자만
eq(R.canReuseRoot("점핑매니저", true), false, "예외 root를 점핑매니저가 재사용 → 불가(403)");
eq(R.canReuseRoot("관리자", true), true, "예외 root를 관리자가 재사용 → 가능");
eq(R.canReuseRoot("최고관리자", true), true, "예외 root를 최고관리자가 재사용 → 가능");
eq(R.canReuseRoot("점핑매니저", false), true, "일반 root는 점핑매니저도 가능(사업자 조회 권한과 같음)");

if (failed) {
  console.error(`\n실패 ${failed}건`);
  process.exit(1);
}
console.log("\n전부 통과");
