import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

type PartnerReferralStatRow = {
  partner_id: string;
  total_referrals: number;
  this_month_referrals: number;
  business_verified_referrals: number;
};

// 2026-09-27: 운영자가 승인된 점핑파트너 전원의 추천 실적을 한눈에 보는 집계
// 대시보드. 처음엔 추천 회원 행을 전부 select해서 JS로 집계했으나 두 문제가
// 발견됨 — (1) Supabase 기본 응답 한도(1,000행)를 추천 회원 총합이 넘으면 실적이
// 실제보다 적게 잡힘, (2) "이번 달"을 서버(UTC) 기준으로 계산해 매달 1일
// 00~09시(KST) 가입자가 지난달로 잘못 집계됨. schema.sql의
// admin_partner_referral_stats() RPC로 DB에서 파트너별 group by + KST 기준
// 월 비교를 직접 하도록 수정 — 결과 행 수가 "파트너 수"라 한도 문제가 없음.
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ items: [], demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const [{ data: partners, error: partnersError }, { data: stats, error: statsError }] = await Promise.all([
    supabaseAdmin
      .from("members")
      .select("id, phone, company_name, name, member_no, ref_code, created_at")
      .eq("is_official_partner", true)
      .order("created_at", { ascending: true }),
    supabaseAdmin.rpc("admin_partner_referral_stats") as unknown as Promise<{
      data: PartnerReferralStatRow[] | null;
      error: { message: string } | null;
    }>,
  ]);
  if (partnersError) return NextResponse.json({ error: partnersError.message }, { status: 500 });
  if (statsError) return NextResponse.json({ error: statsError.message }, { status: 500 });

  const statsByPartnerId = new Map((stats ?? []).map((s) => [s.partner_id, s]));

  const items = (partners ?? [])
    .map((p) => {
      const s = statsByPartnerId.get(p.id);
      return {
        id: p.id,
        phone: p.phone,
        company_name: p.company_name,
        name: p.name,
        member_no: p.member_no,
        ref_code: p.ref_code,
        partner_since: p.created_at,
        total_referrals: s?.total_referrals ?? 0,
        this_month_referrals: s?.this_month_referrals ?? 0,
        business_verified_referrals: s?.business_verified_referrals ?? 0,
      };
    })
    .sort((a, b) => b.total_referrals - a.total_referrals);

  return NextResponse.json({ items });
}
