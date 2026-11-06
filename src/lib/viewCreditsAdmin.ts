// 열람권 원장 관리자 표시·입력 규칙 (2026-11-06) — 순수 모듈(다른 모듈 import 없음, 서버 API·화면·단위 시험 공용).
// 원장은 view_credit_grants(지급)·view_credit_events(사용·회수) — 잔여 = 지급 수량 − 사용 − 회수(만료는 계산으로만, 행 수정 없음).
// SQL 함수 view_credit_balance와 같은 계산이지만, 그 함수는 안에서 월·웰컴 지급(INSERT)까지 하므로 관리자 조회에는 쓰지 않고 표를 직접 읽어 여기서 계산한다.

/** 관리자 수동 지급 한도·기간 — view_credit_grants.quantity check(1~100)와 같음 */
export const ADMIN_GRANT_MAX = 100;
export const ADMIN_GRANT_DAYS = 90;
export const CREDIT_REASON_MAX = 200;

export type GrantRow = { id: string; source: string; quantity: number; period_month: string | null; expires_at: string; reason: string | null; created_at: string };
export type EventRow = { id: string; grant_id: string; kind: string; quantity: number; deal_id: string | null; reason: string | null; created_at: string };

export type GrantLine = {
  id: string;
  source: "monthly" | "welcome" | "admin" | string;
  quantity: number;
  used: number;
  revoked: number;
  left: number;
  expires_at: string;
  expired: boolean;
  period_month: string | null;
  reason: string | null;
  created_at: string;
};
export type CreditSummary = { remaining: number; next_expires_at: string | null; grants: GrantLine[] };

export const SOURCE_LABEL: Record<string, string> = { monthly: "월 무료", welcome: "웰컴", admin: "관리자 지급" };

/** 지급·사용·회수 → 지급 줄별 남은 수와 전체 잔여(만료 제외). 새 지급이 위로 오도록 지급 시각 내림차순 */
export function summarizeCredits(grants: GrantRow[], events: EventRow[], now: number = Date.now()): CreditSummary {
  const used = new Map<string, number>();
  const revoked = new Map<string, number>();
  for (const e of events) {
    const m = e.kind === "use" ? used : e.kind === "revoke" ? revoked : null;
    if (m) m.set(e.grant_id, (m.get(e.grant_id) ?? 0) + e.quantity);
  }
  const lines: GrantLine[] = grants.map((g) => {
    const u = used.get(g.id) ?? 0;
    const r = revoked.get(g.id) ?? 0;
    return {
      id: g.id,
      source: g.source,
      quantity: g.quantity,
      used: u,
      revoked: r,
      left: Math.max(0, g.quantity - u - r),
      expires_at: g.expires_at,
      expired: Date.parse(g.expires_at) <= now,
      period_month: g.period_month,
      reason: g.reason,
      created_at: g.created_at,
    };
  });
  lines.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const live = lines.filter((l) => !l.expired && l.left > 0);
  const next = live.map((l) => l.expires_at).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  return { remaining: live.reduce((s, l) => s + l.left, 0), next_expires_at: next, grants: lines };
}

/** 수동 지급 입력 검증 — 수량 정수 1~ADMIN_GRANT_MAX, 사유 필수(앞뒤 공백 제거 후 1~CREDIT_REASON_MAX자) */
export function parseGrantInput(body: { quantity?: unknown; reason?: unknown } | null | undefined):
  | { ok: true; quantity: number; reason: string }
  | { ok: false; error: string; field: "quantity" | "reason" } {
  const q = body?.quantity;
  if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > ADMIN_GRANT_MAX) {
    return { ok: false, error: `수량은 1~${ADMIN_GRANT_MAX} 사이의 정수로 입력해주세요.`, field: "quantity" };
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return { ok: false, error: "사유를 입력해주세요.", field: "reason" };
  if (reason.length > CREDIT_REASON_MAX) return { ok: false, error: `사유는 ${CREDIT_REASON_MAX}자 이내로 적어주세요.`, field: "reason" };
  return { ok: true, quantity: q, reason };
}

/** 수동 지급 만료 시각 — 지급 시각 + 90일 */
export const adminGrantExpiresAt = (now: number = Date.now()): string => new Date(now + ADMIN_GRANT_DAYS * 86400e3).toISOString();
