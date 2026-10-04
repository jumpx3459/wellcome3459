import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requireRole } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { maskBizNo } from "@/lib/nts";

// 2026-10-04 판매자 신원 확인 — 예외 확인(진위 확인이 안 될 때 사업자등록증·폐업사실증명원 사본으로 확인, 사본은 확인 후 즉시 파기).
// 최고관리자·관리자만. 사유 필수. 이미 통과(진위 일치·예외 확인)한 조회에는 못 함.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/business-checks/[id]/exception">) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requireRole(auth.admin, ["최고관리자", "관리자"]);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "예외 확인 사유를 입력해주세요.", field: "reason" }, { status: 400 });
  if (reason.length > 300) return NextResponse.json({ error: "사유는 300자까지 입력할 수 있어요.", field: "reason" }, { status: 400 });

  const db = auth.db;
  const { data: row, error } = await db
    .from("seller_business_checks")
    .select("id, kind, b_no, seller_request_id, validate_result, exception_ok")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
  if (!row || row.kind !== "validate") return NextResponse.json({ error: "조회 기록을 찾을 수 없어요." }, { status: 404 });
  if (row.exception_ok || row.validate_result === "01") return NextResponse.json({ error: "이미 통과한 조회예요." }, { status: 409 });

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await db
    .from("seller_business_checks")
    .update({
      exception_ok: true,
      exception_reason: reason,
      exception_by_admin_id: auth.admin.id,
      exception_by_admin_name: auth.admin.name,
      exception_at: now,
    })
    .eq("id", id)
    .eq("exception_ok", false)
    .select("id");
  if (updErr) return NextResponse.json({ error: "예외 확인을 저장하지 못했어요." }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ error: "이미 통과한 조회예요." }, { status: 409 });

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "business_check_exception",
    targetType: "seller_business_check",
    targetId: id,
    detail: { b_no: maskBizNo(row.b_no as string), seller_request_id: row.seller_request_id, validate_result: row.validate_result },
  });
  return NextResponse.json({ ok: true });
}
