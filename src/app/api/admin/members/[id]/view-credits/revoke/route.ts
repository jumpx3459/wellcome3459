import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { parseRevokeInput } from "@/lib/viewCreditsAdmin";
import { revokeViewCredit } from "@/lib/viewCreditsServer";

// 2026-11-06 열람권 회수 — 지급 줄 1개에서 N개를 회수(view_credit_events kind='revoke', 사유·회수한 관리자 필수).
// 잔량 검사와 회수 행 insert는 SQL 함수 view_credit_revoke가 consume과 같은 회원 advisory lock 안에서 한 트랜잭션으로 처리 — 이 라우트는 입력 검증·권한·결과 변환·감사만.
// 권한: viewCreditManage(최고관리자 전용). 이미 사용된 열람권은 회수할 수 없음(남은 수까지만), 만료된 지급 줄은 회수할 게 없어 409.
// body: { grant_id, quantity, reason } — rpc 오류·빈 응답은 500(회수로 처리하지 않음)
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const denied = requirePerm(auth.admin, "viewCreditManage");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return json({ error: "잘못된 요청입니다." }, 400);

  const body = (await req.json().catch(() => null)) as { grant_id?: unknown; quantity?: unknown; reason?: unknown } | null;
  const input = parseRevokeInput(body);
  if (!input.ok) return json({ error: input.error, field: input.field }, 400);

  let r;
  try {
    r = await revokeViewCredit(auth.db, id, input.grantId, input.quantity, input.reason, auth.admin.id);
  } catch (e) {
    console.error("[view-credits/revoke] 회수 실패", e instanceof Error ? e.message : e);
    return json({ error: "회수하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
  if (r.result === "not_found") return json({ error: "회수할 지급 내역을 찾을 수 없어요." }, 404);
  if (r.result === "expired") return json({ error: "이미 만료된 지급이라 회수할 열람권이 없어요." }, 409);
  if (r.result === "exceeds") return json({ error: `회수할 수 있는 수량(${r.remainingAfter}개)을 넘었어요.`, remaining: r.remainingAfter }, 409);
  if (r.result !== "revoked") return json({ error: "입력을 확인해주세요." }, 400);

  await writeAudit(auth.db, req, { admin: auth.admin, action: "view_credit_revoke", targetType: "member", targetId: id, detail: { grant_id: input.grantId, quantity: input.quantity, reason: input.reason } });
  return json({ ok: true, remaining_after: r.remainingAfter });
}
