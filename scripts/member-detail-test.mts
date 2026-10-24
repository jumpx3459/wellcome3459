// 관리자 회원 상세 조립 규칙 단위 시험 — src/lib/adminMemberDetail.ts (2026-10-23 feat/admin-member-detail).
// 실행: node --experimental-strip-types scripts/member-detail-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = await import(pathToFileURL(join(root, "src/lib/adminMemberDetail.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const c = (type: string, agreed: boolean, at: string, v = "2026-10-07", src = "signup") => ({ consent_type: type, agreed, terms_version: v, source: src, created_at: at });

// ── 동의: 종류별 최신 1행
{
  const rows = [
    c("deal_alert_ad", true, "2026-10-01T00:00:00Z"),
    c("deal_alert_ad", false, "2026-10-10T00:00:00Z"), // 최신 = 철회
    c("tos", true, "2026-09-30T00:00:00Z"),
    c("tos", true, "2026-10-12T00:00:00Z", "2026-10-12"), // 같은 종류 더 최신 동의(버전 다름)
    c("privacy", false, "2026-10-02T00:00:00Z"),
    c("privacy", true, "2026-10-01T00:00:00Z"), // 입력 순서가 뒤여도 시각이 더 늦은 철회가 최신
    c("night_ad", true, "2026-10-05T00:00:00Z"), // 상세에 안 보여 주는 종류 → 무시
  ];
  const r = d.latestConsents(rows);
  const by = Object.fromEntries(r.map((x: { type: string }) => [x.type, x]));
  eq(r.map((x: { type: string }) => x.type), ["tos", "privacy", "eligibility", "deal_alert_ad", "kakao_marketing", "seller_terms", "biz_info"], "동의 7종 고정 순서(night_ad 제외)");
  eq([by.deal_alert_ad.status, by.deal_alert_ad.at], ["withdrawn", "2026-10-10T00:00:00Z"], "매물 알림: 철회가 최신 → 철회");
  eq([by.tos.status, by.tos.terms_version], ["agreed", "2026-10-12"], "이용약관: 더 최신 행(버전 2026-10-12)");
  eq(by.privacy.status, "withdrawn", "개인정보: 입력 순서와 무관하게 시각이 최신인 철회");
  eq([by.eligibility.status, by.eligibility.at], ["none", null], "기록 없음 → none·시각 null");
  eq(d.latestConsents([]).every((x: { status: string }) => x.status === "none"), true, "행이 하나도 없으면 전부 기록 없음");
}

// ── 사업자 인증 상태·인증일 없음 처리
eq(d.businessState({ business_verified: true, has_license: true }, "2026-10-20T03:00:00Z"), { state: "verified", verified_at: "2026-10-20T03:00:00Z" }, "인증 + 감사 로그 인증일");
eq(d.businessState({ business_verified: true, has_license: true }, null), { state: "verified", verified_at: null }, "인증인데 인증일 기록 없음 → verified_at null(화면 \"인증일 기록 없음\")");
eq(d.businessState({ business_verified: false, has_license: true }, "2026-10-20T03:00:00Z"), { state: "license_only", verified_at: null }, "등록증만 있음(승인 전) — 인증일 무시");
eq(d.businessState({ business_verified: null, has_license: false }, null), { state: "none", verified_at: null }, "없음");

// ── 비회원 행 제외(회원 키가 정확히 같은 행만 — 번호가 같아도 키가 null이면 버림)
const A = "00000000-0000-4000-8000-0000000000a1";
const rows = [
  { id: "own1", member_id: A, phone: "01012345678" },
  { id: "guest1", member_id: null, phone: "01012345678" }, // 같은 번호의 비회원 행
  { id: "other", member_id: "00000000-0000-4000-8000-0000000000a2", phone: "01012345678" }, // 같은 번호 쓰는 다른 회원 행
  { id: "own2", member_id: A, phone: "01099999999" },
];
eq(d.onlyOwn(rows, "member_id", A).map((r: { id: string }) => r.id), ["own1", "own2"], "member_id 같은 행만(null·다른 회원 제외)");
eq(d.onlyOwn(rows, "buyer_member_id", A).length, 0, "키 칸이 없는 행은 전부 제외");
eq(d.onlyOwn(null, "member_id", A), [], "null 입력 → 빈 배열");

// ── 응답 형태·API 소스 규칙(개인정보)
const route = readFileSync(join(root, "src/app/api/admin/members/[id]/route.ts"), "utf8");
const lib = readFileSync(join(root, "src/lib/adminMemberDetail.ts"), "utf8");
const selects = [...route.matchAll(/\.select\(\s*([`"'])([\s\S]*?)/g)].map((m) => m[2]);
eq(selects.some((s) => /\*/.test(s.replace(/\$\{[^}]*\}/g, ""))), false, "API select에 * 없음(칸 명시)");
eq(selects.some((s) => /contact_phone|buyer_phone|b_no/.test(s)), false, "select에 신청 연락처·구매자 번호·사업자번호 칸 없음");
const built = route.slice(route.indexOf("const detail: MemberDetail"), route.indexOf("await writeAudit"));
eq(/contact_phone|buyer_phone|b_no/.test(built), false, "응답 조립부에 금지 칸 없음");
eq([(built.match(/business_license_path/g) ?? []).length, /Boolean\(m\.business_license_path\)/.test(built)], [1, true], "등록증 경로는 있음 여부(Boolean)로만 쓰고 응답엔 넣지 않음");
const typeBlock = lib.slice(lib.indexOf("export type MemberDetail"));
eq(/contact_phone|buyer_phone|b_no|license_path/.test(typeBlock), false, "응답 타입에 금지 칸 없음");
eq(/member_detail_view/.test(route) && /phoneTail\(/.test(route), true, "열람 감사 로그 member_detail_view + 번호는 phoneTail(뒤 4자리)");
eq(/requirePerm\(auth\.admin, "members"\)/.test(route), true, "권한: members(점핑매니저 제외)");
eq(/quick_leads/.test(route.replace(/\/\/[^\n]*/g, "")), false, "코드에서 quick_leads(비회원 표)를 조회하지 않음");
eq(/\.eq\("(member_id|seller_member_id|buyer_member_id)", id\)/.test(route), true, "활동 조회는 회원 키(eq)로만");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
