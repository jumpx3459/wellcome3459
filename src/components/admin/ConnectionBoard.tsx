"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_TITLE_PROPS } from "@/components/admin/cardTitle";
import AdminListCard from "@/components/admin/AdminListCard";
import { LABEL } from "@/components/admin/DashboardViz";
import { UI_CARD_TITLE } from "@/lib/uiText";
import { rem } from "@/lib/rem";
import { formatPhone } from "@/lib/phone";
import { formatMemberNo, formatPriceInput, parsePriceInput } from "@/lib/format";
import { formatConsentDate } from "@/lib/consent";
import {
  CONNECTION_METHODS, CONNECTION_RESULTS, MEMO_MAX, MEMO_PLACEHOLDER, METHOD_LABEL, RESULT_LABEL, STEP_ACTION_LABEL, STEP_DONE_LABEL, STEP_LABEL, STEP_MARK,
  stepIndex, type ConnectionMethod, type ConnectionResult, type ConnectionStatus,
} from "@/lib/connectionSteps";

// 2026-10-04 F-4 거래 연결 보드 — 관리자 페이지 "거래 연결" 카드(리드 카드 바로 아래).
// 진행 중 전체(멈춘 연결 → 오래된 순) + 최근 종료 20건(접힘). 번호는 가린 값, [번호 보기]는 별도 API(감사 로그).
// 단계 버튼: ②~⑤는 앞으로만(건너뛰기 허용), ⑥ 결과는 어느 단계에서나. 방법(전화·문자·카톡) 필수, 메모 선택 200자.
// 2026-10-10 권한표: 점핑매니저에게는 서버가 배정된 건만 줌. 최고관리자·관리자는 카드마다 "담당: [선택 ▾]"(PATCH …/assign, 감사 기록)
export type Assignee = { id: string; name: string; role: string };
export type ConnectionItem = {
  id: string;
  deal_id: string;
  deal_title: string;
  buyer_kind: "member" | "guest" | "unknown";
  buyer_member_no: number | null;
  buyer_phone_masked: string | null;
  has_phone: boolean;
  source: string;
  consent_at: string | null;
  status: ConnectionStatus;
  result: ConnectionResult | null;
  result_amount: number | null;
  result_reason: string | null;
  assigned_admin_id?: string | null;
  assigned_admin_name: string | null;
  updated_at: string;
  closed_at: string | null;
  name_disclosure_ok: boolean;
  stuck: boolean;
};

const FORWARD_STEPS = ["accepted", "seller_confirmed", "buyer_confirmed", "contact_sent"] as const;

const fmtTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
    : "";

const chip = (bg: string, color: string) => ({ fontSize: rem(14), background: bg, color });

export default function ConnectionBoard({
  adminKey,
  isDesktop,
  open,
  onToggle,
  onCounts,
  onChanged,
  assignees = null,
}: {
  adminKey: string;
  isDesktop: boolean;
  open: boolean;
  onToggle: () => void;
  /** 진행 중·멈춘 건수 — 카드 제목·"조치 필요" 칸 */
  onCounts?: (c: { open: number; closed: number; stuck: number }) => void;
  /** 단계 전환 뒤 — 리드 카드(연락완료·성사/불발) 다시 불러오기 */
  onChanged?: () => void;
  /** 배정할 수 있는 관리자 목록 — 있으면(최고관리자·관리자) 카드에 담당 선택 칸 */
  assignees?: Assignee[] | null;
}) {
  const [items, setItems] = useState<ConnectionItem[] | null>(null);
  const [closed, setClosed] = useState<ConnectionItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const countsRef = useRef(onCounts);
  useEffect(() => {
    countsRef.current = onCounts;
  }, [onCounts]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/connections", { headers: { "x-admin-key": adminKey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error ?? "거래 연결 목록을 불러오지 못했어요.");
        return;
      }
      setLoadError(null);
      setItems(data.open ?? []);
      setClosed(data.closed ?? []);
      countsRef.current?.({ open: (data.open ?? []).length, closed: (data.closed ?? []).length, stuck: data.stuckCount ?? 0 });
    } catch {
      setLoadError("거래 연결 목록을 불러오지 못했어요.");
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const done = () => {
    load();
    onChanged?.();
  };
  const stuckCount = (items ?? []).filter((c) => c.stuck).length;

  return (
    <AdminListCard
      id="connections"
      className={isDesktop ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3" : "px-5 pt-4 flex flex-col gap-3"}
      title={
        <span {...CARD_TITLE_PROPS}>
          거래 연결{" "}
          <span style={{ ...LABEL, fontWeight: 400 }}>
            ({(items ?? []).length}건 진행
            {stuckCount > 0 && (
              <>
                {" · "}
                <span style={{ color: "#B91C1C", fontWeight: 700 }}>{stuckCount}건 멈춤</span>
              </>
            )}
            )
          </span>
        </span>
      }
      open={open}
      onToggle={onToggle}
      empty={
        <div className="text-center text-gray500 py-6 text-sm">
          {loadError ?? (items === null ? "불러오는 중..." : "진행 중인 거래 연결이 없어요.")}
        </div>
      }
      items={items ?? []}
      renderItem={(c) => (
        <ConnectionRow
          key={c.id}
          item={c}
          adminKey={adminKey}
          expanded={expanded === c.id}
          onToggleExpand={() => setExpanded((v) => (v === c.id ? null : c.id))}
          onDone={done}
          assignees={assignees}
        />
      )}
      after={
        closed.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowClosed((v) => !v)}
              className="w-full text-sm font-bold text-gray500 border-2 border-gray200 rounded-xl py-2.5"
            >
              {showClosed ? "최근 종료 접기 ▲" : `최근 종료 ${closed.length}건 보기 ▼`}
            </button>
            {showClosed && closed.map((c) => <ClosedRow key={c.id} item={c} />)}
          </div>
        )
      }
    />
  );
}

function BuyerLine({ item, adminKey }: { item: ConnectionItem; adminKey: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/connections/${item.id}/phone`, { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "번호를 불러오지 못했어요.");
      else setPhone(data.phone);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0" style={{ fontSize: rem(15), color: "#4B5563", fontVariantNumeric: "tabular-nums" }}>
      {phone ? (
        <a href={`tel:${phone}`} className="font-bold text-navy whitespace-nowrap" data-testid="conn-phone-full">
          {formatPhone(phone)}
        </a>
      ) : (
        <span className="font-bold whitespace-nowrap" data-testid="conn-phone-masked">
          {item.buyer_phone_masked ?? (item.buyer_kind === "member" ? "번호 없음(탈퇴)" : "번호 없음")}
        </span>
      )}
      <span className="whitespace-nowrap" style={LABEL}>
        · {item.buyer_kind === "guest" ? "비회원" : "회원"}
        {item.buyer_member_no != null && ` ${formatMemberNo(item.buyer_member_no)}`}
      </span>
      {!phone && item.has_phone && (
        <button
          type="button"
          onClick={reveal}
          disabled={busy}
          className="text-xs font-bold rounded-lg px-2.5 py-1 border border-gray200 text-navy disabled:opacity-60 whitespace-nowrap"
        >
          {busy ? "불러오는 중..." : "번호 보기"}
        </button>
      )}
      {error && <span className="text-xs font-bold" style={{ color: "#B91C1C" }}>{error}</span>}
    </div>
  );
}

function StatusChips({ item }: { item: ConnectionItem }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      {item.stuck && (
        <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={chip("#FDECEC", "#B91C1C")} data-testid="conn-stuck">
          ⏸ 24시간 멈춤
        </span>
      )}
      <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={chip("#EAF0F7", "#1B3A5C")}>
        {item.status === "closed" && item.result ? `⑥ ${RESULT_LABEL[item.result]}` : STEP_LABEL[item.status]}
      </span>
      {item.consent_at ? (
        <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={chip("#E8F8EC", "#1D8A44")}>
          연결 동의 ✓ {formatConsentDate(item.consent_at)}
        </span>
      ) : (
        <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={chip("#F5F6F8", "#6B7480")}>
          연결 동의 없음
        </span>
      )}
    </div>
  );
}

function ConnectionRow({
  item,
  adminKey,
  expanded,
  onToggleExpand,
  onDone,
  assignees,
}: {
  item: ConnectionItem;
  adminKey: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onDone: () => void;
  assignees: Assignee[] | null;
}) {
  const [method, setMethod] = useState<ConnectionMethod | null>(null);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [nameOk, setNameOk] = useState(item.name_disclosure_ok);

  const submit = async (to: Exclude<ConnectionStatus, "requested">) => {
    if (!method) {
      setError("연락 방법(전화·문자·카톡)을 골라주세요.");
      return;
    }
    if (to === "closed" && !result) {
      setError("결과(성사·불발·취소)를 골라주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/connections/${item.id}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          from: item.status,
          to,
          method,
          memo,
          ...(to === "seller_confirmed" ? { nameDisclosureOk: nameOk } : {}),
          ...(to === "closed" ? { result, amount: result === "success" ? parsePriceInput(amount) ?? null : null, reason } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "처리하지 못했어요. 다시 시도해주세요.");
        if (data.eventFailed) onDone();
        return;
      }
      setMemo("");
      setResultOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const cur = stepIndex(item.status);
  const pill = (active: boolean) =>
    `flex-shrink-0 font-bold rounded-lg px-3 whitespace-nowrap ${active ? "text-white" : "text-navy border border-gray200"}`;

  return (
    <div
      className="bg-white border rounded-2xl px-4 py-3.5 min-w-0"
      style={{ borderColor: item.stuck ? "#F5B5B5" : "#E4E7EB" }}
      data-testid="conn-row"
      data-conn-id={item.id}
    >
      <div className="truncate" style={UI_CARD_TITLE}>
        {item.deal_title || "(매물명 없음)"}
      </div>
      <BuyerLine item={item} adminKey={adminKey} />
      <StatusChips item={item} />
      {assignees ? (
        <AssignSelect item={item} adminKey={adminKey} assignees={assignees} onDone={onDone} />
      ) : (
        <div className="mt-1" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
          담당 {item.assigned_admin_name ?? "없음"} · 마지막 변경 {fmtTime(item.updated_at)}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleExpand}
        className="mt-2.5 w-full font-bold rounded-lg"
        style={{ fontSize: rem(15), minHeight: 40, ...(expanded ? { background: "#F5F6F8", color: "#6B7480" } : { background: "#0B2540", color: "#fff" }) }}
      >
        {expanded ? "닫기 ▲" : "단계 처리 ▼"}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div>
            <div className="font-bold" style={{ fontSize: rem(14), color: "#4B5563" }}>
              연락 방법 (필수)
            </div>
            <div className="mt-1 flex gap-1.5" role="radiogroup" aria-label="연락 방법">
              {CONNECTION_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 ${pill(method === m)}`}
                  style={{ fontSize: rem(15), minHeight: 40, ...(method === m ? { background: "#0B2540" } : {}) }}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-bold" style={{ fontSize: rem(14), color: "#4B5563" }}>
              메모 (선택 · {memo.length}/{MEMO_MAX})
            </span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
              maxLength={MEMO_MAX}
              placeholder={MEMO_PLACEHOLDER}
              className="w-full min-w-0 border-2 border-gray200 rounded-xl px-3 outline-none focus:border-orange"
              style={{ height: 40, fontSize: rem(15) }}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            {FORWARD_STEPS.map((s) => {
              const passed = stepIndex(s) <= cur;
              const needConsent = s === "contact_sent" && !item.consent_at;
              return (
                <div key={s} className="flex flex-col gap-1">
                  <span className="px-1" style={{ ...LABEL, fontSize: rem(13) }}>
                    {STEP_MARK[s]}
                    {s === "accepted" && item.assigned_admin_name && ` · 담당 ${item.assigned_admin_name} 그대로`}
                  </span>
                  <button
                    type="button"
                    onClick={() => submit(s)}
                    disabled={busy || passed || needConsent}
                    data-step={s}
                    className="w-full font-bold rounded-lg text-left px-3 disabled:opacity-50"
                    style={{ fontSize: rem(15), minHeight: 40, border: "1.5px solid #D5DAE0", color: "#0B2540", background: passed ? "#F5F6F8" : "#fff" }}
                  >
                    {passed ? STEP_DONE_LABEL[s] : STEP_ACTION_LABEL[s]}
                    {needConsent && !passed && <span className="ml-1.5 text-xs" style={{ color: "#B91C1C" }}>연결 동의 필요</span>}
                  </button>
                  {/* ③: 판매자가 상호를 구매자에게 알려도 된다고 했는지 → deal_seller_private.name_disclosure_ok */}
                  {s === "seller_confirmed" && !passed && (
                    <label className="flex items-center gap-1.5 px-1 font-bold" style={{ fontSize: rem(14), color: "#4B5563" }}>
                      <input type="checkbox" checked={nameOk} onChange={(e) => setNameOk(e.target.checked)} className="w-4 h-4 flex-shrink-0" />
                      판매자가 상호 안내를 허락함
                    </label>
                  )}
                  {/* ④: 막지 않고 허락 여부만 */}
                  {s === "buyer_confirmed" && (
                    <span className="px-1 font-bold" style={{ fontSize: rem(14), color: item.name_disclosure_ok ? "#1D8A44" : "#966B00" }}>
                      {item.name_disclosure_ok ? "✓ 상호 안내 허락됨" : "허락 없음 · 상호 비공개로 안내"}
                    </span>
                  )}
                </div>
              );
            })}
            <span className="px-1" style={{ ...LABEL, fontSize: rem(13) }}>
              {STEP_MARK.closed}
            </span>
            <button
              type="button"
              onClick={() => setResultOpen((v) => !v)}
              disabled={busy}
              data-step="closed"
              className="w-full font-bold rounded-lg text-left px-3 disabled:opacity-50"
              style={{ fontSize: rem(15), minHeight: 40, border: "1.5px solid #D5DAE0", color: "#0B2540", background: resultOpen ? "#EEF2F7" : "#fff" }}
            >
              {STEP_ACTION_LABEL.closed} {resultOpen ? "▲" : "▼"}
            </button>
            {resultOpen && (
              <div className="rounded-xl flex flex-col gap-2" style={{ background: "#F7F9FB", padding: 12 }}>
                <div className="flex gap-1.5" role="radiogroup" aria-label="결과">
                  {CONNECTION_RESULTS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={result === r}
                      onClick={() => setResult(r)}
                      className={`flex-1 ${pill(result === r)}`}
                      style={{ fontSize: rem(15), minHeight: 40, ...(result === r ? { background: "#0B2540" } : { background: "#fff" }) }}
                    >
                      {RESULT_LABEL[r]}
                    </button>
                  ))}
                </div>
                {result === "success" && (
                  <label className="flex flex-col gap-1">
                    <span className="font-bold" style={{ fontSize: rem(14), color: "#4B5563" }}>성사 금액 (선택 · 원)</span>
                    <input
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(formatPriceInput(e.target.value))}
                      placeholder="예: 1,200,000"
                      className="w-full min-w-0 border-2 border-gray200 rounded-xl px-3 outline-none focus:border-orange"
                      style={{ height: 40, fontSize: rem(15) }}
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1">
                  <span className="font-bold" style={{ fontSize: rem(14), color: "#4B5563" }}>사유 (선택)</span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, MEMO_MAX))}
                    maxLength={MEMO_MAX}
                    placeholder={MEMO_PLACEHOLDER}
                    className="w-full min-w-0 border-2 border-gray200 rounded-xl px-3 outline-none focus:border-orange"
                    style={{ height: 40, fontSize: rem(15) }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => submit("closed")}
                  disabled={busy}
                  className="w-full font-bold rounded-lg text-white disabled:opacity-60"
                  style={{ fontSize: rem(15), minHeight: 40, background: "#0B2540" }}
                >
                  결과 저장
                </button>
              </div>
            )}
          </div>
          {error && (
            <p className="font-bold" style={{ fontSize: rem(14), color: "#B91C1C" }} role="alert">
              {error}
            </p>
          )}
          <SellerPrivatePanel connectionId={item.id} adminKey={adminKey} />
        </div>
      )}
    </div>
  );
}

// 담당 선택 — 바꾸면 바로 저장(PATCH /api/admin/connections/[id]/assign). 미배정이면 "없음"이 맨 위(다시 "없음"으로는 못 돌림)
function AssignSelect({ item, adminKey, assignees, onDone }: { item: ConnectionItem; adminKey: string; assignees: Assignee[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = item.assigned_admin_id ?? "";
  const known = !current || assignees.some((a) => a.id === current);
  const change = async (assigneeId: string) => {
    if (!assigneeId || assigneeId === current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/connections/${item.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ assigneeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "담당을 바꾸지 못했어요.");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
      <label className="inline-flex items-center gap-1.5 min-w-0">
        <span className="whitespace-nowrap">담당</span>
        <select
          value={current}
          onChange={(e) => change(e.target.value)}
          disabled={busy}
          className="min-w-0 max-w-full font-bold rounded-lg border border-gray200 bg-white text-navy px-2 disabled:opacity-60"
          style={{ fontSize: rem(14), height: 32 }}
          data-testid="conn-assign"
        >
          {!current && <option value="">없음 · 배정하기</option>}
          {!known && <option value={current}>{item.assigned_admin_name ?? "(해제된 관리자)"}</option>}
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.role})
            </option>
          ))}
        </select>
      </label>
      <span className="whitespace-nowrap">· 마지막 변경 {fmtTime(item.updated_at)}</span>
      {error && <span className="font-bold" style={{ color: "#B91C1C" }}>{error}</span>}
    </div>
  );
}

function ClosedRow({ item }: { item: ConnectionItem }) {
  return (
    <div className="bg-white border border-gray200 rounded-2xl px-4 py-3 min-w-0" data-testid="conn-closed-row">
      <div className="truncate font-bold" style={{ fontSize: rem(16), color: "#1F2937" }}>
        {item.deal_title || "(매물명 없음)"}
      </div>
      <div className="mt-1" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
        {item.buyer_phone_masked ?? "번호 없음"} · {item.result ? RESULT_LABEL[item.result] : "종료"}
        {item.result === "success" && item.result_amount != null && ` · ${item.result_amount.toLocaleString()}원`}
        {" · "}담당 {item.assigned_admin_name ?? "없음"} · {fmtTime(item.closed_at)}
      </div>
    </div>
  );
}

// 판매자 비공개 정보 3칸(상호·담당자·연락처) + 메모 — 조회도 감사 로그라 [불러오기]를 눌렀을 때만 가져옴
function SellerPrivatePanel({ connectionId, adminKey }: { connectionId: string; adminKey: string }) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [form, setForm] = useState({ companyName: "", contactName: "", contactPhone: "", memo: "" });
  const [hint, setHint] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/connections/${connectionId}/seller`, { headers: { "x-admin-key": adminKey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "불러오지 못했어요.", error: true });
        return;
      }
      const it = data.item;
      const sg = data.suggest;
      setForm({
        companyName: it?.company_name ?? sg?.company_name ?? "",
        contactName: it?.contact_name ?? sg?.contact_name ?? "",
        contactPhone: it?.contact_phone ? formatPhone(it.contact_phone) : sg?.contact_phone ? formatPhone(sg.contact_phone) : "",
        memo: it?.memo ?? "",
      });
      setHint(sg ? "판매 신청 정보를 채워 뒀어요 · 저장해야 반영돼요" : !it?.company_name && !it?.contact_name && !it?.contact_phone ? "아직 저장된 정보가 없어요" : null);
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/connections/${connectionId}/seller`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { text: "저장했어요", error: false } : { text: data.error ?? "저장하지 못했어요.", error: true });
      if (res.ok) setHint(null);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string, max: number, extra?: { inputMode?: "tel"; placeholder?: string }) => (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="font-bold" style={{ fontSize: rem(14), color: "#4B5563" }}>{label}</span>
      <input
        aria-label={label}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value.slice(0, max) }))}
        maxLength={max}
        inputMode={extra?.inputMode}
        placeholder={extra?.placeholder}
        className="w-full min-w-0 border-2 border-gray200 rounded-xl px-3 outline-none focus:border-orange"
        style={{ height: 40, fontSize: rem(15) }}
      />
    </label>
  );

  return (
    <div className="rounded-xl flex flex-col gap-2" style={{ background: "#F7F9FB", padding: 12 }}>
      <div className="font-bold" style={{ fontSize: rem(15), color: "#1F2937" }}>
        판매자 비공개 정보 <span style={{ ...LABEL, fontWeight: 400 }}>(구매자에게 보이지 않음)</span>
      </div>
      {!loaded ? (
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="w-full font-bold rounded-lg disabled:opacity-60"
          style={{ fontSize: rem(15), minHeight: 40, border: "1.5px solid #D5DAE0", color: "#0B2540", background: "#fff" }}
        >
          {busy ? "불러오는 중..." : "판매자 비공개 정보 불러오기"}
        </button>
      ) : (
        <>
          {field("companyName", "상호", 100)}
          {field("contactName", "담당자", 50)}
          {field("contactPhone", "연락처", 20, { inputMode: "tel", placeholder: "예: 010-1234-5678 · 02-123-4567" })}
          {field("memo", "메모", MEMO_MAX)}
          {hint && <p style={LABEL}>{hint}</p>}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="w-full font-bold rounded-lg text-white disabled:opacity-60"
            style={{ fontSize: rem(15), minHeight: 40, background: "#0B2540" }}
          >
            판매자 정보 저장
          </button>
        </>
      )}
      {msg && (
        <p className="font-bold" style={{ fontSize: rem(14), color: msg.error ? "#B91C1C" : "#1D8A44" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
