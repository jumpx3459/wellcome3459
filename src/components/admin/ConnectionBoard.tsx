"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LIST_CARD_TITLE_PROPS } from "@/components/admin/cardTitle";
import AdminListCard from "@/components/admin/AdminListCard";
import { LABEL } from "@/components/admin/DashboardViz";
import { UI_CARD_TITLE } from "@/lib/uiText";
import { rem } from "@/lib/rem";
import { formatPhone } from "@/lib/phone";
import { formatMemberNo, formatPriceInput, parsePriceInput } from "@/lib/format";
import { formatConsentDate } from "@/lib/consent";
import {
  BOARD_STEPS, END_REASONS, MEMO_MAX, MEMO_PLACEHOLDER, RESULT_LABEL,
  boardStep, contactMessage, resultDueAt, type ConnectionResult, type ConnectionStatus, type EndReasonKey,
} from "@/lib/connectionSteps";

// 2026-10-04 F-4 거래 연결 보드 — 관리자 페이지 "거래 연결" 카드(리드 카드 바로 아래).
// 번호는 가린 값, [구매자 번호 보기]는 별도 API(감사 로그). 판매자 정보도 펼칠 때만 불러옴(감사 로그).
// 2026-10-10 권한표: 점핑매니저에게는 서버가 배정된 건만 줌. 최고관리자·관리자는 카드마다 "담당: [선택 ▾]"(PATCH …/assign, 감사 기록)
// 2026-10-11 PR ② 4단계 보드: 카드 = 진행 막대 4칸(판매자 확인 → 구매자 확인 → 연락처 전달 → 결과 확인) + "다음 할 일" 한 문장 + 답 버튼.
//   답 버튼 하나 = /step 한 번. 연락 방법 선택 없음, 메모는 "+ 메모 남기기"로 접음. "이 건 끝내기"(사유 4개)는 어느 단계에서나.
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
  contact_sent_at: string | null;
  closed_at: string | null;
  name_disclosure_ok: boolean;
  stuck: boolean;
  result_due: boolean;
  is_test: boolean;
};

const fmtTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
    : "";
// "10.14" — 결과 확인 시작일(한국 시간)
const fmtMonthDay = (ms: number) => {
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).formatToParts(new Date(ms));
  return `${p.find((x) => x.type === "month")?.value}.${p.find((x) => x.type === "day")?.value}`;
};

const chip = (bg: string, color: string) => ({ fontSize: rem(13), background: bg, color });
const NAVY = "#0B2540";
const ORANGE = "#E25100";

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
  const [stuckCount, setStuckCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
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
      setStuckCount(data.stuckCount ?? 0);
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

  return (
    <AdminListCard
      id="connections"
      className={isDesktop ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3" : "px-5 pt-4 flex flex-col gap-3"}
      title={<span {...LIST_CARD_TITLE_PROPS}>거래 연결</span>}
      badges={[
        { text: `${(items ?? []).length}건 진행`, tone: "gray" },
        ...(stuckCount > 0 ? [{ text: `${stuckCount}건 멈춤`, tone: "orange" as const, testId: "conn-stuck-count" }] : []),
      ]}
      open={open}
      onToggle={onToggle}
      empty={
        <div className="text-center text-gray500 py-6 text-sm">
          {loadError ?? (items === null ? "불러오는 중..." : "진행 중인 거래 연결이 없어요.")}
        </div>
      }
      items={items ?? []}
      // 단계가 바뀌면 카드 안 상태(성사 금액 칸·끝내기 펼침 등)를 새로 — key에 status 포함
      renderItem={(c) => <ConnectionRow key={`${c.id}-${c.status}`} item={c} adminKey={adminKey} onDone={done} assignees={assignees} />}
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

/** 진행 막대 4칸 — 지난 칸 남색, 지금 칸 주황, 남은 칸 회색(글자는 한 줄 — 360px에서 "✓"를 붙이면 두 줄로 꺾여 뺌) */
function StepBar({ status }: { status: ConnectionStatus }) {
  const cur = boardStep(status);
  return (
    <div className="mt-2.5 grid grid-cols-4 gap-1" data-testid="conn-stepbar" data-step-index={cur}>
      {BOARD_STEPS.map((label, i) => {
        const color = i < cur ? NAVY : i === cur ? ORANGE : "#D5DAE0";
        return (
          <div key={label} className="min-w-0 flex flex-col gap-1" aria-current={i === cur ? "step" : undefined}>
            <div style={{ height: 5, borderRadius: 3, background: color }} />
            <span
              className="text-center leading-tight"
              style={{ fontSize: rem(12), fontWeight: i === cur ? 800 : 500, color: i === cur ? ORANGE : i < cur ? NAVY : "#8A939E", wordBreak: "keep-all" }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ConnectionRow({ item, adminKey, onDone, assignees }: { item: ConnectionItem; adminKey: string; onDone: () => void; assignees: Assignee[] | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [endOpen, setEndOpen] = useState(false);
  const [endReason, setEndReason] = useState<EndReasonKey | null>(item.is_test ? "test" : null);

  const step = boardStep(item.status);

  const send = async (to: Exclude<ConnectionStatus, "requested">, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/connections/${item.id}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ from: item.status, to, memo, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "처리하지 못했어요. 다시 시도해주세요.");
        if (data.eventFailed) onDone();
        return;
      }
      setMemo("");
      onDone();
    } finally {
      setBusy(false);
    }
  };
  const close = (result: ConnectionResult, reason: string, extra: Record<string, unknown> = {}) => send("closed", { result, reason, ...extra });

  // 전체 번호 — [구매자 번호 보기]·[문구 복사]가 같이 씀(서버가 조회마다 감사 로그)
  const fetchPhone = async (): Promise<string | null> => {
    if (phone) return phone;
    setPhoneBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/connections/${item.id}/phone`, { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "번호를 불러오지 못했어요.");
        return null;
      }
      setPhone(data.phone);
      return data.phone as string;
    } finally {
      setPhoneBusy(false);
    }
  };
  const copyMessage = async () => {
    const p = await fetchPhone();
    if (!p) return;
    const text = contactMessage(item.deal_title || "(매물명 없음)", formatPhone(p));
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const noConsent = !item.consent_at;
  // 단계별 "다음 할 일" 한 문장 · 답 버튼 · 도구
  let sentence: ReactNode = null;
  let note: ReactNode = null;
  let answers: ReactNode = null;
  const tools: ("buyer" | "seller" | "copy")[] = [];
  if (step === 0) {
    sentence = "판매자에게 재고가 아직 있는지, 구매자에게 상호를 알려도 되는지 물어보세요.";
    answers = (
      <>
        <AnswerButton primary disabled={busy} onClick={() => send("seller_confirmed", { nameDisclosureOk: true })} testId="ans-seller-ok-name">
          예 · 상호 알려도 돼요
        </AnswerButton>
        <AnswerButton primary disabled={busy} onClick={() => send("seller_confirmed", { nameDisclosureOk: false })} testId="ans-seller-ok-private">
          예 · 상호는 비공개
        </AnswerButton>
      </>
    );
    tools.push("seller");
  } else if (step === 1) {
    sentence = "구매자에게 아직 사고 싶은지 물어보세요.";
    if (!item.name_disclosure_ok)
      note = (
        <p className="font-bold" style={{ fontSize: rem(14), color: "#B45309" }} data-testid="conn-name-private">
          🔒 판매자 상호는 알려주지 마세요
        </p>
      );
    answers = (
      <AnswerButton primary disabled={busy} onClick={() => send("buyer_confirmed")} testId="ans-buyer-yes">
        예, 계속 원해요
      </AnswerButton>
    );
    tools.push("buyer");
  } else if (step === 2) {
    sentence = "판매자에게 구매자 번호를 보내 주세요.";
    if (noConsent) {
      note = (
        <p className="font-bold" style={{ fontSize: rem(14), color: "#B91C1C" }} data-testid="conn-no-consent">
          연결 동의 없음 · 끝내기만 가능
        </p>
      );
    } else {
      answers = (
        <AnswerButton primary disabled={busy} onClick={() => send("contact_sent")} testId="ans-contact-sent">
          보냈어요
        </AnswerButton>
      );
      tools.push("buyer", "seller", "copy");
    }
  } else if (step === 3) {
    if (!item.result_due) {
      sentence = (
        <span data-testid="conn-wait">
          ⏳ 판매자가 구매자에게 연락하는 중이에요 · {item.contact_sent_at ? fmtMonthDay(resultDueAt(item.contact_sent_at)) : "-"}부터 결과 확인
        </span>
      );
    } else {
      sentence = "판매자에게 거래가 됐는지 물어보세요.";
      answers = successOpen ? (
        <div className="w-full flex flex-col gap-1.5">
          <label className="flex flex-col gap-1">
            <span className="font-bold" style={{ fontSize: rem(14), color: "#4B5563" }}>
              성사 금액 (선택 · 원)
            </span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(formatPriceInput(e.target.value))}
              placeholder="예: 1,200,000"
              className="w-full min-w-0 border-2 border-gray200 rounded-xl px-3 outline-none focus:border-orange bg-white"
              style={{ height: 40, fontSize: rem(15) }}
              data-testid="ans-amount"
            />
          </label>
          <div className="flex gap-1.5">
            <AnswerButton primary disabled={busy} onClick={() => close("success", "", { amount: parsePriceInput(amount) ?? null })} testId="ans-success-save">
              성사 저장
            </AnswerButton>
            <AnswerButton disabled={busy} onClick={() => setSuccessOpen(false)}>
              취소
            </AnswerButton>
          </div>
        </div>
      ) : (
        <>
          <AnswerButton primary disabled={busy} onClick={() => setSuccessOpen(true)} testId="ans-success">
            거래됐어요 (성사)
          </AnswerButton>
          <AnswerButton
            disabled={busy}
            onClick={() => {
              // 바로 닫지 않고 끝내기 화면을 "거래 안 됨"으로 열어 둠 — [끝내기]를 눌러야 닫힘
              setEndReason("no_deal");
              setEndOpen(true);
            }}
            testId="ans-failed"
          >
            안 됐어요 (불발)
          </AnswerButton>
        </>
      );
    }
  }

  return (
    <div
      className="bg-white border rounded-2xl px-4 py-3.5 min-w-0"
      style={{ borderColor: item.stuck && !item.is_test ? "#F5B5B5" : "#E4E7EB", opacity: item.is_test ? 0.85 : 1 }}
      data-testid="conn-row"
      data-conn-id={item.id}
      data-test-card={item.is_test ? "1" : undefined}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {item.is_test && (
          <span className="flex-shrink-0 font-bold px-2 py-0.5 rounded-full" style={chip("#EEF0F3", "#6B7480")} data-testid="conn-test">
            테스트
          </span>
        )}
        <div className="truncate min-w-0" style={UI_CARD_TITLE}>
          {item.deal_title || "(매물명 없음)"}
        </div>
      </div>
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
        {item.stuck && !item.is_test && (
          <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={chip("#FDECEC", "#B91C1C")} data-testid="conn-stuck">
            ⏸ 24시간 멈춤
          </span>
        )}
        {item.result_due && !item.is_test && (
          <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={chip("#FFF4E5", "#B45309")} data-testid="conn-due">
            결과 확인 차례
          </span>
        )}
      </div>
      <div className="mt-0.5" style={{ fontSize: rem(13), color: item.consent_at ? "#1D8A44" : "#8A939E" }} data-testid="conn-consent">
        {item.consent_at ? `연결 동의 ✓ ${formatConsentDate(item.consent_at)}` : "연결 동의 없음"}
      </div>
      {assignees ? (
        <AssignSelect item={item} adminKey={adminKey} assignees={assignees} onDone={onDone} />
      ) : (
        <div className="mt-1" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
          담당 {item.assigned_admin_name ?? "없음"} · 마지막 변경 {fmtTime(item.updated_at)}
        </div>
      )}

      <StepBar status={item.status} />

      <div className="mt-2.5 rounded-xl flex flex-col gap-2" style={{ background: "#F7F9FB", padding: 12 }} data-testid="conn-next">
        <p className="font-bold" style={{ fontSize: rem(16), color: "#1F2937", lineHeight: 1.45, wordBreak: "keep-all" }} data-testid="conn-sentence">
          {sentence}
        </p>
        {note}
        {answers && (
          <div className="flex flex-wrap gap-1.5" data-testid="conn-answers">
            {answers}
          </div>
        )}
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="conn-tools">
            {tools.includes("buyer") && item.has_phone && (
              <ToolButton onClick={fetchPhone} disabled={phoneBusy || !!phone} testId="tool-buyer-phone">
                {phone ? "✓ 구매자 번호 보는 중" : phoneBusy ? "불러오는 중..." : "구매자 번호 보기"}
              </ToolButton>
            )}
            {tools.includes("seller") && (
              <ToolButton onClick={() => setSellerOpen((v) => !v)} testId="tool-seller">
                {sellerOpen ? "판매자 정보 접기 ▲" : "판매자 정보 보기"}
              </ToolButton>
            )}
            {tools.includes("copy") && item.has_phone && (
              <ToolButton onClick={copyMessage} disabled={phoneBusy} testId="tool-copy">
                {copied ? "✓ 복사했어요" : "문구 복사"}
              </ToolButton>
            )}
          </div>
        )}
      </div>

      {sellerOpen && (
        <div className="mt-2">
          <SellerPrivatePanel connectionId={item.id} adminKey={adminKey} autoLoad />
        </div>
      )}

      {error && (
        <p className="mt-2 font-bold" style={{ fontSize: rem(14), color: "#B91C1C" }} role="alert">
          {error}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMemoOpen((v) => !v)}
          className="font-bold whitespace-nowrap"
          style={{ fontSize: rem(14), color: "#4B5563", minHeight: 36 }}
          data-testid="conn-memo-toggle"
        >
          {memoOpen ? "메모 접기 ▲" : memo ? "✎ 메모 있음" : "+ 메모 남기기"}
        </button>
        <button
          type="button"
          onClick={() => setEndOpen((v) => !v)}
          className="font-bold whitespace-nowrap"
          style={{ fontSize: rem(14), color: "#6B7480", minHeight: 36, textDecoration: "underline" }}
          data-testid="conn-end-toggle"
        >
          {endOpen ? "끝내기 닫기" : "이 건 끝내기"}
        </button>
      </div>
      {memoOpen && (
        <label className="mt-1 flex flex-col gap-1">
          <span style={{ ...LABEL, fontSize: rem(13) }}>
            다음 답과 함께 저장돼요 · {memo.length}/{MEMO_MAX}
          </span>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
            maxLength={MEMO_MAX}
            placeholder={MEMO_PLACEHOLDER}
            className="w-full min-w-0 border-2 border-gray200 rounded-xl px-3 outline-none focus:border-orange"
            style={{ height: 40, fontSize: rem(15) }}
            data-testid="conn-memo"
          />
        </label>
      )}
      {endOpen && (
        <div className="mt-2 rounded-xl flex flex-col gap-2" style={{ background: "#FFF7F5", border: "1px solid #F5D0C5", padding: 12 }} data-testid="conn-end-sheet">
          <div className="font-bold" style={{ fontSize: rem(15), color: "#1F2937" }}>
            이 건을 끝내는 이유
          </div>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="끝내는 이유">
            {END_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={endReason === r.key}
                onClick={() => setEndReason(r.key)}
                className="font-bold rounded-lg px-2 py-1"
                style={{
                  fontSize: rem(14),
                  minHeight: 44,
                  ...(endReason === r.key ? { background: NAVY, color: "#fff" } : { background: "#fff", color: NAVY, border: "1px solid #D5DAE0" }),
                }}
                data-end-reason={r.key}
              >
                {r.label}
                <span className="block font-normal" style={{ fontSize: rem(12), opacity: 0.8 }}>
                  {RESULT_LABEL[r.result]}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const r = END_REASONS.find((x) => x.key === endReason);
              if (r) close(r.result, r.label);
            }}
            disabled={busy || !endReason}
            className="w-full font-bold rounded-lg text-white disabled:opacity-50"
            style={{ fontSize: rem(15), minHeight: 44, background: "#B91C1C" }}
            data-testid="conn-end-submit"
          >
            끝내기
          </button>
        </div>
      )}
    </div>
  );
}

function AnswerButton({
  children,
  onClick,
  disabled,
  primary = false,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 font-bold rounded-lg px-3 disabled:opacity-60"
      style={{
        fontSize: rem(15),
        minHeight: 44,
        minWidth: "fit-content",
        wordBreak: "keep-all",
        ...(primary ? { background: NAVY, color: "#fff" } : { background: "#fff", color: NAVY, border: "1.5px solid #D5DAE0" }),
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function ToolButton({ children, onClick, disabled, testId }: { children: ReactNode; onClick: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-bold rounded-lg px-2.5 whitespace-nowrap disabled:opacity-70"
      style={{ fontSize: rem(14), minHeight: 36, background: "#fff", color: "#1B3A5C", border: "1px solid #C9D3DF" }}
      data-testid={testId}
    >
      {children}
    </button>
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
        {item.is_test && <span className="mr-1.5" style={{ ...LABEL, fontSize: rem(13) }}>[테스트]</span>}
        {item.deal_title || "(매물명 없음)"}
      </div>
      <div className="mt-1" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
        {item.buyer_phone_masked ?? "번호 없음"} · {item.result ? RESULT_LABEL[item.result] : "종료"}
        {item.result === "success" && item.result_amount != null && ` · ${item.result_amount.toLocaleString()}원`}
        {item.result_reason && ` · ${item.result_reason}`}
        {" · "}담당 {item.assigned_admin_name ?? "없음"} · {fmtTime(item.closed_at)}
      </div>
    </div>
  );
}

// 판매자 비공개 정보 3칸(상호·담당자·연락처) + 메모 — 조회도 감사 로그라 [불러오기]를 눌렀을 때만 가져옴
// 2026-10-11: 카드의 [판매자 정보 보기]로 펼치면 바로 불러옴(autoLoad — 누른 것 = 불러오기)
function SellerPrivatePanel({ connectionId, adminKey, autoLoad = false }: { connectionId: string; adminKey: string; autoLoad?: boolean }) {
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
  const autoRef = useRef(false);
  useEffect(() => {
    if (!autoLoad || autoRef.current) return;
    autoRef.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);
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
