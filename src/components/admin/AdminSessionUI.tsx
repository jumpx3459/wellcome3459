"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { rem } from "@/lib/rem";
import { ADMIN_SESSION_WARN_MS } from "@/lib/adminSession";

// 관리자 세션 만료 대응 화면 조각 (2026-10-26, fix/admin-session-expiry)
//   · AdminLoginFields: 처음 로그인 화면과 "그 자리 로그인 창"이 같이 쓰는 번호·비밀번호 칸 + 입장 버튼(마크업은 예전 로그인 화면 그대로)
//   · AdminLoginOverlay: 대시보드·등록 패널 위(z-[60])에 뜨는 로그인 창. 닫아도 입력은 그대로 — 열려 있는 동안 Esc는 이 창만 닫음(패널 Esc 차단)
//   · SessionBanner: 남은 10분 이하 "곧 로그아웃돼요 [연장]", 만료 뒤 "로그인이 끝났어요 [다시 로그인]". 전체 화면 패널 안에도 같은 줄(AdminFullscreenPanel)
//   [연장]은 새 API 없이 이 로그인 창을 여는 것 — 새 토큰이 나오는 곳은 /api/admin/login 하나

export type LoginReason = "expired" | "extend";

type SessionCtx = { expiresAt: number | null; requestLogin: (reason: LoginReason) => void };
const SessionContext = createContext<SessionCtx>({ expiresAt: null, requestLogin: () => {} });
export const AdminSessionProvider = SessionContext.Provider;

export function SessionBanner({ className = "" }: { className?: string }) {
  const { expiresAt, requestLogin } = useContext(SessionContext);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const remaining = expiresAt - now;
  if (remaining > ADMIN_SESSION_WARN_MS) return null;
  const ended = remaining <= 0;
  const min = Math.max(1, Math.ceil(remaining / 60000));
  return (
    <div
      role={ended ? "alert" : "status"}
      className={`flex items-center justify-between gap-3 px-4 flex-shrink-0 ${className}`}
      style={{ minHeight: 44, background: ended ? "#FDECEC" : "#FFF4E0", color: ended ? "#9B1C1C" : "#7A3E00", borderBottom: `1px solid ${ended ? "#F3B8B8" : "#F5D9A8"}` }}
      data-session-banner={ended ? "ended" : "soon"}
    >
      <span className="font-bold min-w-0" style={{ fontSize: rem(15) }}>
        {ended ? "로그인이 끝났어요" : `곧 로그아웃돼요 · ${min}분 남음`}
      </span>
      <button
        type="button"
        onClick={() => requestLogin(ended ? "expired" : "extend")}
        className="flex-shrink-0 font-bold rounded-lg text-white"
        style={{ minHeight: 36, padding: "0 14px", fontSize: rem(15), background: "#0B2540" }}
        data-session-banner-action
      >
        {ended ? "다시 로그인" : "연장"}
      </button>
    </div>
  );
}

export function AdminLoginFields({
  phone,
  onPhone,
  password,
  onPassword,
  error,
  busy,
  onSubmit,
  autoFocusPassword = false,
}: {
  phone: string;
  onPhone: (v: string) => void;
  password: string;
  onPassword: (v: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
  /** 번호가 미리 채워져 있으면 비밀번호 칸에 바로 커서 */
  autoFocusPassword?: boolean;
}) {
  const pwRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocusPassword) pwRef.current?.focus();
  }, [autoFocusPassword]);
  return (
    <>
      <input
        type="tel"
        name="username"
        autoComplete="username"
        inputMode="numeric"
        className="w-full max-w-xs border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange mb-2"
        style={{ height: "52px" }}
        value={phone}
        onChange={(e) => onPhone(e.target.value)}
        placeholder="관리자 휴대폰 번호"
      />
      <input
        ref={pwRef}
        type="password"
        name="password"
        autoComplete="current-password"
        className="w-full max-w-xs border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
        style={{ height: "52px" }}
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="비밀번호 입력"
      />
      {error && <p className="text-orange text-sm font-medium mt-2">{error}</p>}
      <button
        onClick={onSubmit}
        disabled={busy}
        className="w-full max-w-xs mt-3 text-white font-bold rounded-xl text-base disabled:opacity-60"
        style={{ background: "#0B2540", padding: "14px 0" }}
      >
        {busy ? "확인 중..." : "입장"}
      </button>
    </>
  );
}

export function AdminLoginOverlay({
  reason,
  onClose,
  ...fields
}: {
  reason: LoginReason;
  onClose: () => void;
} & Parameters<typeof AdminLoginFields>[0]) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 열려 있는 동안 Esc = 이 창만 닫기 — 캡처 단계에서 가로채 AdminFullscreenPanel의 Esc(닫기·"저장 안 하고 닫기" 확인)가 안 불리게 함. Tab은 창 안에서만 돎
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !rootRef.current) return;
      const els = [...rootRef.current.querySelectorAll<HTMLElement>("input, button:not(:disabled)")];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (!rootRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  useEffect(() => {
    if (!fields.autoFocusPassword) rootRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [fields.autoFocusPassword]);

  const ended = reason === "expired";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(11,37,64,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="관리자 다시 로그인"
      data-admin-relogin
    >
      <div ref={rootRef} className="w-full max-w-sm bg-white rounded-2xl flex flex-col items-center" style={{ padding: "22px 18px", maxHeight: "92vh", overflowY: "auto" }}>
        <h2 className="font-display text-navy text-center" style={{ fontSize: rem(20) }}>
          {ended ? "관리자 로그인이 끝났어요" : "로그인 시간 연장"}
        </h2>
        <p className="mt-1.5 mb-4 text-center text-gray500" style={{ fontSize: rem(14), lineHeight: 1.5 }}>
          {ended ? "다시 로그인하면 작성 중인 내용은 그대로 이어서 쓸 수 있어요." : "비밀번호를 다시 입력하면 6시간 더 쓸 수 있어요. 작성 중인 내용은 그대로예요."}
        </p>
        <AdminLoginFields {...fields} />
        <button type="button" onClick={onClose} className="mt-3 text-sm font-bold text-gray500 underline" data-relogin-close>
          닫기
        </button>
      </div>
    </div>
  );
}
