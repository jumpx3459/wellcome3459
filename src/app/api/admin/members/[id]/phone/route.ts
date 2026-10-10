import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { phoneTail, writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";

// 2026-10-10 회원 [번호 보기] — 관리자(일반)는 회원 목록에서 가린 번호만 받으므로, 전체 번호는 한 명씩 이 경로로(최고관리자·관리자).
// 호출할 때마다 감사 로그 member_phone_view(번호는 phoneTail 뒤 4자리만). POST라 브라우저·중간 캐시에 남지 않음.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/members/[id]/phone">) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "members");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const { data: m, error } = await auth.db.from("members").select("id, phone").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "회원 번호를 불러오지 못했어요." }, { status: 500 });
  if (!m?.phone) return NextResponse.json({ error: "번호가 없어요(탈퇴·삭제)." }, { status: 404 });

  await writeAudit(auth.db, req, {
    admin: auth.admin,
    action: "member_phone_view",
    targetType: "member",
    targetId: id,
    detail: { phone: phoneTail(m.phone) },
  });
  return NextResponse.json({ phone: normalizePhone(m.phone) });
}
