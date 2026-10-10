import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { phoneTail, writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";
import { connectionScopeDenied } from "@/lib/adminScope";

// 2026-10-04 F-4 [번호 보기] — 연결 구매자 전체 번호. 회원은 members.phone, 비회원은 buyer_phone.
// 호출할 때마다 감사 로그(번호는 phoneTail 뒤 4자리만). POST라 브라우저·중간 캐시에 남지 않음.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/connections/[id]/phone">) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "connections"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const db = auth.db;
  const { data: conn, error } = await db
    .from("deal_connections")
    .select("id, deal_id, buyer_member_id, buyer_phone, assigned_admin_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "연결 기록을 불러오지 못했어요." }, { status: 500 });
  if (!conn) return NextResponse.json({ error: "연결 기록을 찾을 수 없어요." }, { status: 404 });
  const scoped = connectionScopeDenied(auth.admin, conn.assigned_admin_id); // 2026-10-10 점핑매니저는 배정된 건만
  if (scoped) return scoped;

  let phone: string | null = conn.buyer_phone;
  if (conn.buyer_member_id) {
    const { data: m, error: mError } = await db.from("members").select("phone").eq("id", conn.buyer_member_id).maybeSingle();
    if (mError) return NextResponse.json({ error: "회원 번호를 불러오지 못했어요." }, { status: 500 });
    phone = m?.phone ?? null;
  }
  if (!phone) return NextResponse.json({ error: "번호가 없어요(탈퇴·삭제)." }, { status: 404 });

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "connection_phone_view",
    targetType: "deal_connection",
    targetId: id,
    detail: { deal_id: conn.deal_id, buyer: conn.buyer_member_id ? "member" : "guest", phone: phoneTail(phone) },
  });
  return NextResponse.json({ phone: normalizePhone(phone) });
}
