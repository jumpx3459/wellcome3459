import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { adminGrantExpiresAt, parseGrantInput } from "@/lib/viewCreditsAdmin";

// 2026-11-06 열람권 수동 지급 — view_credit_grants에 source='admin' 1행(수량 1~100, 사유 필수, 지급 시각 + 90일, created_by = 이 관리자).
// 권한: viewCreditManage(최고관리자 전용). 지급은 INSERT뿐이라 consume과의 동시성 문제 없음(잔여를 읽고 쓰는 판단이 없음).
// 회수는 같은 폴더의 revoke 라우트(잔량 검사·회수 행 insert를 한 트랜잭션에서 하는 SQL 함수 필요 — 별도).
// body: { quantity, reason }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const denied = requirePerm(auth.admin, "viewCreditManage");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return json({ error: "잘못된 요청입니다." }, 400);

  const body = (await req.json().catch(() => null)) as { quantity?: unknown; reason?: unknown } | null;
  const input = parseGrantInput(body);
  if (!input.ok) return json({ error: input.error, field: input.field }, 400);

  const db = auth.db;
  const { data: member, error: memberErr } = await db.from("members").select("id").eq("id", id).maybeSingle();
  if (memberErr) return json({ error: "회원 정보를 불러오지 못했어요." }, 500);
  if (!member) return json({ error: "회원을 찾을 수 없어요." }, 404);

  const { data: saved, error } = await db
    .from("view_credit_grants")
    .insert({ member_id: id, source: "admin", quantity: input.quantity, expires_at: adminGrantExpiresAt(), reason: input.reason, created_by: auth.admin.id })
    .select("id, expires_at")
    .single();
  if (error || !saved) {
    console.error("[view-credits] 지급 실패", error?.code);
    return json({ error: "지급을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }

  await writeAudit(db, req, { admin: auth.admin, action: "view_credit_grant", targetType: "member", targetId: id, detail: { grant_id: saved.id, quantity: input.quantity, reason: input.reason } });
  return json({ ok: true, grant_id: saved.id, expires_at: saved.expires_at });
}
