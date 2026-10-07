"use client";

import { rem } from "@/lib/rem";

// 2026-09-30: 비회원 입력 폼(매물 상세 "번호만 남기기"·구매 희망 등록)의 [필수] 개인정보 수집·이용 동의.
// 비회원이라 member_consents에는 못 남김 — 서버(/api/quick-interest·/api/buy-requests)가 privacyConsent=true를 받고
// 행에 privacy_consented_at·privacy_consent_version을 저장. 연락처는 수집일로부터 90일 후 자동으로 비움(schema.sql 커밋 G).
export const GUEST_PRIVACY_CONSENT_TEXT = "수집 항목: 휴대폰 번호(입력한 연락처) / 목적: 매물 연결 상담 연락 / 보유: 수집일로부터 90일";

export default function GuestPrivacyConsent({
  checked,
  onChange,
  error,
  strongError = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: boolean;
  strongError?: boolean; // 2026-10-07 /buy 전용: 빨간 2px 테두리·연한 빨강 바탕 + 아래 굵은 빨강 안내
}) {
  const strong = Boolean(error && strongError);
  return (
    <>
    <div
      id="guest-privacy-consent"
      className="flex items-start gap-2 rounded-xl"
      style={
        strong
          ? { background: "#FEF2F2", padding: "10px 12px", border: "2px solid #DC2626" }
          : { background: "#F5F6F8", padding: "10px 12px", border: error ? "1.5px solid var(--color-orange)" : "1.5px solid transparent" }
      }
    >
      <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 flex-shrink-0" style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: rem(14), lineHeight: 1.5, color: "#1A1F26" }}>
          <b style={{ color: "#E25100" }}>[필수]</b> 개인정보 수집·이용 동의
          <span className="block" style={{ color: "#6B7480" }}>
            {GUEST_PRIVACY_CONSENT_TEXT}
          </span>
        </span>
      </label>
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="flex-shrink-0 font-bold" style={{ fontSize: rem(14), color: "#9AA3AD", paddingTop: 2 }}>
        보기 ›
      </a>
    </div>
    {strong && (
      <p className="mt-1.5 font-bold" style={{ fontSize: rem(15), color: "#DC2626" }} data-field-error>
        개인정보 수집·이용에 동의해 주세요
      </p>
    )}
    </>
  );
}
