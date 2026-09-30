"use client";

import { rem } from "@/lib/rem";

// 2026-09-30: 비회원 입력 폼(매물 상세 "번호만 남기기"·구매 희망 등록)의 [필수] 개인정보 수집·이용 동의.
// 비회원이라 member_consents에는 못 남김 — 서버(/api/quick-interest·/api/buy-requests)가 privacyConsent=true만 받는다.
// 동의 시각 저장 컬럼(consented_at 등)은 supabase/schema.sql 제안 SQL(미실행) 참고.
export const GUEST_PRIVACY_CONSENT_TEXT = "수집 항목: 휴대폰 번호(입력한 연락처) / 목적: 매물 연결 상담 연락 / 보유: 상담 종료 후 30일";

export default function GuestPrivacyConsent({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl"
      style={{ background: "#F5F6F8", padding: "10px 12px", border: error ? "1.5px solid var(--color-orange)" : "1.5px solid transparent" }}
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
  );
}
