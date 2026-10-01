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

  const merged = [
    ...(memberData ?? []).map((d) => ({ ...d, source: "member" as const })),
    ...(quickData ?? []).map((d) => ({ ...d, source: "quick" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  // 2026-10-01: 리드 연락처가 담긴 목록 조회 — 호출 단위로 감사 로그
  await writeAudit(supabaseAdmin, req, { admin: auth.admin, action: "interests_list_view", targetType: "interests", detail: { count: merged.length } });

  return NextResponse.json({ items: merged });
}

// 연락 완료 체크 / 거래 성사·불발 처리
export async function PATCH(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, source, contacted, outcome, completedAmount } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const supabaseAdmin = getAdminClient();
  const table = source === "quick" ? "quick_leads" : "interests";
  const update: Record<string, unknown> = {};
  if (contacted !== undefined) update.contacted = contacted;
  if (outcome !== undefined) {
    update.outcome = outcome;
    update.completed_at = outcome === "pending" ? null : new Date().toISOString();
  }
  if (completedAmount !== undefined) update.completed_amount = completedAmount;

  const { error } = await supabaseAdmin.from(table).update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
