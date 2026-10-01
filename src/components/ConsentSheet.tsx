"use client";

import { useState, type ReactNode } from "react";
import PrivacyConsentTextSheet from "@/components/PrivacyConsentTextSheet";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import type { ConsentType } from "@/lib/consent";
import { useBackToClose } from "@/lib/useBackToClose";

// 동의 시트 (2026-09-30) — 알림 켜기(매물 알림 1개)·기존 회원 재동의(필수 3 + 선택 2)가 같이 쓴다.
// 선택 항목 초기값은 항상 false. 필수 항목을 다 체크해야 주 버튼이 켜진다.
// tag: 표시용 [필수]/[선택] 덮어쓰기 — 알림 켜기 시트는 광고성 정보라 [선택]으로 보이되, 체크해야 버튼이 켜짐(required)
// viewPrivacyText: "보기"를 누르면 개인정보 수집·이용 동의 전문(PrivacyConsentTextSheet)을 띄움 (href 대신)
export type ConsentItem = { type: ConsentType; required: boolean; label: string; desc?: string; href?: string; viewPrivacyText?: boolean; tag?: "필수" | "선택" };

export default function ConsentSheet({
  title,
  desc,
  items,
  showAll = false,
  primaryLabel,
  busy = false,
  error,
  onSubmit,
  onCancel,
  cancelLabel = "다음에",
  pendingLabel = "필수 항목에 동의해주세요",
  footer,
}: {
  title: string;
  desc?: string;
  items: ConsentItem[];
  showAll?: boolean;
  primaryLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (values: Record<string, boolean>) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  pendingLabel?: string;
  footer?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.type, false])));
  const allOn = items.every((i) => values[i.type]);
  const requiredOk = items.every((i) => !i.required || values[i.type]);
  const toggle = (t: string) => setValues((v) => ({ ...v, [t]: !v[t] }));
  const [viewingPrivacy, setViewingPrivacy] = useState(false);
  // 2026-10-01 PR-C: 닫을 수 있는 시트(onCancel 있음 — 알림 켜기)만 뒤로가기 = 닫기. 재동의 시트(ConsentGate)는 닫을 수 없어 그대로
  useBackToClose(!!onCancel, () => onCancel?.());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl overflow-y-auto"
        style={{ maxHeight: "calc(100dvh - var(--sat, 0px) - 24px)", padding: "24px 20px calc(20px + env(safe-area-inset-bottom))" }}
      >
        <p className="font-black" style={{ fontSize: rem(20), color: "#0B2540" }}>{title}</p>
        {desc && <p className="mt-1.5" style={{ fontSize: rem(15), color: "#4B5563", lineHeight: 1.55, whiteSpace: "pre-line" }}>{desc}</p>}

        <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB" }}>
          {showAll && (
            <button
              type="button"
              onClick={() => setValues(Object.fromEntries(items.map((i) => [i.type, !allOn])))}
              className="flex items-center gap-2.5 w-full text-left"
              style={{ borderBottom: "1px solid #EEF0F2", background: "#FAFBFC", padding: "14px 15px" }}
            >
              <Check on={allOn} size={22} />
              <span className="font-bold" style={{ fontSize: rem(15), color: "#0B2540" }}>전체 동의</span>
            </button>
          )}
          {items.map((i) => (
            <div key={i.type} className="flex items-start w-full" style={{ borderBottom: "1px solid #F1F3F5", background: "#fff" }}>
              <button type="button" onClick={() => toggle(i.type)} className="flex items-start gap-2.5 flex-1 min-w-0 text-left" style={{ padding: "12px 15px" }}>
                <Check on={values[i.type]} size={20} />
                <span className="flex-1 min-w-0">
                  <span style={{ fontSize: rem(14), lineHeight: 1.45, color: values[i.type] ? "#1A1F26" : "#4B5563" }}>
                    <b style={{ color: (i.tag ?? (i.required ? "필수" : "선택")) === "필수" ? "#E25100" : "#6B7480" }}>[{i.tag ?? (i.required ? "필수" : "선택")}]</b> {i.label}
                  </span>
                  {i.desc && (
                    <span className="block mt-1" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                      {i.desc}
                    </span>
                  )}
                </span>
              </button>
              {i.href && (
                <a href={i.href} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 font-bold" style={{ fontSize: rem(14), color: "#9AA3AD", padding: "12px 15px 12px 4px" }}>
                  보기 ›
                </a>
              )}
              {i.viewPrivacyText && (
                <button type="button" onClick={() => setViewingPrivacy(true)} className="flex-shrink-0 font-bold" style={{ fontSize: rem(14), color: "#9AA3AD", padding: "12px 15px 12px 4px" }}>
                  보기 ›
                </button>
              )}
            </div>
          ))}
        </div>

        {error && <p className="mt-3 font-medium" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>{error}</p>}

        <button
          type="button"
          onClick={() => onSubmit(values)}
          disabled={busy || !requiredOk}
          className={`w-full mt-4 ${BTN_CLASS}`}
          style={btnStyle("primary")}
        >
          {busy ? "저장 중…" : requiredOk ? primaryLabel : pendingLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="mt-2 w-full" style={{ minHeight: 44, fontSize: rem(15), color: "#6B7480" }}>
            {cancelLabel}
          </button>
        )}
        {footer}
      </div>
      {viewingPrivacy && <PrivacyConsentTextSheet onClose={() => setViewingPrivacy(false)} />}
    </div>
  );
}

function Check({ on, size }: { on: boolean; size: number }) {
  return (
    <span
      aria-hidden
      className="rounded flex items-center justify-center flex-shrink-0 text-white font-black"
      style={{
        width: size,
        height: size,
        marginTop: 1,
        fontSize: rem(12),
        background: on ? "var(--color-brandOrange)" : "#fff",
        border: on ? "1.5px solid var(--color-brandOrange)" : "1.5px solid #C9CFD6",
      }}
    >
      {on ? "✓" : ""}
    </span>
  );
}
