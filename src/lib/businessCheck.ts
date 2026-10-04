// 판매자 사업자 조회 기록(seller_business_checks) 공용 — 서버·브라우저 모두 import 가능(다른 모듈 import 없음). 2026-10-04
// 통과 = 진위확인 일치(validate_result "01") — 상태는 계속·휴업·폐업 모두 허용(폐업자 재고 정리가 주 고객) — 또는 예외 확인.

export type BusinessCheck = {
  id: string;
  seller_request_id: string | null;
  deal_id: string | null;
  kind: "validate" | "status_recheck";
  b_no_masked: string | null; // API 응답은 전체 번호 대신 마스킹 값만
  rep_name: string | null;
  open_date: string | null;
  input_company_name: string | null;
  validate_result: "01" | "02" | "error" | null;
  status_code: string | null;
  status_text: string | null;
  tax_type: string | null;
  error_kind: string | null;
  checked_at: string;
  checked_by_name: string | null;
  exception_ok: boolean;
  exception_reason: string | null;
  exception_by_admin_name: string | null;
  exception_at: string | null;
};

type PassFields = { kind?: string | null; validate_result: string | null; exception_ok: boolean | null };

/** 승인 가능한 조회인지 — status_recheck 행은 판단에 안 씀 */
export function isPassingCheck(c: PassFields | null | undefined): boolean {
  if (!c || (c.kind && c.kind !== "validate")) return false;
  return c.validate_result === "01" || c.exception_ok === true;
}

export type CheckTone = "ok" | "warn" | "bad" | "wait";

/** 결과 배지 문구·색 구분 */
export function checkBadge(c: Pick<BusinessCheck, "validate_result" | "status_code" | "exception_ok">): { label: string; tone: CheckTone } {
  if (c.validate_result === "01") {
    if (c.status_code === "01") return { label: "✓ 진위 일치·계속사업자", tone: "ok" };
    if (c.status_code === "02") return { label: "✓ 진위 일치·휴업", tone: "warn" };
    if (c.status_code === "03") return { label: "✓ 진위 일치·폐업자", tone: "warn" };
    return { label: "✓ 진위 일치(상태 확인 대기)", tone: "ok" };
  }
  if (c.exception_ok) return { label: "예외 확인", tone: "warn" };
  if (c.validate_result === "02") return { label: "불일치", tone: "bad" };
  return { label: "확인 대기", tone: "wait" };
}

/** 승인 시점 상태 재조회 행 문구 */
export function statusLabel(code: string | null): string {
  if (code === "01") return "계속사업자";
  if (code === "02") return "휴업";
  if (code === "03") return "폐업자";
  if (code === "") return "미등록";
  return "확인 대기";
}

/** 상호 비교용 — 공백·(주)·주식회사 무시, 대소문자 무시 */
export const normCompany = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "").replace(/\(주\)|（주）|주식회사/g, "").toLowerCase();

export const NOT_CHECKED_MESSAGE = "사업자 조회 후 등록할 수 있어요";
export const ALREADY_HANDLED_MESSAGE = "이미 처리된 신청이에요";
