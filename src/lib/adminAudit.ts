import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientIp, type AdminIdentity } from "@/lib/adminAuth";

// 관리자 감사 로그 (2026-10-01 ① 역할 기반 최소판) — admin_audit_logs(service role만, RLS 정책 없음).
// detail에는 비밀번호·토큰·전체 휴대폰 번호를 넣지 않는다(번호는 phoneTail로 뒤 4자리만).
// 기록 실패는 본 작업을 막지 않음(콘솔에만 남김).
export type AuditAction =
  | "login_success"
  | "login_fail"
  | "login_locked"
  | "deal_delete"
  | "deal_close"
  | "partner_approve"
  | "partner_reject"
  | "notice_send"
  | "admin_appoint"
  | "admin_remove"
  | "admin_role_change"
  | "members_list_view"
  | "interests_list_view"
  | "lead_update"; // 2026-10-01 F-1: 리드 연락완료·성사·불발 변경 (detail: deal_id, before, after)

export const phoneTail = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/[^0-9]/g, "");
  return d ? `****${d.slice(-4)}` : null;
};

export async function writeAudit(
  db: SupabaseClient,
  req: NextRequest,
  entry: {
    admin?: Pick<AdminIdentity, "id" | "name" | "role"> | null;
    action: AuditAction;
    targetType?: string;
    targetId?: string | null;
    detail?: Record<string, unknown>;
  }
) {
  const { error } = await db.from("admin_audit_logs").insert({
    admin_id: entry.admin?.id ?? null,
    admin_name: entry.admin?.name ?? null,
    admin_role: entry.admin?.role ?? null,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    detail: entry.detail ?? {},
    ip: clientIp(req),
  });
  if (error) console.error("[adminAudit] 기록 실패", entry.action, error.code, error.message);
}
