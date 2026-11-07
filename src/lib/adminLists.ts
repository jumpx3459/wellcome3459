import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberSearch } from "@/lib/adminMemberSearch";

// 관리자 회원·리드 목록 조립 (2026-10-06 fix/admin-super-only) — 목록 조회(GET /api/admin/members·interests)와
// 최고관리자 전용 내보내기(GET /api/admin/export)가 같은 칸을 쓰도록 한 곳에 둠. 인증·감사 로그는 부르는 라우트가 처리.

// 최근 가입 회원 300명 + 카테고리·지역·구독 여부·닉네임·추천인 번호
// opts 없으면 전부(테스트 계정 포함) 최근 300명 — 내보내기가 이 모양을 그대로 씀.
// 2026-11-07: includeTest=false면 테스트 계정(is_test) 제외, search(code·digits)가 있으면 서버에서 조건을 걸어 300명보다 오래된 회원도 찾음.
//   code   → member_no 일치만 / digits → member_no 일치 + 전화번호 부분 일치(둘 다 결과에 나옴, 번호 일치가 맨 위)
export type AdminMembersOpts = { includeTest?: boolean; search?: MemberSearch };

export async function loadAdminMembers(supabaseAdmin: SupabaseClient, opts: AdminMembersOpts = {}) {
  const search = opts.search ?? { kind: "none" };
  // 'JX' 뒤가 번호 모양이 아니거나, 번호로 쓸 수 없는 값이면 DB를 부르지 않고 결과 없음
  if (search.kind === "code" && search.no == null) return { items: [] };

  const cols =
    "id, phone, is_business, company_name, member_no, referred_by, created_at, business_verified, business_license_path, is_test";
  const base = () => {
    const q = supabaseAdmin.from("members").select(cols);
    return opts.includeTest === false ? q.eq("is_test", false) : q;
  };
  let members: Awaited<ReturnType<typeof base>>["data"];
  let error: { message: string } | null;
  if (search.kind === "digits") {
    // 번호 일치를 따로 먼저 가져와 맨 위에 둠 — 짧은 숫자(13)는 전화번호 일치가 수백 건이라 300명 상한에 번호 일치가 밀려나지 않게.
    // digits는 숫자만이라 ilike 패턴에 그대로 넣어도 안전.
    const [byNo, byPhone] = await Promise.all([
      search.no != null ? base().eq("member_no", search.no).limit(5) : Promise.resolve({ data: [], error: null }),
      base().ilike("phone", `%${search.digits}%`).order("created_at", { ascending: false }).limit(300),
    ]);
    error = byNo.error ?? byPhone.error;
    const seen = new Set<string>();
    members = [...(byNo.data ?? []), ...(byPhone.data ?? [])].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))).slice(0, 300);
  } else {
    let q = base();
    if (search.kind === "code") q = q.eq("member_no", search.no as number);
    ({ data: members, error } = await q.order("created_at", { ascending: false }).limit(300));
  }

  if (error) return { error: error.message };

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
    is_test: m.is_test === true,
    nickname: nicknameByMember[m.id] ?? null,
    referrer_phone: m.referred_by ? referrerPhoneById[m.referred_by] ?? null : null,
    push_subscribed: subscribedMemberIds.has(m.id),
    created_at: m.created_at,
    categories: catsByMember[m.id] ?? [],
    regions: regsByMember[m.id] ?? [],
  }));

  return { items };
}

// 매물에 "관심있어요"를 누른 리드 — 회원(interests) + 원클릭(quick_leads) 각 100건, 최신순
export async function loadAdminLeads(supabaseAdmin: SupabaseClient) {
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

  if (memberError) return { error: memberError.message };
  if (quickError) return { error: quickError.message };

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
  return { items: merged };
}
