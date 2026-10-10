import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { ADMIN_ROLES } from "@/lib/adminPerms";

// 2026-10-10 거래 연결 배정 — 최고관리자·관리자가 담당자를 지정·변경(점핑매니저 403). body: { assigneeId }
//   · 대상은 활성 관리자(admin_users에 있고 역할이 3단계 중 하나 — 해제하면 행이 지워짐)
//   · 종료된 연결은 바꾸지 않음(409). 성사 실적은 closed_assignee_admin_id(성사 시점)라 배정을 바꿔도 지난 실적은 그대로
//   · 감사 로그 connection_assign(이전·새 담당 id·이름). 단계·updated_at은 담당만 바뀌어도 갱신됨(트리거) — "24시간 멈춤"이 다시 셈됨
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/connections/[id]/assign">) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "connectionAssign");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const assigneeId = body?.assigneeId;
  if (typeof assigneeId !== "string" || !UUID_RE.test(assigneeId)) {
    return NextResponse.json({ error: "담당자를 골라주세요.", field: "assigneeId" }, { status: 400 });
  }

  const db = auth.db;
  const [{ data: conn, error: connError }, { data: target, error: targetError }] = await Promise.all([
    db.from("deal_connections").select("id, deal_id, status, assigned_admin_id").eq("id", id).maybeSingle(),
    db.from("admin_users").select("id, name, role").eq("id", assigneeId).maybeSingle(),
  ]);
  if (connError || targetError) return NextResponse.json({ error: "연결 기록을 불러오지 못했어요." }, { status: 500 });
  if (!conn) return NextResponse.json({ error: "연결 기록을 찾을 수 없어요." }, { status: 404 });
  if (!target || !(ADMIN_ROLES as readonly string[]).includes(target.role)) {
    return NextResponse.json({ error: "활성 관리자만 담당자로 지정할 수 있어요.", field: "assigneeId" }, { status: 400 });
  }
  if (conn.status === "closed") return NextResponse.json({ error: "종료된 연결은 담당을 바꿀 수 없어요." }, { status: 409 });
  if (conn.assigned_admin_id === target.id) return NextResponse.json({ ok: true, unchanged: true });

  // 다른 관리자가 그 사이 바꿨으면 0행 → 409
  let q = db.from("deal_connections").update({ assigned_admin_id: target.id }).eq("id", id).neq("status", "closed");
  q = conn.assigned_admin_id ? q.eq("assigned_admin_id", conn.assigned_admin_id) : q.is("assigned_admin_id", null);
  const { data: updated, error: updateError } = await q.select("id");
  if (updateError) {
    console.error("[admin/connections/assign] update 실패", updateError.code, updateError.message);
    return NextResponse.json({ error: "담당을 바꾸지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  if (!updated || updated.length === 0) return NextResponse.json({ error: "다른 관리자가 먼저 바꿨어요. 새로고침해 주세요.", race: true }, { status: 409 });

  let beforeName: string | null = null;
  if (conn.assigned_admin_id) {
    const { data: b } = await db.from("admin_users").select("name").eq("id", conn.assigned_admin_id).maybeSingle();
    beforeName = b?.name ?? "(해제된 관리자)";
  }
  await writeAudit(db, req, {
    admin: auth.admin,
    action: "connection_assign",
    targetType: "deal_connection",
    targetId: id,
    detail: { deal_id: conn.deal_id, from_id: conn.assigned_admin_id, from_name: beforeName, to_id: target.id, to_name: target.name, to_role: target.role },
  });
  return NextResponse.json({ ok: true, assigneeId: target.id, assigneeName: target.name });
}
