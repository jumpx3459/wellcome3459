// 회원 사업자 셀프 확인 (2026-11-05 1단계) — 서버 라우트·MY 카드·시험이 같이 쓰는 순수 규칙. 다른 모듈 import 없음(단위 시험용).
// 국세청 호출은 src/lib/nts.ts(변경 없음), 기록은 member_business_checks(service role 전용).

/** 회원당 KST 하루 확인 횟수 — validate_result 01·02(일치·불일치)만 셈. error(국세청 장애)는 제외 */
export const MEMBER_DAILY_LIMIT = 5;
/** 전체 KST 하루 기록 행 수 — error 포함. 국세청 일 호출 한도 보호용 */
export const GLOBAL_DAILY_LIMIT = 500;

const KST_MS = 9 * 3600e3;

/** 지금이 속한 KST 날짜의 시작(00:00 KST)을 UTC ISO 문자열로 — 하루 집계(created_at >= 이 값) 기준 */
export function kstDayStartIso(now: number = Date.now()): string {
  const kst = new Date(now + KST_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_MS).toISOString();
}

/** nts.ts normalizeOpenDate 결과(YYYYMMDD) → DB date("YYYY-MM-DD") */
export const openDateToDb = (yyyymmdd: string): string => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/** 국세청 b_stt_cd → DB status_code. 01·02·03만, 빈 값·그 밖의 값은 null(check 위반 방지) */
export const dbStatusCode = (code: string | null | undefined): "01" | "02" | "03" | null =>
  code === "01" || code === "02" || code === "03" ? code : null;

export type SelfCheckResult = "verified" | "mismatch" | "unavailable" | "limited";

export type SelfCheckResponse = {
  result: SelfCheckResult;
  status_code?: "01" | "02" | "03" | null;
  status_text?: string | null;
  checked_at: string;
};

/** MY 카드·관리자 표시용 사업 상태 문구 */
export function statusWord(code: string | null | undefined): string | null {
  if (code === "01") return "계속사업자";
  if (code === "02") return "휴업";
  if (code === "03") return "폐업";
  return null;
}

/** "M/D" — ISO 시각을 KST 월/일로 */
export function kstMonthDay(iso: string): string {
  const d = new Date(Date.parse(iso) + KST_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** MY 카드 환경 플래그(NEXT_PUBLIC_SELF_BIZ_CHECK) — "on"일 때만 켬, 기본 off */
export const selfBizCheckOn = (v: string | undefined): boolean => v === "on";

// ---- 2026-11-06 수동 입력(method='manual') — 관리자가 등록증과 대조해 입력한 번호의 국세청 상태조회 결과를 행 칸으로 ----
/** nts.ts NtsStatusResult와 같은 모양(이 파일은 다른 모듈을 import하지 않음) */
export type StatusLookup =
  | { result: "ok"; status: { code: string; text: string | null; taxType: string | null } }
  | { result: "error"; errorKind: string };

export type ManualCheckFields = {
  status_code: "01" | "02" | "03" | null;
  status_text: string | null;
  tax_type: string | null;
  error_kind: string | null;
};

/** 상태조회 결과 → member_business_checks 칸. 미등록(code '')은 status_code null·status_text '미등록', 오류는 error_kind만 */
export function manualCheckFields(r: StatusLookup): ManualCheckFields {
  if (r.result === "error") return { status_code: null, status_text: null, tax_type: null, error_kind: r.errorKind };
  const code = dbStatusCode(r.status.code);
  return {
    status_code: code,
    status_text: r.status.code === "" ? "미등록" : r.status.text,
    tax_type: r.status.taxType,
    error_kind: null,
  };
}
