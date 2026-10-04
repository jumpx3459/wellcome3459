import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// 매물에 "관심있어요"를 누른 리드 목록 (점핑매니저가 연락할 대상)
// 정식 회원(interests)과 회원가입 없이 번호만 남긴 원클릭 리드(quick_leads)를 합쳐서 보여줍니다.
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = getAdminClient();

  const [{ data: memberData, error: memberError }, { data: quickData, error: quickError }] =
    await Promise.all([
      supabaseAdmin
        .from("interests")
        .select(
          "id, contacted, outcome, completed_amount, completed_at, created_at, deals(id, title, deal_price), members(phone, is_business, member_no, business_verified)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("quick_leads")
        .select(
          "id, contacted, outcome, completed_amount, completed_at, created_at, phone, deals(id, title, deal_price)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
  if (quickError) return NextResponse.json({ error: quickError.message }, { status: 500 });

  // 2026-10-03 F-3a: 판매자 연결 동의 배지 — deal_connections.source_id가 interests.id / quick_leads.id (읽기 전용).
  // 조회 실패해도 목록은 그대로(배지만 없음)
  // 2026-10-04 F-4: 연결 기록이 있는 리드(has_connection)는 리드 카드에서 [성사]·[불발] 대신 "연결 보드에서 처리".
  // connection_state: 진행 중 연결이 하나라도 있으면 open, 없으면 가장 최근 종료 연결이 취소면 cancelled, 아니면 closed(성사·불발 — 리드 outcome에 반영됨)
  const ids = [...(memberData ?? []), ...(quickData ?? [])].map((d) => d.id);
  const consentBySource = new Map<string, string>();
  const connectedSources = new Set<string>();
  const latestState = new Map<string, { open: boolean; closedAt: string; cancelled: boolean }>();
  if (ids.length) {
    const { data: connRows, error: connError } = await supabaseAdmin
      .from("deal_connections")
      .select("source, source_id, consent_at, status, result, closed_at")
      .in("source", ["interest", "quick_lead"])
      .in("source_id", ids);
    if (connError) console.error("[admin/interests] 연결 조회 실패", connError.code, connError.message);
    for (const c of connRows ?? []) {
      const key = `${c.source}:${c.source_id}`;
      connectedSources.add(key);
      const prevState = latestState.get(key) ?? { open: false, closedAt: "", cancelled: false };
      if (c.status !== "closed") prevState.open = true;
      else if ((c.closed_at ?? "") >= prevState.closedAt) {
        prevState.closedAt = c.closed_at ?? "";
        prevState.cancelled = c.result === "cancelled";
      }
      latestState.set(key, prevState);
      if (!c.consent_at) continue;
      const prev = consentBySource.get(key);
      if (!prev || c.consent_at > prev) consentBySource.set(key, c.consent_at);
    }
  }

  const connectionState = (key: string): "open" | "cancelled" | "closed" | null => {
    const st = latestState.get(key);
    return !st ? null : st.open ? "open" : st.cancelled ? "cancelled" : "closed";
  };
  const withConnection = (key: string) => ({
    connection_consent_at: consentBySource.get(key) ?? null,
    has_connection: connectedSources.has(key),
    connection_state: connectionState(key),
  });
  const merged = [
    ...(memberData ?? []).map((d) => ({ ...d, source: "member" as const, ...withConnection(`interest:${d.id}`) })),
    ...(quickData ?? []).map((d) => ({ ...d, source: "quick" as const, ...withConnection(`quick_lead:${d.id}`) })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  // 2026-10-01: 리드 연락처가 담긴 목록 조회 — 호출 단위로 감사 로그
  await writeAudit(supabaseAdmin, req, { admin: auth.admin, action: "interests_list_view", targetType: "interests", detail: { count: merged.length } });

  return NextResponse.json({ items: merged });
}

const LEAD_OUTCOMES = ["pending", "completed", "no_deal"];

// 연락 완료 체크 / 거래 성사·불발 처리
export async function PATCH(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, source, contacted, outcome, completedAmount } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  // 2026-10-01 F-1: 값 검증 — outcome은 세 값만, 성사 금액은 0 이상 숫자(또는 비우기 null)
  if (contacted !== undefined && typeof contacted !== "boolean") return NextResponse.json({ error: "연락 상태 값이 올바르지 않아요.", field: "contacted" }, { status: 400 });
  if (outcome !== undefined && !LEAD_OUTCOMES.includes(outcome)) return NextResponse.json({ error: "결과 값이 올바르지 않아요.", field: "outcome" }, { status: 400 });
  if (completedAmount !== undefined && completedAmount !== null && !(typeof completedAmount === "number" && Number.isFinite(completedAmount) && completedAmount >= 0)) {
    return NextResponse.json({ error: "성사 금액은 0 이상 숫자여야 해요.", field: "completedAmount" }, { status: 400 });
  }

  const supabaseAdmin = getAdminClient();
  const table = source === "quick" ? "quick_leads" : "interests";
  const update: Record<string, unknown> = {};
  if (contacted !== undefined) update.contacted = contacted;
  if (outcome !== undefined) {
    update.outcome = outcome;
    update.completed_at = outcome === "pending" ? null : new Date().toISOString();
  }
  if (completedAmount !== undefined) update.completed_amount = completedAmount;
  if (!Object.keys(update).length) return NextResponse.json({ error: "바꿀 값이 없어요." }, { status: 400 });

  // 감사 로그용 이전 값
  const { data: before } = await supabaseAdmin.from(table).select("deal_id, contacted, outcome, completed_amount").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "없는 리드예요." }, { status: 404 });

  const { error } = await supabaseAdmin.from(table).update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pick = (o: Record<string, unknown>) => ({
    contacted: o.contacted,
    outcome: o.outcome,
    completed_amount: o.completed_amount,
  });
  await writeAudit(supabaseAdmin, req, {
    admin: auth.admin,
    action: "lead_update",
    targetType: table === "quick_leads" ? "quick_lead" : "interest",
    targetId: String(id),
    detail: { deal_id: before.deal_id, before: pick(before), after: pick({ ...before, ...update }) },
  });

  return NextResponse.json({ ok: true });
}
