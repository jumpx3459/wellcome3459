"use client";

import { useState } from "react";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { CONNECTION_CONSENT_TEXT } from "@/lib/consent";
import { useBackToClose } from "@/lib/useBackToClose";

// 2026-10-03 F-3a: 관심있어요 — 판매자 연결 동의 시트 (consent-texts 7-1). 회원·비회원 공용.
// 체크 초기값 해제, 체크해야 [동의하고 연결 요청]이 켜짐. [관심 표시만 할게요]는 연결 기록 없이 지금 흐름 그대로.
// 저장 실패 시 시트를 닫지 않고(체크 유지) error 문구만 띄운다 — 호출하는 쪽이 닫을지 결정.
// 2026-10-03: 안드로이드 큰 글자에서 시트가 화면보다 넓어져 오른쪽이 잘린 제보 — 시트 폭을 화면 폭(100vw) 이하로 묶고,
// 안쪽 칸·버튼은 min-w-0 + 폭 100%(테두리 포함)로 넘침 없이 좌우 여백 20px 대칭. 문구·동작은 그대로.
export default function ConnectionConsentSheet({
  busy = false,
  error,
  onAgree,
  onInterestOnly,
  onClose,
}: {
  busy?: boolean;
  error?: string | null;
  onAgree: () => void;
  onInterestOnly: () => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  useBackToClose(true, onClose);
  const t = CONNECTION_CONSENT_TEXT;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden"
      style={{ background: "rgba(0,0,0,.5)" }}
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="w-full min-w-0 bg-white rounded-t-3xl overflow-y-auto overflow-x-hidden box-border"
        style={{
          maxWidth: "min(28rem, 100vw)",
          maxHeight: "calc(100dvh - var(--sat, 0px) - 24px)",
          padding: "24px 20px calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        <p className="font-black" style={{ fontSize: rem(20), color: "#0B2540" }}>{t.title}</p>

        <label
          className="mt-4 flex items-start gap-2.5 rounded-2xl cursor-pointer w-full min-w-0 box-border"
          style={{ border: "1.5px solid #E4E7EB", padding: "14px 15px" }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 flex-shrink-0"
            style={{ width: 20, height: 20, accentColor: "#E25100" }}
            data-testid="connection-consent-check"
          />
          <span className="flex-1 min-w-0">
            <span style={{ fontSize: rem(15), lineHeight: 1.45, color: "#1A1F26" }}>
              <b style={{ color: "#E25100" }}>[필수]</b> {t.label}
            </span>
            <span className="block mt-2" style={{ fontSize: rem(14), color: "#4B5563", lineHeight: 1.55 }}>
              {t.rows.map(([k, v]) => (
                <span key={k} className="block">
                  · {k}: {v}
                </span>
              ))}
            </span>
          </span>
        </label>
        <p className="mt-2.5" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.5 }}>{t.refuse}</p>

        {error && (
          <p className="mt-3 font-medium" role="alert" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>
            {error}
          </p>
        )}

        <button type="button" onClick={onAgree} disabled={busy || !checked} className={`w-full min-w-0 box-border mt-4 ${BTN_CLASS}`} style={btnStyle("primary")}>
          {busy ? "요청 중…" : t.agree}
        </button>
        <button type="button" onClick={onInterestOnly} disabled={busy} className={`w-full min-w-0 box-border mt-2 ${BTN_CLASS}`} style={btnStyle("secondary")}>
          {t.interestOnly}
        </button>
      </div>
    </div>
  );
}
