"use client";

import { useCallback, useEffect, useState } from "react";
import { rem } from "@/lib/rem";
import { DEAL_LABEL_STYLE, DEAL_HINT_STYLE } from "@/components/FormField";
import { NOT_CHECKED_MESSAGE, normCompany, type BusinessCheck } from "@/lib/businessCheck";

// 2026-10-04 feat/deal-seller-private — 관리자 매물 등록·수정의 "실제 판매자"(내부 전용) 칸 + "사업자 조회 기록" 선택.
// 회사가 대신 올리는 매물도 실제 판매자(상호·연락처·담당자)를 deal_seller_private에 남기려는 칸 — 구매자에게는 보이지 않음.
// 사업자 조회 기록: 신청 없이 조회했고 아직 매물에 안 붙은 통과 행만(서버가 거름), 자동 선택 없음.
// 입력 칸 id는 `${idPrefix}-sellerPrivateCompany|Phone|Name|businessCheckId` — 등록 폼의 첫 오류 칸 포커스가 이 id를 씀.

export type SellerPrivateDraft = { company: string; name: string; phone: string; checkId: string };
export type SellerPrivateErrors = Partial<Record<keyof SellerPrivateDraft, string>>;
export type LinkedCheck = {
  id: string;
  checked_at: string;
  input_company_name: string | null;
  b_no_masked: string | null;
  validate_result: string | null;
  exception_ok: boolean;
};

export const EMPTY_SELLER_PRIVATE: SellerPrivateDraft = { company: "", name: "", phone: "", checkId: "" };

const kst = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const resultLabel = (c: { validate_result: string | null; exception_ok: boolean }) => (c.validate_result === "01" ? "진위 일치" : c.exception_ok ? "예외 확인" : "");

export default function SellerPrivateFields({
  adminKey,
  idPrefix,
  value,
  onChange,
  errors,
  showCheckPicker,
  linkedCheck,
  onGoBizCheck,
  disabled,
}: {
  adminKey: string;
  idPrefix: string;
  value: SellerPrivateDraft;
  onChange: (next: SellerPrivateDraft) => void;
  errors?: SellerPrivateErrors;
  /** true면 연결할 사업자 조회 선택 목록을 보여줌(등록 폼·아직 조회가 안 붙은 매물 수정) */
  showCheckPicker: boolean;
  /** 이미 연결된 사업자 조회(표시만) */
  linkedCheck?: LinkedCheck | null;
  onGoBizCheck?: () => void;
  disabled?: boolean;
}) {
  const [checks, setChecks] = useState<BusinessCheck[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/admin/business-checks?unlinked=1", { headers: { "x-admin-key": adminKey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("load");
      setChecks((data.items ?? []) as BusinessCheck[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (!showCheckPicker) return;
    void load();
  }, [showCheckPicker, load]);

  // 고른(또는 이미 연결된) 조회의 입력 상호와 실제 판매자 상호가 다르면 노란 경고 — 등록은 막지 않음(상호가 서로 다르게 불리는 경우가 있어서)
  const checkedCompany = linkedCheck ? linkedCheck.input_company_name : checks?.find((c) => c.id === value.checkId)?.input_company_name;
  const companyMismatch = !!value.company.trim() && !!checkedCompany?.trim() && normCompany(value.company) !== normCompany(checkedCompany);

  const inputCls = (err?: string) =>
    `w-full min-w-0 border-2 rounded-lg px-3 py-2.5 text-[0.8889rem] outline-none focus:border-orange bg-white ${err ? "border-[#DC2626]" : "border-gray200"}`;
  const label = (htmlFor: string, text: string, required?: boolean) => (
    <label htmlFor={htmlFor} className="block mb-1" style={DEAL_LABEL_STYLE}>
      {text}
      {required ? <span style={{ color: "#DC2626" }}> *</span> : <span className="font-normal text-gray500"> (선택)</span>}
    </label>
  );
  const errText = (e?: string) =>
    e ? (
      <p className="mt-1 font-medium" style={{ fontSize: rem(13), color: "#DC2626" }}>
        {e}
      </p>
    ) : null;

  return (
    <div className="min-w-0 flex flex-col gap-3 rounded-xl" style={{ border: "1.5px dashed #D5DAE0", padding: 12, background: "#FAFBFC" }}>
      <div>
        <div className="font-bold text-navy" style={{ fontSize: rem(15) }}>실제 판매자 (내부 전용)</div>
        <p style={DEAL_HINT_STYLE}>구매자에게 보이지 않아요. 거래 연결에 쓰이고 매물 마감 후 1년 보관돼요.</p>
      </div>

      <div className="min-w-0">
        {label(`${idPrefix}-sellerPrivateCompany`, "상호", true)}
        <input
          id={`${idPrefix}-sellerPrivateCompany`}
          className={inputCls(errors?.company)}
          maxLength={100}
          disabled={disabled}
          value={value.company}
          onChange={(e) => onChange({ ...value, company: e.target.value })}
        />
        {errText(errors?.company)}
        {companyMismatch && (
          <p className="mt-1.5 rounded-lg" style={{ background: "#FFF8DB", color: "#7A5B00", fontSize: rem(14), padding: "8px 12px", lineHeight: 1.5 }}>
            고른 사업자 조회의 상호({checkedCompany})와 달라요. 같은 판매자가 맞는지 확인해주세요. 등록은 그대로 할 수 있어요.
          </p>
        )}
      </div>
      <div className="min-w-0">
        {label(`${idPrefix}-sellerPrivatePhone`, "연락처", true)}
        <input
          id={`${idPrefix}-sellerPrivatePhone`}
          className={inputCls(errors?.phone)}
          inputMode="tel"
          placeholder="숫자만 (사무실·대표번호도 가능)"
          maxLength={20}
          disabled={disabled}
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
        />
        {errText(errors?.phone)}
      </div>
      <div className="min-w-0">
        {label(`${idPrefix}-sellerPrivateName`, "담당자 이름")}
        <input
          id={`${idPrefix}-sellerPrivateName`}
          className={inputCls(errors?.name)}
          maxLength={50}
          disabled={disabled}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        {errText(errors?.name)}
      </div>

      {linkedCheck ? (
        <div className="min-w-0">
          <div style={DEAL_LABEL_STYLE}>사업자 조회 기록</div>
          <p className="mt-1" style={DEAL_HINT_STYLE}>
            연결됨 · {kst(linkedCheck.checked_at)} · {linkedCheck.input_company_name || "상호 미입력"} · {linkedCheck.b_no_masked ?? ""} · {resultLabel(linkedCheck)}
          </p>
        </div>
      ) : showCheckPicker ? (
        <div className="min-w-0" id={`${idPrefix}-businessCheckId`} tabIndex={-1} style={{ outline: "none" }}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span style={DEAL_LABEL_STYLE}>
              사업자 조회 기록 <span style={{ color: "#DC2626" }}>*</span>
            </span>
            <button type="button" onClick={() => void load()} disabled={loading || disabled} className="text-sm font-bold text-gray500 underline disabled:opacity-50">
              {loading ? "불러오는 중…" : "새로고침"}
            </button>
          </div>
          {loadError ? (
            <p className="font-medium" style={{ fontSize: rem(14), color: "#DC2626" }}>조회 기록을 불러오지 못했어요. 새로고침을 눌러주세요.</p>
          ) : checks && checks.length === 0 ? (
            <div className="rounded-lg" style={{ background: "#FFF8DB", color: "#7A5B00", fontSize: rem(14), padding: "8px 12px", lineHeight: 1.5 }}>
              {NOT_CHECKED_MESSAGE}
              {onGoBizCheck && (
                <button type="button" onClick={onGoBizCheck} className="ml-2 font-bold underline">
                  사업자 조회 바로가기
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="사업자 조회 기록">
              {(checks ?? []).map((c) => (
                <label
                  key={c.id}
                  className="flex items-start gap-2.5 rounded-xl cursor-pointer"
                  style={{ border: `2px solid ${value.checkId === c.id ? "#0B2540" : "#E4E7EB"}`, padding: "8px 10px", background: "#fff" }}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-businessCheck`}
                    className="w-4 h-4 mt-0.5 accent-navy flex-shrink-0"
                    checked={value.checkId === c.id}
                    disabled={disabled}
                    onChange={() => onChange({ ...value, checkId: c.id })}
                  />
                  <span className="min-w-0" style={{ fontSize: rem(14), lineHeight: 1.45 }}>
                    <span className="font-bold text-navy">{c.input_company_name || "상호 미입력"}</span>
                    <span className="text-gray500">
                      {" "}· {kst(c.checked_at)} · {c.b_no_masked ?? ""} · {resultLabel(c)}
                    </span>
                  </span>
                </label>
              ))}
              {checks === null && !loading && <p style={DEAL_HINT_STYLE}>불러오는 중…</p>}
            </div>
          )}
          {errText(errors?.checkId)}
          <p className="mt-1" style={DEAL_HINT_STYLE}>이 매물의 판매자로 조회한 기록을 직접 골라주세요. 자동으로 고르지 않아요.</p>
        </div>
      ) : null}
    </div>
  );
}
