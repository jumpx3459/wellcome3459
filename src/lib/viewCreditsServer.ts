import type { SupabaseClient } from "@supabase/supabase-js";

// 열람권 원장 서버 공용 (2026-11-06 2-1) — 서버 전용: 컴포넌트·페이지·"use client" 파일에서 import하지 않는다(소스 검사: scripts/view-credits-test.mts).
// 원장(view_credit_grants·view_credit_events)과 함수 3개는 service role만 실행 — 클라이언트는 호출하는 쪽(2-3 라우트)이 service role로 만들어 넘긴다. 이 모듈은 만들지 않음.
// 빈 응답·rpc 오류·모르는 결과는 전부 throw — 허용·지급으로 대체하지 않는다. 이 PR에서는 호출처 없음.

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
