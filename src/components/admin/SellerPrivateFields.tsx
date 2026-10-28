"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rem } from "@/lib/rem";
import { DEAL_LABEL_STYLE, DEAL_HINT_STYLE } from "@/components/FormField";
import { NOT_CHECKED_MESSAGE, normCompany, type BusinessCheck } from "@/lib/businessCheck";
import ReuseCandidate from "@/components/admin/ReuseCandidate";
import type { ReuseWarning } from "@/lib/businessReuse";

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

// 재사용 행 표시용 — 원본 조회 날짜 "2026.10.11"(한국 날짜, 시각 없음)
const dotDate = (iso: string) => {
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}.${g("month")}.${g("day")}`;
};

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
  adminRole,
  reuseFromCheckId,
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
  /** 2026-10-21: 예외 확인 건 재사용 버튼 미리 막기용(없으면 서버가 403으로 막음) */
  adminRole?: string | null;
  /** 2026-10-28 [같은 판매자로 다음 매물 등록] — 방금 등록한 매물에 쓴 조회 기록 id. 열릴 때 1번 기존 재사용(POST /business-checks/reuse)으로 새 기록을 만들어 선택해 둠
   *  (이미 매물에 붙은 기록은 다시 붙일 수 없어서 — 서버 규칙 그대로). 실패하면 아래 목록에서 직접 고름 */
  reuseFromCheckId?: string;
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

  // 이전 매물 조회 기록 이어받기(재사용 1회). 값·onChange는 ref로 최신을 읽음
  const [carryNote, setCarryNote] = useState<{ state: "busy" | "ok" | "fail"; warnings: ReuseWarning[]; error?: string } | null>(reuseFromCheckId ? { state: "busy", warnings: [] } : null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const carryRan = useRef(false);
  useEffect(() => {
    if (!reuseFromCheckId || !showCheckPicker || carryRan.current) return;
    carryRan.current = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/business-checks/reuse", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({ sourceCheckId: reuseFromCheckId, company: valueRef.current.company, phone: valueRef.current.phone }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCarryNote({ state: "fail", warnings: [], error: res.status === 403 ? "예외 확인 건은 최고관리자·관리자만 이어받을 수 있어요." : data.error ?? "이어받지 못했어요." });
          return;
        }
        await load();
        onChangeRef.current({ ...valueRef.current, checkId: (data.item as BusinessCheck).id });
        setCarryNote({ state: "ok", warnings: (data.warnings ?? []) as ReuseWarning[] });
      } catch {
        setCarryNote({ state: "fail", warnings: [], error: "이어받지 못했어요." });
      }
    })();
  }, [reuseFromCheckId, showCheckPicker, adminKey, load]);

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
          {/* 2026-10-21 확인된 판매자 재사용 — 사업자번호로 찾아 [이 기록 재사용]을 누르면 새 기록이 만들어져 아래 목록에서 선택됨(자동 선택 아님) */}
          <div className="mb-2">
            <ReuseCandidate
              adminKey={adminKey}
              adminRole={adminRole ?? null}
              findByBizNo
              company={value.company}
              phone={value.phone}
              disabled={disabled}
              onReused={async (item) => {
                await load();
                onChange({ ...value, checkId: item.id });
              }}
            />
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
                    {c.reused_from_check_id && (
                      <span className="ml-1 font-bold rounded-full" style={{ fontSize: rem(12), background: "#E8F0FA", color: "#1B3A5C", padding: "1px 7px" }} data-reused-chip>
                        재사용
                      </span>
                    )}
                    <span className="text-gray500">
                      {" "}· {c.reused_from_check_id && c.root_checked_at ? `원본 조회 ${dotDate(c.root_checked_at)}` : kst(c.checked_at)} · {c.b_no_masked ?? ""} · {resultLabel(c)}
                    </span>
                  </span>
                </label>
              ))}
              {checks === null && !loading && <p style={DEAL_HINT_STYLE}>불러오는 중…</p>}
            </div>
          )}
          {carryNote && (
            <div className="mb-2 flex flex-col gap-1.5" data-carry-note={carryNote.state}>
              {carryNote.state === "busy" && <p style={DEAL_HINT_STYLE}>이전 매물의 사업자 조회 기록을 이어받는 중…</p>}
              {carryNote.state === "ok" && (
                <p className="font-bold" style={{ fontSize: rem(14), color: "#1D8A44" }}>✓ 같은 판매자 — 이전 매물의 사업자 조회 기록을 이어받아 선택했어요(재사용 기록 1건 추가).</p>
              )}
              {carryNote.state === "fail" && (
                <p className="rounded-lg" style={{ background: "#FFF8DB", color: "#7A5B00", fontSize: rem(14), padding: "8px 12px", lineHeight: 1.5 }}>
                  {carryNote.error} 아래에서 조회 기록을 직접 골라주세요.
                </p>
              )}
              {carryNote.warnings.map((w) => (
                <div key={w.code} className="rounded-lg" style={{ background: "#FFF8DB", color: "#7A5B00", fontSize: rem(14), padding: "8px 12px", lineHeight: 1.5 }} data-reuse-warning={w.code}>
                  ⚠ {w.text}
                </div>
              ))}
            </div>
          )}
          {errText(errors?.checkId)}
          {carryNote?.state !== "ok" && <p className="mt-1" style={DEAL_HINT_STYLE}>이 매물의 판매자로 조회한 기록을 직접 골라주세요. 자동으로 고르지 않아요.</p>}
        </div>
      ) : null}
    </div>
  );
}
