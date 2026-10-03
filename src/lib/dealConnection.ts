import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTION_CONSENT_VERSION } from "@/lib/consent";

// 2026-10-03 F-3a: 거래 연결 기록(deal_connections) 생성 — 회원(/api/connections)·비회원(/api/quick-interest) 공용. 서버(service role) 전용.
// 동의 시각은 서버 지금 시각, 버전은 서버 상수(CONNECTION_CONSENT_VERSION). 화면이 보낸 버전은 호출 전에 isCurrentConnectionConsent로 검사만.
// 진행 중(closed 아님) 연결은 매물·구매자당 1건(F-2 유니크 인덱스) — 23505는 오류가 아니라 "duplicate".
// 단계 이력(deal_connection_events) 'requested'도 같이 남김 — 실패해도 연결은 유지(로그만).

export function isCurrentConnectionConsent(version: unknown): boolean {
  return version === CONNECTION_CONSENT_VERSION;
}

export type ConnectionBuyer = { memberId: string } | { phone: string };

export async function createDealConnection(
  db: SupabaseClient,
  args: { dealId: string; dealTitle: string; buyer: ConnectionBuyer; source: "interest" | "quick_lead"; sourceId: string | null }
): Promise<"created" | "duplicate" | "failed"> {
  const { data, error } = await db
    .from("deal_connections")
    .insert({
      deal_id: args.dealId,
      deal_title_snapshot: args.dealTitle,
      buyer_member_id: "memberId" in args.buyer ? args.buyer.memberId : null,
      buyer_phone: "phone" in args.buyer ? args.buyer.phone : null,
      source: args.source,
      source_id: args.sourceId,
      consent_at: new Date().toISOString(),
      consent_version: CONNECTION_CONSENT_VERSION,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return "duplicate";
    console.error("[dealConnection] insert 실패", error.code, error.message);
    return "failed";
  }
  const { error: eventError } = await db.from("deal_connection_events").insert({
    connection_id: data.id,
    step: "requested",
    method: "app",
    actor_type: "system",
    memo: args.source === "interest" ? "회원 관심있어요 · 연결 동의" : "비회원 관심있어요 · 연결 동의",
  });
  if (eventError) console.error("[dealConnection] 이력 저장 실패", eventError.code, eventError.message);
  return "created";
}

/** 회원의 이 매물 진행 중(closed 아님) 연결이 있는지. 조회 실패는 null */
export async function hasOpenMemberConnection(db: SupabaseClient, dealId: string, memberId: string): Promise<boolean | null> {
  const { data, error } = await db
    .from("deal_connections")
    .select("id")
    .eq("deal_id", dealId)
    .eq("buyer_member_id", memberId)
    .neq("status", "closed")
    .limit(1);
  if (error) {
    console.error("[dealConnection] 조회 실패", error.code, error.message);
    return null;
  }
  return (data ?? []).length > 0;
}
