// 확인된 판매자 재사용(B안) 규칙 (2026-10-21) — 서버·브라우저·단위 시험 공용. 다른 모듈 import 없음(scripts/business-reuse-test.mts).
//
// 원본(root) = kind='validate' AND reused_from_check_id IS NULL AND (진위 일치 OR 예외 확인) — 관리자가 국세청에 직접 조회해 통과한 행.
// 재사용 = root를 새 행으로 복사(처리자 = 지금 관리자, checked_at = 지금, reused_from_check_id = root id). 재사용 행을 다시 재사용해도 root를 따라감.
// "1년 경과"는 root.checked_at 기준(복사 행의 checked_at이 아님). 경고는 노란색·막지 않음(대표자 상이 경고는 없음 — 입력 칸이 없음).

export const REUSE_OVER_YEAR_DAYS = 365;

type CheckLike = { kind?: string | null; reused_from_check_id?: string | null; validate_result: string | null; exception_ok: boolean | null };

/** root 판정 — 직접 조회한 validate 행 중 통과(진위 일치 또는 예외 확인)만. 재사용 행·상태 재조회 행은 root 아님 */
export function isRootCheck(c: CheckLike | null | undefined): boolean {
  if (!c) return false;
  if (c.kind && c.kind !== "validate") return false;
  if (c.reused_from_check_id) return false;
  return c.validate_result === "01" || c.exception_ok === true;
}

/** 재사용할 때 복사 행에 넣을 root id — 재사용 행을 골랐으면 그 행의 원본, 직접 행이면 자기 자신 */
export const rootIdOf = (c: { id: string; reused_from_check_id?: string | null }) => c.reused_from_check_id || c.id;

/** root 조회 후 1년이 지났는지 — 365일 이상이면 경과(364일은 아직, 365·366일은 경과) */
export function isOverYear(rootCheckedAt: string, now: number): boolean {
  const t = Date.parse(rootCheckedAt);
  return Number.isFinite(t) && now - t >= REUSE_OVER_YEAR_DAYS * 24 * 3600e3;
}

/** 예외 확인 root는 예외 확인 권한(최고관리자·관리자)이 있어야 재사용 — 그 밖의 root는 사업자 조회 권한과 같음(호출하는 쪽에서 먼저 검사) */
export function canReuseRoot(role: string, rootIsException: boolean): boolean {
  return !rootIsException || role === "최고관리자" || role === "관리자";
}

/** 상호 비교용 — 공백·(주)·주식회사 무시, 대소문자 무시 (businessCheck.ts normCompany와 같은 규칙) */
export const normCompanyForReuse = (v: string | null | undefined) =>
  (v ?? "").replace(/\s+/g, "").replace(/\(주\)|（주）|주식회사/g, "").toLowerCase();

export type ReuseWarningCode = "status_closed" | "status_unregistered" | "status_failed" | "company_differs" | "phone_differs" | "over_year" | "root_exception";
export type ReuseWarning = { code: ReuseWarningCode; text: string };

/** 이번 상태 조회 결과 — ok면 b_stt_cd("01" 계속 / "02" 휴업 / "03" 폐업 / "" 미등록), failed면 국세청 호출 실패 */
export type ReuseStatus = { kind: "ok"; code: string } | { kind: "failed" };

export type ReuseWarningInput = {
  status: ReuseStatus;
  rootCheckedAt: string;
  rootException: boolean;
  /** root 조회 때 입력한 상호 */
  rootCompany: string | null;
  /** 지금 등록하려는 상호(판매 신청 상호 또는 등록 폼 입력) */
  currentCompany: string | null;
  /** 첫 확인 때의 연락처(정규화) — 모르면 null */
  originalPhone: string | null;
  /** 지금 연락처(정규화) */
  currentPhone: string | null;
  now: number;
};

/** 재사용 경고 ①~⑤ — 순서 고정: 상태 → 상호 → 연락처 → 1년 → 예외 */
export function buildReuseWarnings(i: ReuseWarningInput): ReuseWarning[] {
  const w: ReuseWarning[] = [];
  if (i.status.kind === "failed") w.push({ code: "status_failed", text: "상태 조회 실패 · 다시 조회 권장" });
  else if (i.status.code === "02" || i.status.code === "03") {
    w.push({ code: "status_closed", text: `이번 상태 조회 결과 ${i.status.code === "02" ? "휴업" : "폐업"}이에요 · 등록은 할 수 있어요` });
  } else if (i.status.code === "") {
    // b_stt_cd "" = 국세청에 등록되지 않은 번호(미등록·삭제) — 휴업·폐업과 같은 노란 경고, 막지 않음
    w.push({ code: "status_unregistered", text: "국세청에 등록되지 않은 번호로 조회돼요 · 다시 조회를 권해요" });
  }
  const a = normCompanyForReuse(i.rootCompany);
  const b = normCompanyForReuse(i.currentCompany);
  if (a && b && a !== b) w.push({ code: "company_differs", text: `상호가 첫 확인 때(${i.rootCompany})와 달라요 · 같은 판매자가 맞는지 확인해주세요` });
  if (i.originalPhone && i.currentPhone && i.originalPhone !== i.currentPhone) {
    w.push({ code: "phone_differs", text: "연락처가 첫 확인 때와 달라요 · 같은 판매자가 맞는지 확인해주세요" });
  }
  if (isOverYear(i.rootCheckedAt, i.now)) w.push({ code: "over_year", text: "첫 조회 후 1년이 지났어요 · 다시 조회를 권해요" });
  if (i.rootException) w.push({ code: "root_exception", text: "첫 확인이 예외 확인(사본)이에요 · 다시 조회를 권해요" });
  return w;
}
