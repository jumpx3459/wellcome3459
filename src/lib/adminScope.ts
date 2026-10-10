import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminIdentity } from "@/lib/adminAuth";
import { ownOnly } from "@/lib/adminPerms";

// 2026-10-10 점핑매니저 "자기 건만" 거르기 — 권한표(src/lib/adminPerms.ts)의 "own" 칸을 서버에서 강제.
//   · 거래 연결: assigned_admin_id = 본인인 건만(미배정 건은 안 보이고 못 바꿈)
//   · 비공개 판매자: 담당 매물만 = 본인에게 배정된 연결의 매물 + deal_seller_private.created_by_admin_id = 본인인 매물

export const NOT_ASSIGNED_MESSAGE = "배정된 건만 볼 수 있어요";
export const NOT_OWN_DEAL_MESSAGE = "담당 매물만 볼 수 있어요";

/** 점핑매니저이고 이 연결의 담당이 아니면 403, 아니면 null (최고관리자·관리자는 언제나 null) */
export function connectionScopeDenied(admin: AdminIdentity, assignedAdminId: string | null | undefined): NextResponse | null {
  if (!ownOnly(admin.role, "connections")) return null;
  if (assignedAdminId && assignedAdminId === admin.id) return null;
  return NextResponse.json({ error: NOT_ASSIGNED_MESSAGE, scope: "assigned" }, { status: 403 });
}

/** 이 관리자가 이 매물의 비공개 판매자 정보를 볼 수 있는지 — 최고관리자·관리자는 항상 true. 조회 실패는 "error" */
export async function canSeeDealPrivate(db: SupabaseClient, admin: AdminIdentity, dealId: string): Promise<boolean | "error"> {
  if (!ownOnly(admin.role, "sellerPrivate")) return true;
  const [conn, priv] = await Promise.all([
    db.from("deal_connections").select("id").eq("deal_id", dealId).eq("assigned_admin_id", admin.id).limit(1),
    db.from("deal_seller_private").select("deal_id").eq("deal_id", dealId).eq("created_by_admin_id", admin.id).limit(1),
  ]);
  if (conn.error || priv.error) return "error";
  return (conn.data ?? []).length > 0 || (priv.data ?? []).length > 0;
}

/** canSeeDealPrivate를 응답으로 — 못 보면 403, 조회 실패면 500, 통과면 null */
export async function dealPrivateScopeDenied(db: SupabaseClient, admin: AdminIdentity, dealId: string): Promise<NextResponse | null> {
  const ok = await canSeeDealPrivate(db, admin, dealId);
  if (ok === "error") return NextResponse.json({ error: "권한을 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  return ok ? null : NextResponse.json({ error: NOT_OWN_DEAL_MESSAGE, scope: "own_deal" }, { status: 403 });
}
