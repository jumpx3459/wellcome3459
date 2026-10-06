"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 가입(signup)·로그인(login) 인증번호 칸 공통 (2026-10-06)
//   1) 재발송 카운트: 발송 성공 순간 RESEND_SECONDS(서버 1분 제한과 같음)부터 셈 — 0이 되기 전엔 [다시 받기 (N초)] 비활성.
//      서버가 COOLDOWN(retry_after_seconds)으로 막으면 빨간 문구 대신 그 초로 카운트만 맞춤(start(n)).
//   2) WebOTP(안드로이드 크롬): 'OTPCredential' in window일 때만, 발송 성공(sendNonce 증가) 직후 문자에서 인증번호를 받아
//      onCode로 넘김 — 문자 끝줄 "@www.dumpingjumping.com #123456" 형식이어야 브라우저가 줌.
//      미지원·실패·취소는 조용히 무시(수동 입력 그대로). 화면 이탈·인증 완료(active=false)·재발송 시 AbortController로 중단.
export const RESEND_SECONDS = 60;

export function useResendCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const start = useCallback((seconds: number = RESEND_SECONDS) => setLeft(Math.max(0, Math.ceil(seconds))), []);
  return { left, start };
}

type OtpCredential = Credential & { code?: string };

export function useWebOtp(active: boolean, sendNonce: number, onCode: (code: string) => void) {
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!active || sendNonce === 0) return;
    if (typeof window === "undefined" || !("OTPCredential" in window) || !navigator.credentials?.get) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as OtpCredential | null)?.code?.replace(/[^0-9]/g, "");
        if (!ac.signal.aborted && code && code.length === 6) onCodeRef.current(code);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [active, sendNonce]);
}
