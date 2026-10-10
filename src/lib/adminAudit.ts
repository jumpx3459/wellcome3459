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
  | "members_export" // 2026-10-06: 회원 CSV 내보내기 — 최고관리자만 (detail: count)
  | "leads_export" // 2026-10-06: 리드 CSV 내보내기 — 최고관리자만 (detail: count)
  | "lead_update" // 2026-10-01 F-1: 리드 연락완료·성사·불발 변경 (detail: deal_id, before, after)
  | "business_check" // 2026-10-04: 사업자 조회 (detail: b_no는 maskBizNo "123-45-*****"만, result, status_code)
  | "business_check_exception" // 2026-10-04: 사업자 조회 예외 확인 (detail: 마스킹 번호, seller_request_id — 사유는 표에만)
  | "connection_step" // 2026-10-04 F-4: 거래 연결 단계 변경 (detail: deal_id, from, to, method, result·금액 — 메모는 이력 표에만)
  | "connection_phone_view" // 2026-10-04 F-4: 연결 구매자 번호 전체 보기 (detail: phoneTail만)
  | "seller_private_view" // 2026-10-04 F-4: 판매자 비공개 정보 조회 (detail: deal_id)
  | "business_license_view" // 2026-10-10: 사업자등록증 열람(서명 URL 발급) (detail 없음 — 대상 회원 id만)
  | "business_verify" // 2026-10-10: 사업자 인증 승인(business_verified=true)
  | "deal_create" // 2026-10-10: 매물 등록(직접·판매 신청 승인) (detail: via, title, seller_request_id, sourced_by)
  | "deal_update" // 2026-10-10: 매물 수정 (detail: 바뀐 칸 이름만 — 값은 넣지 않음. 마감만 하면 deal_close)
  | "seller_request_reject" // 2026-10-10: 판매 신청 거절
  | "notice_close" // 2026-10-10: 긴급 공지 마감 (detail: status)
  | "connection_assign" // 2026-10-10: 거래 연결 담당 지정·변경 (detail: 이전·새 담당 id·이름)
  | "member_phone_view" // 2026-10-10: 회원 전체 번호 보기 (detail: phoneTail만)
  | "seller_private_save"; // 2026-10-04 F-4: 판매자 비공개 정보 저장 (detail: via[deal_create|deal_edit|seller_request_approve|connection_board], 바뀐 칸 이름, 연락처는 phoneTail, 조회 행 연결 시 linked_check_id)

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
