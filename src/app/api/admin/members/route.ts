import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";

// 최근 가입 회원 목록 (관리자용 - 신규 가입 현황 파악)
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: members, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, phone, is_business, company_name, member_no, referred_by, created_at, business_verified, business_license_path"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 2026-10-01: 회원 연락처가 담긴 목록 조회 — 호출 단위로 감사 로그
  await writeAudit(supabaseAdmin, req, { admin: auth.admin, action: "members_list_view", targetType: "members", detail: { count: members?.length ?? 0 } });

  const memberIds = (members ?? []).map((m) => m.id);
  const catsByMember: Record<string, string[]> = {};
  const regsByMember: Record<string, string[]> = {};
  const nicknameByMember: Record<string, string | null> = {};
  const referrerPhoneById: Record<string, string> = {};
  const subscribedMemberIds = new Set<string>();

  if (memberIds.length > 0) {
    const referrerIds = [...new Set((members ?? []).map((m) => m.referred_by).filter(Boolean))] as string[];

    const [{ data: catRows }, { data: regRows }, { data: pushRows }, { data: referrerRows }, ...authResults] =
      await Promise.all([
        supabaseAdmin.from("member_categories").select("member_id, categories(name)").in("member_id", memberIds),
        supabaseAdmin.from("member_regions").select("member_id, regions(name)").in("member_id", memberIds),
        supabaseAdmin.from("push_subscriptions").select("member_id").in("member_id", memberIds),
        referrerIds.length > 0
          ? supabaseAdmin.from("members").select("id, phone").in("id", referrerIds)
          : Promise.resolve({ data: [] as { id: string; phone: string }[] }),
        ...memberIds.map((id) => supabaseAdmin.auth.admin.getUserById(id)),
      ]);

    (catRows ?? []).forEach((r) => {
      const name = (r.categories as unknown as { name: string } | null)?.name;
      if (!name) return;
      (catsByMember[r.member_id] ??= []).push(name);
    });
    (regRows ?? []).forEach((r) => {
      const name = (r.regions as unknown as { name: string } | null)?.name;
      if (!name) return;
      (regsByMember[r.member_id] ??= []).push(name);
    });
    (pushRows ?? []).forEach((r) => subscribedMemberIds.add(r.member_id));
    (referrerRows ?? []).forEach((r) => {
      referrerPhoneById[r.id] = r.phone;
    });

    memberIds.forEach((id, i) => {
      // 카카오 로그인 시 받아온 닉네임은 Supabase Auth의 유저 메타데이터에 저장됩니다.
      const meta = (authResults[i] as { data?: { user?: { user_metadata?: Record<string, unknown> } } })?.data
        ?.user?.user_metadata;
      const nickname =
        (meta?.name as string) ||
        (meta?.full_name as string) ||
        (meta?.nickname as string) ||
        (meta?.user_name as string) ||
        null;
      nicknameByMember[id] = nickname;
    });
  }

  const items = (members ?? []).map((m) => ({
    id: m.id,
    phone: m.phone,
    is_business: m.is_business,
    company_name: m.company_name,
    member_no: m.member_no,
    business_verified: m.business_verified,
    has_business_license: Boolean(m.business_license_path),
    nickname: nicknameByMember[m.id] ?? null,
    referrer_phone: m.referred_by ? referrerPhoneById[m.referred_by] ?? null : null,
    push_subscribed: subscribedMemberIds.has(m.id),
    created_at: m.created_at,
    categories: catsByMember[m.id] ?? [],
    regions: regsByMember[m.id] ?? [],
  }));

  return NextResponse.json({ items });
}
