"use client";

import { rem } from "@/lib/rem";
import { CONTACT_MOBILE_ERROR } from "@/lib/auth";

// 매물 등록(sell)·구매 희망(buy) 연락처 칸 공용 (2026-09-29).
// 로그인 회원은 가입 번호가 자동으로 들어가지만 언제든 고치거나 지울 수 있어야 함 —
// 사무실 번호(02-, 031- 등, 대표번호 15xx)도 허용, 휴대폰은 010 + 8자리만 (검증: checkContactPhone, 2026-10-06).
export default function ContactPhoneInput({
  value,
  onChange,
  autofilledValue,
  error,
  strongError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  autofilledValue?: string | null; // 자동으로 채운 값 — 그대로일 때만 안내 문구 표시
  error?: string | null;
  strongError?: boolean; // 2026-10-07 /buy 전용: 빨간 2px 테두리·연한 빨강 바탕·굵은 빨강 안내(테스터가 오류를 못 알아봄). 안 넘기면 기존 주황 표시
}) {
  const showAutofillNote = Boolean(autofilledValue) && value === autofilledValue;
  return (
    <div>
      <div
        className="flex items-center rounded-xl"
        style={
          error && strongError
            ? { border: "2px solid #DC2626", background: "#FEF2F2" }
            : { border: error ? "1.5px solid var(--color-orange)" : "1.5px solid #E4E7EB" }
        }
      >
        <input
          id="contact-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="flex-1 min-w-0 outline-none bg-transparent"
          style={{ border: "none", padding: 14, fontSize: rem(17) }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="010-0000-0000"
        />
        {value && (
          <button
            type="button"
            aria-label="연락처 지우기"
            onClick={() => {
              onChange("");
              document.getElementById("contact-phone")?.focus();
            }}
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 44, height: 44, fontSize: rem(20), color: "#6B7480" }}
          >
            ×
          </button>
        )}
      </div>
      {error ? (
        <p
          className={strongError ? "mt-1.5 font-bold" : "mt-1.5 font-medium"}
          style={{ fontSize: rem(15), color: strongError ? "#DC2626" : "var(--color-orange)" }}
          data-field-error
        >
          {error}
          {/* 예시 번호는 하이픈에서 줄이 끊기지 않게 덩어리로 */}
          <span className="block font-normal" style={{ color: "#4B5563" }}>
            예: <span className="whitespace-nowrap">010-1234-5678</span>
            {error !== CONTACT_MOBILE_ERROR && (
              <>
                , <span className="whitespace-nowrap">02-123-4567</span>
              </>
            )}
          </span>
        </p>
      ) : showAutofillNote ? (
        <p className="mt-1.5" style={{ fontSize: rem(15), color: "#4B5563" }}>
          가입한 번호가 들어가 있어요. 다른 번호로 바꿔도 돼요
        </p>
      ) : null}
    </div>
  );
}
