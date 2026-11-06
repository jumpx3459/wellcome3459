// 열람권 관리자 표시·입력 규칙 시험 — 실행: node --experimental-strip-types scripts/view-credits-admin-test.mts
// 순수 계산(잔여·만료·사용·회수)과 수동 지급 입력 검증. 네트워크·DB 없음.
import assert from "node:assert/strict";

// 변수로 import — tsc(빌드)가 .ts 확장자 import를 검사하지 않게
const aPath = "../src/lib/viewCreditsAdmin.ts";
const a = (await import(aPath)) as typeof import("../src/lib/viewCreditsAdmin");

let n = 0;
const eq = (x: unknown, y: unknown, msg: string) => {
  assert.deepEqual(x, y, msg);
  n++;
  console.log("ok  ", msg);
};

const NOW = Date.parse("2026-11-06T03:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const day = 86400e3;
const g = (id: string, source: string, quantity: number, expiresInDays: number, createdDaysAgo = 1, extra: object = {}) => ({
  id, source, quantity, period_month: source === "monthly" ? "2026-11-01" : null, expires_at: iso(NOW + expiresInDays * day), reason: source === "admin" ? "시험 지급" : null, created_at: iso(NOW - createdDaysAgo * day), ...extra,
});
const e = (id: string, grant_id: string, kind: string, quantity: number, deal_id: string | null = null) => ({ id, grant_id, kind, quantity, deal_id, reason: kind === "revoke" ? "회수 사유" : null, created_at: iso(NOW - 3600e3) });

// 잔여 = 지급 − 사용 − 회수, 만료 제외
{
  const s = a.summarizeCredits([g("m", "monthly", 5, 20), g("w", "welcome", 5, 80)], [e("e1", "m", "use", 1, "d1"), e("e2", "w", "use", 1, "d2")], NOW);
  eq(s.remaining, 8, "잔여: 월 5 + 웰컴 5 − 사용 2 = 8");
  eq(s.next_expires_at, iso(NOW + 20 * day), "가장 빠른 만료 = 월 무료 만료");
  eq(s.grants.find((x) => x.id === "m")?.left, 4, "지급 줄별 남은 수(월 무료 4)");
  eq(s.grants.find((x) => x.id === "m")?.used, 1, "지급 줄별 사용 수");
}
// 회수
{
  const s = a.summarizeCredits([g("x", "admin", 10, 80)], [e("r1", "x", "revoke", 4), e("u1", "x", "use", 1, "d1")], NOW);
  eq(s.remaining, 5, "회수 4 + 사용 1 → 10에서 5 남음");
  eq(s.grants[0].revoked, 4, "회수 수 표시");
}
// 만료
{
  const s = a.summarizeCredits([g("old", "monthly", 5, -1, 40), g("w", "welcome", 5, 10)], [], NOW);
  eq(s.remaining, 5, "만료된 지급은 잔여에서 제외");
  eq(s.grants.find((x) => x.id === "old")?.expired, true, "만료 표시");
  eq(s.next_expires_at, iso(NOW + 10 * day), "다음 만료는 만료 안 된 것 중에서");
}
eq(a.summarizeCredits([], [], NOW), { remaining: 0, next_expires_at: null, grants: [] }, "지급 없음 → 잔여 0·만료 null");
eq(a.summarizeCredits([g("z", "admin", 3, 5)], [e("a", "z", "use", 1), e("b", "z", "use", 1), e("c", "z", "use", 1)], NOW).remaining, 0, "다 쓰면 잔여 0");
eq(a.summarizeCredits([g("z", "admin", 3, 5)], [e("a", "z", "revoke", 9)], NOW).grants[0].left, 0, "초과 회수 기록이 있어도 남은 수는 음수가 되지 않음(0)");
eq(a.summarizeCredits([g("old", "admin", 3, 5, 10), g("new", "admin", 3, 5, 1)], [], NOW).grants.map((x) => x.id), ["new", "old"], "지급 줄은 최근 지급이 위");
eq(a.summarizeCredits([g("z", "admin", 3, 5)], [e("a", "other", "use", 1)], NOW).remaining, 3, "다른 지급 줄의 사용은 이 줄에 영향 없음");

// 수동 지급 입력 검증
eq(a.parseGrantInput({ quantity: 5, reason: "  이벤트 보상 " }), { ok: true, quantity: 5, reason: "이벤트 보상" }, "지급: 정상(사유 앞뒤 공백 제거)");
eq(a.parseGrantInput({ quantity: 1, reason: "x" }).ok, true, "지급: 최소 1");
eq(a.parseGrantInput({ quantity: 100, reason: "x" }).ok, true, "지급: 최대 100");
for (const q of [0, -1, 101, 1.5, "5", null, undefined, NaN]) eq(a.parseGrantInput({ quantity: q, reason: "x" }), { ok: false, error: "수량은 1~100 사이의 정수로 입력해주세요.", field: "quantity" }, `지급: 수량 ${String(q)} 거부`);
for (const r of ["", "   ", undefined, null, 5]) eq((a.parseGrantInput({ quantity: 3, reason: r }) as { field?: string }).field, "reason", `지급: 사유 ${JSON.stringify(r)} 거부`);
eq(a.parseGrantInput({ quantity: 3, reason: "가".repeat(201) }).ok, false, "지급: 사유 201자 거부");
eq(a.parseGrantInput({ quantity: 3, reason: "가".repeat(200) }).ok, true, "지급: 사유 200자 허용");
eq(a.parseGrantInput(null).ok, false, "지급: 본문 없음 거부");

// 회수 입력 검증
const GID = "00000000-0000-4000-8000-0000000000b1";
eq(a.parseRevokeInput({ grant_id: GID, quantity: 2, reason: " 오지급 " }), { ok: true, grantId: GID, quantity: 2, reason: "오지급" }, "회수: 정상(사유 공백 제거)");
for (const gid of [undefined, null, "", "abc", 5, GID + "x"]) eq((a.parseRevokeInput({ grant_id: gid, quantity: 1, reason: "x" }) as { field?: string }).field, "grant_id", `회수: grant_id ${JSON.stringify(gid)} 거부`);
eq((a.parseRevokeInput({ grant_id: GID, quantity: 0, reason: "x" }) as { field?: string }).field, "quantity", "회수: 수량 0 거부");
eq((a.parseRevokeInput({ grant_id: GID, quantity: 1.5, reason: "x" }) as { field?: string }).field, "quantity", "회수: 수량 소수 거부");
eq((a.parseRevokeInput({ grant_id: GID, quantity: "2", reason: "x" }) as { field?: string }).field, "quantity", "회수: 수량 문자열 거부");
eq((a.parseRevokeInput({ grant_id: GID, quantity: 2, reason: "  " }) as { field?: string }).field, "reason", "회수: 사유 공백 거부");
eq(a.parseRevokeInput(null).ok, false, "회수: 본문 없음 거부");

// 만료 시각 = 지급 시각 + 90일
eq(a.adminGrantExpiresAt(NOW), iso(NOW + 90 * day), "수동 지급 만료 = 지급 시각 + 90일");
eq([a.ADMIN_GRANT_MAX, a.ADMIN_GRANT_DAYS], [100, 90], "상수: 최대 100 · 90일(DB check와 같음)");
eq(a.SOURCE_LABEL, { monthly: "월 무료", welcome: "웰컴", admin: "관리자 지급" }, "지급 종류 라벨");

console.log(`\n${n}건 통과`);
