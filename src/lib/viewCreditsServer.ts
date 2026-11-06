import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRow, GrantRow } from "@/lib/viewCreditsAdmin";

// 열람권 원장 서버 공용 (2026-11-06 2-1) — 서버 전용: 컴포넌트·페이지·"use client" 파일에서 import하지 않는다(소스 검사: scripts/view-credits-test.mts).
// 원장(view_credit_grants·view_credit_events)과 함수 3개는 service role만 실행 — 클라이언트는 호출하는 쪽(2-3 라우트)이 service role로 만들어 넘긴다. 이 모듈은 만들지 않음.
// 빈 응답·rpc 오류·모르는 결과는 전부 throw — 허용·지급으로 대체하지 않는다.
// 호출처: 관리자 회원 상세(src/app/api/admin/members/[id]/…). 회원용 [연락처 보기] 라우트(2-3)는 아직 없음.
// 관리자 조회·지급은 view_credit_balance를 쓰지 않는다 — 그 함수는 안에서 월·웰컴 지급(INSERT)까지 하므로 표를 직접 읽는다(listViewCredits).

export type ViewCreditBalance = { remaining: number; nextExpiresAt: string | null };
export type ConsumeResult = "used" | "already" | "no_credit";
export type ViewCreditConsume = { result: ConsumeResult; remaining: number };

function firstRow(fn: string, data: unknown, error: { message?: string } | null): Record<string, unknown> {
  if (error) throw new Error(`${fn} rpc 오류: ${error.message ?? "unknown"}`);
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || data[0] === null) {
    throw new Error(`${fn} rpc 응답이 비었어요`);
  }
  return data[0] as Record<string, unknown>;
}

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** 남은 열람권과 가장 빨리 끝나는 열람권의 만료 시각(없으면 null) — rpc view_credit_balance */
export async function getViewCreditBalance(db: SupabaseClient, memberId: string): Promise<ViewCreditBalance> {
  const { data, error } = await db.rpc("view_credit_balance", { p_member: memberId });
  const row = firstRow("view_credit_balance", data, error);
  const { remaining, next_expires_at: next } = row;
  if (!isCount(remaining)) throw new Error("view_credit_balance rpc 응답 형식 오류");
  if (next !== null && typeof next !== "string") throw new Error("view_credit_balance rpc 응답 형식 오류");
  return { remaining, nextExpiresAt: next };
}

/** 이 매물 열람 1회 차감 — used(차감) · already(이미 열람한 매물, 차감 없음) · no_credit(잔량 없음). rpc view_credit_consume */
export async function consumeViewCredit(db: SupabaseClient, memberId: string, dealId: string): Promise<ViewCreditConsume> {
  const { data, error } = await db.rpc("view_credit_consume", { p_member: memberId, p_deal: dealId });
  const row = firstRow("view_credit_consume", data, error);
  const { result, remaining } = row;
  if (result !== "used" && result !== "already" && result !== "no_credit") throw new Error("view_credit_consume rpc 결과 값 오류");
  if (!isCount(remaining)) throw new Error("view_credit_consume rpc 응답 형식 오류");
  return { result, remaining };
}

export type RevokeResult = "revoked" | "not_found" | "expired" | "exceeds" | "invalid";
export type ViewCreditRevoke = { result: RevokeResult; remainingAfter: number };

/** 열람권 회수(관리자) — SQL 함수 view_credit_revoke가 회원 advisory lock 안에서 잔량 검사 + 회수 행 insert를 한 트랜잭션으로. revoked · not_found(다른 회원 지급 줄 포함) · expired · exceeds(remainingAfter = 현재 남은 수) · invalid */
export async function revokeViewCredit(db: SupabaseClient, memberId: string, grantId: string, quantity: number, reason: string, adminId: string): Promise<ViewCreditRevoke> {
  const { data, error } = await db.rpc("view_credit_revoke", { p_member: memberId, p_grant: grantId, p_quantity: quantity, p_reason: reason, p_admin: adminId });
  const row = firstRow("view_credit_revoke", data, error);
  const { result, remaining_after: after } = row;
  if (result !== "revoked" && result !== "not_found" && result !== "expired" && result !== "exceeds" && result !== "invalid") throw new Error("view_credit_revoke rpc 결과 값 오류");
  if (!isCount(after)) throw new Error("view_credit_revoke rpc 응답 형식 오류");
  return { result, remainingAfter: after };
}

/** 관리자 조회용 — 지급·사용·회수 기록을 표에서 그대로 읽음(쓰기·지급 없음). 사용·회수는 최신 events 상한까지만 내역으로 쓰고, 잔여 계산은 전체 events로 해야 하므로 상한 없이 읽는다(회원 1명 기준 소량) */
export async function listViewCredits(db: SupabaseClient, memberId: string): Promise<{ grants: GrantRow[]; events: EventRow[] }> {
  const [g, e] = await Promise.all([
    db.from("view_credit_grants").select("id, source, quantity, period_month, expires_at, reason, created_at").eq("member_id", memberId).order("created_at", { ascending: false }).limit(500),
    db.from("view_credit_events").select("id, grant_id, kind, quantity, deal_id, reason, created_at").eq("member_id", memberId).order("created_at", { ascending: false }).limit(2000),
  ]);
  if (g.error) throw new Error(`view_credit_grants 조회 오류: ${g.error.message}`);
  if (e.error) throw new Error(`view_credit_events 조회 오류: ${e.error.message}`);
  return { grants: (g.data ?? []) as GrantRow[], events: (e.data ?? []) as EventRow[] };
}
