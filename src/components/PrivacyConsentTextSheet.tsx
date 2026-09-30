"use client";

import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { PRIVACY_CONSENT_TEXT } from "@/lib/consent";

// 개인정보 수집·이용 동의(필수) 전문 보기 (2026-09-30, consent-texts 3번) — 가입 화면·재동의 시트의 "보기".
// 동의 시트(z-50) 위에 떠야 해서 z-[60].
export default function PrivacyConsentTextSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true" aria-label="개인정보 수집·이용 동의">
      <div
        className="w-full max-w-md bg-white rounded-t-3xl overflow-y-auto"
        style={{ maxHeight: "calc(100dvh - var(--sat, 0px) - 24px)", padding: "24px 20px calc(20px + env(safe-area-inset-bottom))" }}
      >
        <p className="font-black" style={{ fontSize: rem(19), color: "#0B2540" }}>개인정보 수집·이용 동의 (필수)</p>
        <p className="mt-3" style={{ fontSize: rem(15), color: "#1A1F26", lineHeight: 1.65, whiteSpace: "pre-line" }}>
          {PRIVACY_CONSENT_TEXT}
        </p>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="block mt-3 font-bold underline" style={{ fontSize: rem(14), color: "#6B7480" }}>
          개인정보처리방침 전체 보기 ›
        </a>
        <button type="button" onClick={onClose} className={`w-full mt-4 ${BTN_CLASS}`} style={btnStyle("secondary")}>
          닫기
        </button>
      </div>
    </div>
  );
}
