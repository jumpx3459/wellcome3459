import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

// 2026-09-27: 운영자가 승인된 점핑파트너 전원의 추천 실적을 한눈에 보는 집계
// 대시보드. /api/admin/members(최근 300명 제한)에 의존하면 회원이 늘어날수록
// 오래된 추천 관계가 누락돼 파트너 실적이 실제보다 적게 잡힐 수 있어, 전용
// 쿼리로 분리 — 파트너 수만큼만 조회하므로 제한을 둘 필요가 없음.
export async function GET(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ items: [], demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: partners, error: partnersError } = await supabaseAdmin
    .from("members")
    .select("id, phone, company_name, name, member_no, ref_code, created_at")
    .eq("is_official_partner", true)
    .order("created_at", { ascending: true });
  if (partnersError) return NextResponse.json({ error: partnersError.message }, { status: 500 });

  const partnerIds = (partners ?? []).map((p) => p.id);
  if (partnerIds.length === 0) return NextResponse.json({ items: [] });

  const { data: referred, error: referredError } = await supabaseAdmin
    .from("members")
    .select("referred_by, created_at, business_verified")
    .in("referred_by", partnerIds);
  if (referredError) return NextResponse.json({ error: referredError.message }, { status: 500 });

  const now = new Date();
  const items = (partners ?? [])
    .map((p) => {
      const mine = (referred ?? []).filter((r) => r.referred_by === p.id);
      const thisMonth = mine.filter((r) => {
        const d = new Date(r.created_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;
      const businessVerified = mine.filter((r) => r.business_verified).length;
      return {
        id: p.id,
        phone: p.phone,
        company_name: p.company_name,
        name: p.name,
        member_no: p.member_no,
        ref_code: p.ref_code,
        partner_since: p.created_at,
        total_referrals: mine.length,
        this_month_referrals: thisMonth,
        business_verified_referrals: businessVerified,
      };
    })
    .sort((a, b) => b.total_referrals - a.total_referrals);

  return NextResponse.json({ items });
}
