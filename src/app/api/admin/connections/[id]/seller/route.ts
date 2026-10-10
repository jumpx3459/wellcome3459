import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { phoneTail, writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { connectionScopeDenied } from "@/lib/adminScope";
import { linkedSellerRequest, parseSellerPrivateFields, saveSellerPrivate, type SellerPrivateVia } from "@/lib/sellerPrivate";

// 2026-10-04 F-4 연결 상세 — 판매자 비공개 정보(상호·담당자·연락처 + 메모). 연결 id로 받아 그 매물의 deal_seller_private 1행.
// GET: 저장된 값(없으면 null) + 판매 신청 매물이고 3칸이 비었으면 신청 정보(suggest, 처음 채울 때 참고 — ③ 허락만 저장된 행 포함). PUT: 저장(연락처 normalizePhone).
// 조회·저장 모두 감사 로그 — detail에 값은 넣지 않음(바뀐 칸 이름·연락처 뒤 4자리만).

async function dealOf(db: import("@supabase/supabase-js").SupabaseClient, id: string) {
  const { data, error } = await db.from("deal_connections").select("id, deal_id, assigned_admin_id").eq("id", id).maybeSingle();
  return { deal: data as { id: string; deal_id: string; assigned_admin_id: string | null } | null, error };
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/connections/[id]/seller">) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerPrivate"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const db = auth.db;
  const { deal, error } = await dealOf(db, id);
  if (error) return NextResponse.json({ error: "연결 기록을 불러오지 못했어요." }, { status: 500 });
  if (!deal) return NextResponse.json({ error: "연결 기록을 찾을 수 없어요." }, { status: 404 });
  const scoped = connectionScopeDenied(auth.admin, deal.assigned_admin_id); // 2026-10-10 점핑매니저는 배정된 건(= 담당 매물)만
  if (scoped) return scoped;

  const [{ data: item, error: privError }, request] = await Promise.all([
    db
      .from("deal_seller_private")
      .select("company_name, contact_name, contact_phone, memo, source, name_disclosure_ok, name_disclosure_at, updated_at")
      .eq("deal_id", deal.deal_id)
      .maybeSingle(),
    linkedSellerRequest(db, deal.deal_id),
  ]);
  if (privError) return NextResponse.json({ error: "판매자 정보를 불러오지 못했어요." }, { status: 500 });

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "seller_private_view",
    targetType: "deal",
    targetId: deal.deal_id,
    detail: { connection_id: id, has_row: !!item },
  });
  return NextResponse.json({
    item: item ?? null,
    source: item?.source ?? (request ? "seller_request" : "admin_direct"),
    suggest: request && !(item?.company_name || item?.contact_name || item?.contact_phone) ? { company_name: request.company_name, contact_name: request.contact_name, contact_phone: request.contact_phone } : null,
  });
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/connections/[id]/seller">) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerPrivate"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseSellerPrivateFields(body, { requireCompany: false, requirePhone: false, withMemo: true });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });

  const db = auth.db;
  const { deal, error } = await dealOf(db, id);
  if (error) return NextResponse.json({ error: "연결 기록을 불러오지 못했어요." }, { status: 500 });
  if (!deal) return NextResponse.json({ error: "연결 기록을 찾을 수 없어요." }, { status: 404 });
  const scoped = connectionScopeDenied(auth.admin, deal.assigned_admin_id); // 2026-10-10 점핑매니저는 배정된 건(= 담당 매물)만
  if (scoped) return scoped;

  const { data: before } = await db
    .from("deal_seller_private")
    .select("company_name, contact_name, contact_phone, memo")
    .eq("deal_id", deal.deal_id)
    .maybeSingle();
  const next = { ...parsed.value, memo: parsed.value.memo ?? null };
  const saved = await saveSellerPrivate(db, deal.deal_id, auth.admin.id, next);
  if (!saved.ok) {
    console.error("[admin/connections/seller] 저장 실패", saved.message);
    return NextResponse.json({ error: "판매자 정보를 저장하지 못했어요." }, { status: 500 });
  }
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => (before?.[k] ?? null) !== next[k]);
  await writeAudit(db, req, {
    admin: auth.admin,
    action: "seller_private_save",
    targetType: "deal",
    targetId: deal.deal_id,
    detail: { via: "connection_board" satisfies SellerPrivateVia, connection_id: id, created: saved.created, changed, contact_phone: phoneTail(next.contact_phone) },
  });
  return NextResponse.json({ ok: true });
}
