"use client";

import { useCallback, useEffect, useState } from "react";
import { rem } from "@/lib/rem";
import { UI_META, BTN_CLASS, btnStyle } from "@/lib/uiText";
import { LIST_CARD_TITLE_PROPS, LIST_CARD_BAND_BG, bandBleedClass } from "@/components/admin/cardTitle";
import { DEAL_LABEL_STYLE, DEAL_INPUT_FONT_SIZE } from "@/components/FormField";
import { checkBadge, isPassingCheck, statusLabel, type BusinessCheck, type CheckTone } from "@/lib/businessCheck";
import ReuseCandidate from "@/components/admin/ReuseCandidate";
import { can } from "@/lib/adminPerms";
import { groupHistory, visibleCards } from "@/lib/businessCheckHistory";
import { ADMIN_TEXT } from "@/lib/adminText";

// 2026-10-04 판매자 신원 확인 — 관리자 "사업자 조회" 섹션(판매자 신청 목록 바로 위).
// 점핑매니저가 통화로 받은 사업자번호·대표자명·개업일자로 국세청 진위확인·상태조회 → 결과 배지·이력.
// 판매 신청을 고르면 그 신청에 기록되고, 통과해야 그 신청의 [매물로 등록하기]가 열림(서버도 같은 검사).
// [예외 확인]은 최고관리자·관리자만(서버 requireRole). DealForm은 건드리지 않음.

export type BizCheckRequest = { id: string; product_name: string; company_name: string | null };

const TONE: Record<CheckTone, { background: string; color: string }> = {
  ok: { background: "#E8F8EC", color: ADMIN_TEXT.ok },
  warn: { background: "#FFF4E0", color: "#966B00" },
  bad: { background: "#FDECEC", color: "#C2282D" },
  wait: { background: "#F1F1EF", color: ADMIN_TEXT.muted },
};
const META = { ...UI_META, color: ADMIN_TEXT.muted } as const;
const WARN_BOX = { background: "#FFF8DB", color: "#7A5B00", fontSize: rem(14), padding: "8px 12px", lineHeight: 1.5 } as const;

export function BusinessCheckBadge({ check }: { check: BusinessCheck | null | undefined }) {
  const b = check ? checkBadge(check) : { label: "사업자 미조회", tone: "wait" as const };
  return (
    <span className="inline-block rounded-full font-bold" style={{ ...TONE[b.tone], fontSize: rem(13), padding: "2px 10px" }}>
      {b.label}
    </span>
  );
}

/** 2026-10-21: 재사용 행 표시 */
function ReusedChip() {
  return (
    <span className="inline-block rounded-full font-bold" style={{ background: "#E8F0FA", color: "#1B3A5C", fontSize: rem(13), padding: "2px 10px" }} data-reused-chip>
      재사용
    </span>
  );
}

/** 상호 비교용 — 공백·(주)·주식회사 무시 */
const normCompany = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "").replace(/\(주\)|（주）|주식회사/g, "").toLowerCase();

/** 사업자번호 입력 중 표시 "123-45-67890" */
function formatBizNoTyping(v: string) {
  const d = v.replace(/[^0-9]/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtOpen = (v: string | null) => (v && v.length === 8 ? `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6)}` : v ?? "");

export default function BusinessCheckSection({
  adminKey,
  adminRole,
  requests,
  phoneMatch,
  preselect,
  className,
  open,
  onToggle,
  onChanged,
  compact = false,
  onChecked,
  id = "business-check",
}: {
  /** 2026-10-28 PR-B E: 관리자 등록 폼 판매자 정보 안에 넣는 작은 판. 신청 선택·재사용 후보·띠 제목 없음, 접힌 채 시작, 이력은 [조회 이력 보기]로 접음 */
  compact?: boolean;
  /** 조회·다시 조회·예외 확인이 끝날 때마다 그 기록을 알려 줌(등록 폼이 통과 건을 조회 기록으로 자동 선택) */
  onChecked?: (item: BusinessCheck) => void;
  /** 맨 바깥 div id — 대시보드 카드는 "business-check"(바로가기 대상), 폼 안은 따로 줘서 중복 방지 */
  id?: string;
  adminKey: string;
  adminRole: string | null;
  /** 대기 중인 판매 신청 */
  requests: BizCheckRequest[];
  /** 신청 id → 신청 연락처 = 신청 회원 가입 번호인지 (null = 회원 정보 없음) */
  phoneMatch: Record<string, boolean | null>;
  /** 판매 신청 카드 [사업자 조회]로 들어올 때 미리 고를 신청 — nonce가 바뀌면 다시 적용 */
  preselect: { id: string; nonce: number } | null;
  className: string;
  /** open·onToggle을 안 주면 접기 없이 항상 펼침. 접혀 있어도 맨 바깥 div(#business-check)는 렌더됨(바로가기 대상) */
  open?: boolean;
  onToggle?: () => void;
  /** 조회·예외 확인 뒤 판매 신청 카드 배지 다시 읽기 */
  onChanged: () => void;
}) {
  const canException = adminRole === "최고관리자" || adminRole === "관리자";
  const canSeeHistory = can(adminRole, "businessCheckHistory"); // 점핑매니저는 이력 목록 없음(서버도 빈 목록)
  const [requestId, setRequestId] = useState("");
  const [bNo, setBNo] = useState("");
  const [repName, setRepName] = useState("");
  const [openDate, setOpenDate] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<BusinessCheck | null>(null);
  const [history, setHistory] = useState<BusinessCheck[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [cOpen, setCOpen] = useState(false); // compact: 판 자체 펼침(기본 접힘)
  const [histOpen, setHistOpen] = useState(false); // compact: 이력 목록 펼침(기본 접힘)
  const [exceptionFor, setExceptionFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  useEffect(() => {
    if (!preselect) return;
    setRequestId(preselect.id);
    setLast(null);
    setError(null);
  }, [preselect]);

  const loadHistory = useCallback(async () => {
    if (!canSeeHistory) return;
    const q = requestId ? `?seller_request_id=${requestId}` : "";
    const res = await fetch(`/api/admin/business-checks${q}`, { headers: { "x-admin-key": adminKey } }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setHistory(data?.items ?? []);
  }, [adminKey, requestId, canSeeHistory]);
  useEffect(() => {
    if (compact && !(cOpen && histOpen)) return; // compact는 이력을 펼칠 때만 읽음
    void loadHistory();
  }, [loadHistory, compact, cOpen, histOpen]);

  const selected = requests.find((r) => r.id === requestId) ?? null;
  const companyMismatch = !!selected && !!company.trim() && !!selected.company_name && normCompany(company) !== normCompany(selected.company_name);
  const phoneMismatch = !!selected && phoneMatch[selected.id] === false;

  const submit = async (recheckOf?: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/business-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(
          recheckOf
            ? { recheckOf }
            : { b_no: bNo, rep_name: repName, open_date: openDate, input_company_name: company || null, seller_request_id: requestId || null }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "조회에 실패했어요.");
        return;
      }
      setLast(data.item);
      onChecked?.(data.item as BusinessCheck);
      if (!compact || histOpen) await loadHistory();
      onChanged();
    } catch {
      setError("조회에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveException = async (id: string) => {
    setExceptionError(null);
    const res = await fetch(`/api/admin/business-checks/${id}/exception`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setExceptionError(data.error ?? "저장에 실패했어요.");
      return;
    }
    setExceptionFor(null);
    setReason("");
    setLast((l) => (l && l.id === id ? { ...l, exception_ok: true, exception_reason: reason } : l));
    const excChecked = history.find((h) => h.id === id) ?? (last && last.id === id ? last : null);
    if (excChecked) onChecked?.({ ...excChecked, exception_ok: true, exception_reason: reason });
    await loadHistory();
    onChanged();
  };

  // 신청별 최신 진위확인 — 예외 확인은 승인 판단 기준인 최신 조회에만
  const latestPerRequest = new Set<string>();
  const seen = new Set<string>();
  for (const c of history) {
    if (c.kind !== "validate") continue;
    const k = c.seller_request_id ?? `none:${c.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    latestPerRequest.add(c.id);
  }
  const cards = groupHistory(history);
  const { shown, canToggle } = visibleCards(cards, expanded);
  const requestName = (id: string | null) => {
    const r = id ? requests.find((x) => x.id === id) : null;
    return r ? r.product_name : id ? "처리된 신청" : "신청 없음(직접 등록)";
  };

  const inputStyle = { fontSize: DEAL_INPUT_FONT_SIZE, height: 48 } as const;
  const inputClass = "w-full border-2 border-gray200 rounded-xl px-3 outline-none focus:border-orange bg-white";

  return (
    <div id={id} className={className} style={{ scrollMarginTop: 12 }} data-biz-compact={compact ? "" : undefined}>
      {compact && (
        <button
          type="button"
          onClick={() => setCOpen((v) => !v)}
          aria-expanded={cOpen}
          className="w-full flex items-center justify-between gap-2 text-left font-bold"
          style={{ minHeight: 44, fontSize: rem(15), color: "#0B2540" }}
          data-biz-compact-toggle
        >
          <span>🔍 사업자 새로 조회 (국세청 진위확인)</span>
          <span className="flex-shrink-0" style={{ fontSize: rem(14), color: "#3730A3" }}>{cOpen ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>
      )}
      {!compact && (<>
      <div className={`${bandBleedClass(className)} py-2`} style={{ background: LIST_CARD_BAND_BG }} data-card-band-x>
      {onToggle ? (
        <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-left" style={{ minHeight: 44 }} data-card-toggle>
          <span {...LIST_CARD_TITLE_PROPS}>사업자 조회</span>
          <span className="font-bold flex-shrink-0 flex items-center justify-center" style={{ minWidth: 44, minHeight: 44, fontSize: rem(14), color: "#3730A3" }}>
            {open ? "접기 ▲" : "펼치기 ▼"}
          </span>
        </button>
      ) : (
        <div {...LIST_CARD_TITLE_PROPS}>사업자 조회</div>
      )}
      </div>
      </>)}
      {(compact ? cOpen : (open ?? true)) && (<>
      <p style={META}>{compact ? "통화로 받은 사업자번호·대표자명·개업일자로 조회해요. 통과하면 이 매물의 조회 기록으로 자동 선택돼요." : "통화로 받은 사업자번호·대표자명·개업일자로 국세청 진위확인을 해요. 판매 신청은 조회가 통과해야 매물로 등록할 수 있어요."}</p>

      {!compact && (
      <label className="flex flex-col gap-1">
        <span style={DEAL_LABEL_STYLE}>판매 신청 (선택)</span>
        <select
          className={inputClass}
          style={inputStyle}
          value={requestId}
          onChange={(e) => {
            setRequestId(e.target.value);
            setLast(null);
          }}
        >
          <option value="">신청 없이 조회 (직접 등록)</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.product_name}
              {r.company_name ? ` · ${r.company_name}` : ""}
            </option>
          ))}
        </select>
      </label>
      )}
      {/* 2026-10-21 확인된 판매자 재사용 — 신청을 고르면 같은 회원의 이전 신청에서 확인된 기록을 찾아 보여줌(국세청 호출 없음) */}
      {requestId && (
        <ReuseCandidate
          adminKey={adminKey}
          adminRole={adminRole}
          sellerRequestId={requestId}
          onReused={async (item) => {
            setLast(item);
            await loadHistory();
            onChanged();
          }}
        />
      )}
      <div className={compact ? "grid grid-cols-1 gap-2 @min-[420px]:grid-cols-2" : "grid grid-cols-2 gap-2"}>
        <label className="flex flex-col gap-1">
          <span style={DEAL_LABEL_STYLE}>사업자등록번호</span>
          <input className={inputClass} style={inputStyle} inputMode="numeric" placeholder="123-45-67890" value={bNo} onChange={(e) => setBNo(formatBizNoTyping(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span style={DEAL_LABEL_STYLE}>대표자 성명</span>
          <input className={inputClass} style={inputStyle} value={repName} maxLength={50} onChange={(e) => setRepName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span style={DEAL_LABEL_STYLE}>개업일자</span>
          <input
            className={inputClass}
            style={inputStyle}
            inputMode="numeric"
            placeholder="YYYYMMDD"
            value={openDate}
            onChange={(e) => setOpenDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span style={DEAL_LABEL_STYLE}>상호 (선택 · 국세청 판정에는 쓰지 않아요)</span>
          <input className={inputClass} style={inputStyle} value={company} maxLength={100} onChange={(e) => setCompany(e.target.value)} />
        </label>
      </div>
      {companyMismatch && <div className="rounded-lg" style={WARN_BOX}>⚠ 입력 상호가 신청 상호({selected!.company_name})와 달라요.</div>}
      {phoneMismatch && <div className="rounded-lg" style={WARN_BOX}>⚠ 신청 연락처가 신청 회원의 가입 번호와 달라요.</div>}
      {error && <div className="rounded-lg" style={{ ...WARN_BOX, background: "#FDECEC", color: "#C2282D" }}>{error}</div>}
      <button type="button" disabled={submitting} onClick={() => submit()} className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
        {submitting ? "조회 중..." : "국세청 조회"}
      </button>

      {last && (
        <div className="flex items-center justify-between gap-2 rounded-xl" style={{ background: "#F6F7F9", padding: "10px 12px" }}>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="flex items-center gap-1.5">
              <BusinessCheckBadge check={last} />
              {last.reused_from_check_id && <ReusedChip />}
            </span>
            <span style={META}>
              {last.b_no_masked} · {requestName(last.seller_request_id)}
            </span>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit(last.id)}
            className={`flex-shrink-0 ${BTN_CLASS}`}
            style={{ ...btnStyle("secondary"), minHeight: 40, fontSize: rem(15), padding: "0 14px" }}
          >
            다시 조회
          </button>
        </div>
      )}

      {compact && canSeeHistory && (
        <button type="button" onClick={() => setHistOpen((v) => !v)} aria-expanded={histOpen} className={`w-full ${BTN_CLASS}`} style={{ ...btnStyle("secondary"), minHeight: 44, fontSize: rem(15) }} data-biz-hist-toggle>
          {histOpen ? "조회 이력 접기" : "조회 이력 보기"}
        </button>
      )}
      {canSeeHistory && (!compact || histOpen) && (
        <div className="flex flex-col gap-2" data-biz-history>
          <div className="font-bold" style={{ fontSize: rem(15), color: "#0B2540" }}>
            {requestId ? "이 신청의 조회 이력" : "최근 조회 이력"} ({cards.length})
          </div>
          {cards.length === 0 && <div style={META}>아직 조회 기록이 없어요.</div>}
          {shown.map(({ check: c, rechecks }) => (
            <div key={c.id} className="border border-gray200 rounded-xl" style={{ padding: "8px 12px" }} data-biz-card>
              {c.kind === "status_recheck" ? (
                <div style={META}>
                  승인 시 상태 재조회 · {statusLabel(c.status_code)} · {fmtDate(c.checked_at)}
                </div>
              ) : (
                <>
                <div className="flex flex-wrap items-center gap-2">
                  <BusinessCheckBadge check={c} />
                  {c.reused_from_check_id && <ReusedChip />}
                  <span style={META}>{fmtDate(c.checked_at)}{c.checked_by_name ? ` · ${c.checked_by_name}` : ""}</span>
                </div>
                <div style={META}>
                  {c.b_no_masked} · {c.rep_name} · 개업 {fmtOpen(c.open_date)}
                  {c.input_company_name ? ` · ${c.input_company_name}` : ""}
                  {!requestId ? ` · ${requestName(c.seller_request_id)}` : ""}
                </div>
                {c.exception_ok && (
                  <div style={META}>
                    예외 확인 · {c.exception_by_admin_name ?? ""} · {c.exception_reason}
                  </div>
                )}
                {canException && !isPassingCheck(c) && latestPerRequest.has(c.id) && (
                  exceptionFor === c.id ? (
                    <div className="flex flex-col gap-1.5 mt-2">
                      <textarea
                        className="w-full border-2 border-gray200 rounded-xl px-3 py-2 outline-none focus:border-orange"
                        style={{ fontSize: DEAL_INPUT_FONT_SIZE }}
                        rows={2}
                        maxLength={300}
                        placeholder="예외 사유 (예: 폐업사실증명원 사본 확인 — 대표자명 일치)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <div style={{ ...META, color: "#966B00" }}>사업자등록증·폐업사실증명원 사본은 확인 후 바로 파기해 주세요(저장하지 않아요).</div>
                      {exceptionError && <div style={{ ...META, color: "#C2282D" }}>{exceptionError}</div>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveException(c.id)} className="font-bold rounded-lg text-sm px-3.5 py-2 text-white" style={{ background: "#0B2540" }}>
                          예외 확인 저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExceptionFor(null);
                            setExceptionError(null);
                          }}
                          className="font-bold rounded-lg text-sm px-3.5 py-2 border border-gray200 text-gray500"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setExceptionFor(c.id);
                        setReason("");
                        setExceptionError(null);
                      }}
                      className="mt-1.5 font-bold rounded-lg text-sm px-3 py-1.5 border border-gray200"
                      style={{ color: "#966B00" }}
                    >
                      예외 확인
                    </button>
                  )
                )}
                  {rechecks.map((r) => (
                    <div key={r.id} style={META} data-biz-recheck>
                      · 승인 시 재조회 {statusLabel(r.status_code)} {fmtDate(r.checked_at)}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
          {canToggle && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`w-full ${BTN_CLASS}`}
              style={{ ...btnStyle("secondary"), minHeight: 44, fontSize: rem(15) }}
              data-biz-toggle
            >
              {expanded ? "접기" : `전체 보기 (${cards.length})`}
            </button>
          )}
        </div>
      )}
      </>)}
    </div>
  );
}
