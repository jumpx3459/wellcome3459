// 회원 사업자 셀프 확인(1단계) 순수 규칙 시험 — 실행: node --experimental-strip-types scripts/member-business-check-test.mts
// 라우트(국세청·DB 호출)는 가짜 국세청·가짜 Supabase를 띄우는 별도 시험으로 확인(여기는 네트워크 없음).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
// 변수로 import — tsc(빌드)가 .ts 확장자 import를 검사하지 않게
const mPath = "../src/lib/memberBusinessCheck.ts";
const dPath = "../src/lib/adminMemberDetail.ts";
const m = (await import(mPath)) as typeof import("../src/lib/memberBusinessCheck");
const d = (await import(dPath)) as typeof import("../src/lib/adminMemberDetail");

let n = 0;
const eq = (a: unknown, b: unknown, msg: string) => {
  assert.deepEqual(a, b, msg);
  n++;
  console.log("ok  ", msg);
};

// 상수 — 지시값
eq(m.MEMBER_DAILY_LIMIT, 5, "회원당 하루 5회");
eq(m.GLOBAL_DAILY_LIMIT, 500, "전체 하루 500행");

// KST 하루 시작 — 00:00 KST = 전날 15:00 UTC
eq(m.kstDayStartIso(Date.parse("2026-11-05T00:00:00+09:00")), "2026-11-04T15:00:00.000Z", "KST 00:00 → 그날 시작");
eq(m.kstDayStartIso(Date.parse("2026-11-05T23:59:59+09:00")), "2026-11-04T15:00:00.000Z", "KST 23:59 → 같은 날 시작");
eq(m.kstDayStartIso(Date.parse("2026-11-04T14:59:59Z")), "2026-11-03T15:00:00.000Z", "UTC 14:59(= KST 23:59) → 전날 시작");
eq(m.kstDayStartIso(Date.parse("2026-11-04T15:00:00Z")), "2026-11-04T15:00:00.000Z", "UTC 15:00(= KST 00:00) → 새 날");

// 형식 변환
eq(m.openDateToDb("20200102"), "2020-01-02", "YYYYMMDD → date");
eq(m.dbStatusCode("01"), "01", "상태 01");
eq(m.dbStatusCode("02"), "02", "상태 02");
eq(m.dbStatusCode("03"), "03", "상태 03");
eq(m.dbStatusCode(""), null, "빈 상태 → null(check 위반 방지)");
eq(m.dbStatusCode("99"), null, "그 밖의 상태 → null");
eq(m.dbStatusCode(null), null, "상태 null → null");

// 표시
eq(m.statusWord("01"), "계속사업자", "계속");
eq(m.statusWord("02"), "휴업", "휴업");
eq(m.statusWord("03"), "폐업", "폐업");
eq(m.statusWord(null), null, "상태 없음");
eq(m.kstMonthDay("2026-11-04T15:00:00.000Z"), "11/5", "KST 월/일(UTC 15시 = 다음 날)");
eq(m.kstMonthDay("2026-12-31T14:59:00.000Z"), "12/31", "KST 월/일 — 연말 직전");
eq(m.selfBizCheckOn("on"), true, "플래그 on");
eq(m.selfBizCheckOn(undefined), false, "플래그 미설정 = off");
eq(m.selfBizCheckOn("1"), false, "플래그 on 이외 = off");
eq(m.selfBizCheckOn("off"), false, "플래그 off");

// 관리자 상세
eq(d.countOtherMembers([{ member_id: "a" }, { member_id: "b" }, { member_id: "b" }, { member_id: null }], "a"), 1, "같은 사업자번호 다른 회원 수 — 본인·중복·null 제외");
eq(d.countOtherMembers([], "a"), 0, "기록 없음 → 0");
eq(d.countOtherMembers(null, "a"), 0, "null → 0");
eq(
  d.selfCheckText({ checked_at: "2026-11-04T15:00:00.000Z", status_code: "02", b_no_masked: "123-45-*****" }),
  "국세청 자동 확인 11/5 · 휴업 · 123-45-*****",
  "관리자 한 줄 문구",
);
eq(
  d.selfCheckText({ checked_at: "2026-11-04T15:00:00.000Z", status_code: null, b_no_masked: null }),
  "국세청 자동 확인 11/5",
  "상태·번호 없으면 날짜만",
);

// 소스 규칙 — 금지 항목·범위
const route = readFileSync(join(root, "src/app/api/business-check/route.ts"), "utf8");
eq(/overLimit|rateLimit/.test(route), false, "메모리 rateLimit 사용 안 함(DB 집계)");
eq(/import[^;]*ntsStatus/.test(route), false, "라우트는 ntsValidate만 import(상태조회는 nts.ts 안에서)");
eq(/console\.\w+\([^)]*bNo[^)]*\)/.test(route.replace(/maskBizNo\(bNo\)/g, "")), false, "로그에 사업자번호 원문 없음(maskBizNo만)");
eq(/"member_business_checks"/.test(route) && !/seller_business_checks/.test(route), true, "member_business_checks만 사용(seller_business_checks 미변경)");
const consent = readFileSync(join(root, "src/lib/consent.ts"), "utf8");
eq(/CONNECTION_CONSENT_VERSION = "2026-10-09"/.test(consent), true, "consent.ts 연결 동의 버전 그대로");
const detail = readFileSync(join(root, "src/lib/adminMemberDetail.ts"), "utf8");
eq(/\bb_no\b\s*:/.test(detail.replace(/b_no_masked/g, "")), false, "관리자 상세 타입에 사업자번호 원문 칸 없음");

console.log(`\n${n}건 통과`);
