import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { can } from "@/lib/adminPerms";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { phoneTail, writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { businessState, DETAIL_LIST_LIMIT, latestConsents, onlyOwn, type ConsentRow, type MemberDetail } from "@/lib/adminMemberDetail";

// 2026-10-23 관리자 회원 상세(보기 전용) — 회원 1명의 가입·사업자·동의·알림·활동을 한 번에.
// 권한: members(최고관리자·관리자, 점핑매니저 403). 번호: 최고관리자 전체 / 관리자 가린 번호(기존 목록과 같은 규칙, 전체는 [번호 보기]).
// 비회원 행(quick_leads·member_id 없는 buy_requests·buyer_member_id 없는 deal_connections·seller_member_id 없는 seller_requests)은
// 번호가 같아도 조회하지 않음 — 쿼리가 회원 키로만 걸고, 받은 뒤에도 onlyOwn으로 한 번 더 거른다.
// 응답에 신청서 연락처·사업자등록번호 원문·등록증 경로는 넣지 않음(등록증은 기존 business-license 열람 API). select 칸은 전부 명시.
// 열람 감사 로그 member_detail_view(detail: 번호 뒤 4자리만) — 기록 실패는 응답을 막지 않음(writeAudit).
type Row = Record<string, unknown>;
type Named = { name: string };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "members");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const db = auth.db;

  // 1) 회원 1행 — utm 칸은 SQL(20261015) 실행 전엔 없을 수 있어 칸 없음 오류면 utm 없이 다시
  const baseCols = "id, phone, member_no, created_at, is_test, is_business, company_name, business_verified, business_license_path, referred_by, is_official_partner, push_opt_out";
  let utmAvailable = true;
  let mres = await db.from("members").select(`${baseCols}, utm_source, utm_medium, utm_campaign`).eq("id", id).maybeSingle();
  if (mres.error && /utm_/.test(mres.error.message ?? "")) {
    utmAvailable = false;
    mres = (await db.from("members").select(baseCols).eq("id", id).maybeSingle()) as typeof mres;
  }
  if (mres.error) return NextResponse.json({ error: "회원 정보를 불러오지 못했어요." }, { status: 500 });
  const m = mres.data as unknown as Row | null;
  if (!m) return NextResponse.json({ error: "회원을 찾을 수 없어요." }, { status: 404 });
  const referredBy = (m.referred_by as string | null) ?? null;

  // 2) 나머지는 병렬 — 전부 회원 키로만 건다
  const [cats, regs, pushCnt, consents, authUser, referrer, referredCnt, sellers, buys, interests, conns, partner, verifyLog] = await Promise.all([
    db.from("member_categories").select("member_id, categories(name)").eq("member_id", id),
    db.from("member_regions").select("member_id, regions(name)").eq("member_id", id),
    db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("member_id", id),
    db.from("member_consents").select("consent_type, agreed, terms_version, source, created_at").eq("member_id", id).order("created_at", { ascending: false }).limit(200),
    db.auth.admin.getUserById(id),
    referredBy ? db.from("members").select("id, member_no, phone").eq("id", referredBy).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from("members").select("id", { count: "exact", head: true }).eq("referred_by", id),
    db.from("seller_requests").select("id, product_name, status, created_at, linked_deal_id, seller_member_id").eq("seller_member_id", id).order("created_at", { ascending: false }).limit(DETAIL_LIST_LIMIT),
    db.from("buy_requests").select("id, product_name, outcome, contacted, created_at, member_id, categories(name)").eq("member_id", id).order("created_at", { ascending: false }).limit(DETAIL_LIST_LIMIT),
    db.from("interests").select("id, contacted, outcome, created_at, member_id, deals(title, status)").eq("member_id", id).order("created_at", { ascending: false }).limit(DETAIL_LIST_LIMIT),
    db.from("deal_connections").select("id, deal_title_snapshot, status, result, created_at, buyer_member_id").eq("buyer_member_id", id).order("created_at", { ascending: false }).limit(DETAIL_LIST_LIMIT),
    db.from("partner_requests").select("status, created_at, member_id").eq("member_id", id).order("created_at", { ascending: false }).limit(1),
    db.from("admin_audit_logs").select("created_at").eq("action", "business_verify").eq("target_id", id).order("created_at", { ascending: false }).limit(1),
  ]);

  // 신청서에 연결된 매물(제목·상태·마감) — 연결 id가 있을 때만 1회 더
  const sellerRows = onlyOwn((sellers.data ?? []) as Row[], "seller_member_id", id);
  const dealIds = [...new Set(sellerRows.map((r) => r.linked_deal_id as string | null).filter((v): v is string => !!v))];
  const dealsById = new Map<string, Row>();
  if (dealIds.length) {
    const { data: ds } = await db.from("deals").select("id, title, status, closes_at").in("id", dealIds);
    for (const d of (ds ?? []) as Row[]) dealsById.set(d.id as string, d);
  }

  const meta = (authUser as { data?: { user?: { user_metadata?: Record<string, unknown> } } })?.data?.user?.user_metadata;
  const nickname = (meta?.name as string) || (meta?.full_name as string) || (meta?.nickname as string) || (meta?.user_name as string) || null;
  const ref = one(referrer.data as Row | Row[] | null);
  const verifiedAt = (one(verifyLog.data as Row[] | null)?.created_at as string | undefined) ?? null;
  const full = can(auth.admin.role, "memberPhoneFull");
  const phoneRaw = (m.phone as string | null) ?? "";
  const partnerRow = onlyOwn((partner.data ?? []) as Row[], "member_id", id)[0];

  const detail: MemberDetail = {
    member: {
      id,
      member_no: (m.member_no as number | null) ?? null,
      phone: full ? normalizePhone(phoneRaw) : maskPhone(phoneRaw),
      phone_masked: !full,
      created_at: m.created_at as string,
      is_test: m.is_test === true,
      nickname,
      company_name: (m.company_name as string | null) ?? null,
      is_business: m.is_business === true,
      is_official_partner: m.is_official_partner === true,
      push_opt_out: m.push_opt_out === true,
      utm:
        utmAvailable && (m.utm_source || m.utm_medium || m.utm_campaign)
          ? { source: (m.utm_source as string | null) ?? null, medium: (m.utm_medium as string | null) ?? null, campaign: (m.utm_campaign as string | null) ?? null }
          : null,
      referrer: ref ? { member_no: (ref.member_no as number | null) ?? null, phone_masked: maskPhone(ref.phone as string | null) } : null,
      referred_count: referredCnt.count ?? 0,
      partner_request: partnerRow ? { status: partnerRow.status as string, created_at: partnerRow.created_at as string } : null,
    },
    business: businessState({ business_verified: m.business_verified === true, has_license: Boolean(m.business_license_path) }, verifiedAt),
    consents: latestConsents((consents.data ?? []) as ConsentRow[]),
    push_device_count: pushCnt.count ?? 0,
    categories: ((cats.data ?? []) as Row[]).map((r) => one(r.categories as Named | Named[] | null)?.name ?? "").filter(Boolean),
    regions: ((regs.data ?? []) as Row[]).map((r) => one(r.regions as Named | Named[] | null)?.name ?? "").filter(Boolean),
    seller_requests: sellerRows.map((r) => {
      const d = r.linked_deal_id ? dealsById.get(r.linked_deal_id as string) : null;
      return {
        id: r.id as string,
        product_name: (r.product_name as string | null) ?? null,
        status: (r.status as string | null) ?? null,
        created_at: r.created_at as string,
        linked_deal: d ? { title: d.title as string, status: (d.status as string | null) ?? null, closes_at: d.closes_at as string } : null,
      };
    }),
    buy_requests: onlyOwn((buys.data ?? []) as Row[], "member_id", id).map((r) => ({
      id: r.id as string,
      product_name: r.product_name as string,
      category: one(r.categories as Named | Named[] | null)?.name ?? null,
      outcome: (r.outcome as string | null) ?? null,
      contacted: (r.contacted as boolean | null) ?? null,
      created_at: r.created_at as string,
    })),
    interests: onlyOwn((interests.data ?? []) as Row[], "member_id", id).map((r) => {
      const d = one(r.deals as { title: string; status: string | null } | { title: string; status: string | null }[] | null);
      return { id: r.id as string, deal_title: d?.title ?? null, deal_status: d?.status ?? null, contacted: (r.contacted as boolean | null) ?? null, outcome: (r.outcome as string | null) ?? null, created_at: r.created_at as string };
    }),
    connections: onlyOwn((conns.data ?? []) as Row[], "buyer_member_id", id).map((r) => ({
      id: r.id as string,
      deal_title: r.deal_title_snapshot as string,
      status: r.status as string,
      result: (r.result as string | null) ?? null,
      created_at: r.created_at as string,
    })),
  };

  await writeAudit(db, req, { admin: auth.admin, action: "member_detail_view", targetType: "member", targetId: id, detail: { phone: phoneTail(phoneRaw) } });
  return NextResponse.json(detail);
}
