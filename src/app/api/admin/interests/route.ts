import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { loadAdminLeads } from "@/lib/adminLists";

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

  const result = await loadAdminLeads(supabaseAdmin);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  // 2026-10-01: 리드 연락처가 담긴 목록 조회 — 호출 단위로 감사 로그
  await writeAudit(supabaseAdmin, req, { admin: auth.admin, action: "interests_list_view", targetType: "interests", detail: { count: result.items.length } });

  return NextResponse.json({ items: result.items });
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
