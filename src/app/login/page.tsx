"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendOtp, verifyOtp, isValidKoreanPhone } from "@/lib/auth";
import { fmtLeft } from "@/lib/format";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거

// 기존 회원 전용 경량 로그인 — 전화번호+OTP만 물어보고, 카테고리/지역/채널/약관
// 같은 가입 전용 항목은 다시 안 물어봅니다. signup/page.tsx의 4단계(전화인증)와
// 같은 sendOtp()/verifyOtp()를 그대로 재사용하며, 회원가입 위저드 자체는
// 안전망(잘못 들어온 기존 회원 구제용)으로 그대로 남아있습니다.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [authChecked, setAuthChecked] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  const [codeSent, setCodeSent] = useState(false);
  const [codeLeft, setCodeLeft] = useState(180);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [membership, setMembership] = useState<"idle" | "checking" | "member" | "not_member">("idle");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) setAuthUserId(data.session.user.id);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) setAuthUserId(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 인증 성공(또는 이미 로그인된 세션 발견) 시, 실제 members row가 있는지 확인해서
  // 있으면 바로 이동 — 없으면 화면에 "아직 가입 안 된 번호" 안내만 보여주고
  // 세션은 유지한 채로 둡니다(가입 페이지가 이 세션을 그대로 이어받음).
  useEffect(() => {
    if (!authUserId || !supabase) return;
    setMembership("checking");
    supabase
      .from("members")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle()
      .then(({ data }) => {
        const already = Boolean(data);
        debugLog(`[login] members-check already=${already} authUserId=${authUserId.slice(0, 8)}`);
        setMembership(already ? "member" : "not_member");
        if (already) router.push(returnTo || "/mypage");
      });
  }, [authUserId, returnTo, router]);

  useEffect(() => {
    if (!codeSent || authUserId || codeLeft <= 0) return;
    const t = setInterval(() => setCodeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [codeSent, authUserId, codeLeft]);

  const handleSendOtp = async () => {
    if (!isValidKoreanPhone(phone)) {
      setOtpError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    setOtpError(null);
    setOtpSending(true);
    const result = await sendOtp(phone);
    setOtpSending(false);
    if (!result.ok) {
      setOtpError(result.error);
      return;
    }
    setCodeSent(true);
    setCodeLeft(180);
    setOtpCode("");
  };

  const handleVerifyOtp = async (code: string) => {
    setOtpError(null);
    setOtpVerifying(true);
    const result = await verifyOtp(phone, code);
    setOtpVerifying(false);
    if (!result.ok) {
      setOtpError(result.error);
      setOtpCode("");
      return;
    }
    // authUserId는 위 onAuthStateChange 구독이 세션 발급과 동시에 채워줌
  };

  const onCodeChange = (value: string) => {
    const v = value.replace(/[^0-9]/g, "").slice(0, 6);
    setOtpCode(v);
    if (v.length === 6 && !authUserId && !otpVerifying) {
      handleVerifyOtp(v);
    }
  };

  if (!authChecked) return null;

  const signupHref = `/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <main className="flex flex-col min-h-screen bg-white">
      <div style={{ padding: "20px 22px 14px", borderBottom: "1px solid #EEF0F2" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6B7480", padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <span className="font-display" style={{ fontSize: 17, color: "#0B2540", letterSpacing: "-0.02em" }}>
            휴대폰 번호로 로그인
          </span>
        </div>
      </div>

      <div className="flex-1" style={{ padding: "24px 22px 20px" }}>
        {membership === "not_member" ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "32px 6px 0" }}>
            <div className="rounded-full flex items-center justify-center" style={{ width: 76, height: 76, background: "#FDEEE8", fontSize: 34 }}>
              🔍
            </div>
            <h2 className="font-display mt-4.5" style={{ fontSize: 23, color: "#0B2540", letterSpacing: "-0.02em" }}>
              아직 가입 안 된 번호예요
            </h2>
            <p className="mt-2.5" style={{ fontSize: 14, color: "#6B7480", lineHeight: 1.7 }}>
              이 번호로 등록된 계정이 없어요.
              <br />
              알림 신청부터 시작해주세요.
            </p>
            <Link
              href={signupHref}
              className="w-full text-white font-bold rounded-2xl mt-5 text-center"
              style={{ padding: "17px 0", fontSize: 16.5, background: "linear-gradient(135deg,#E25100,#FF6F0F)", boxShadow: "0 8px 20px rgba(226,81,0,.3)" }}
            >
              알림 신청하러 가기
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="font-display" style={{ fontSize: 23, color: "#0B2540", letterSpacing: "-0.02em" }}>
              번호만 인증하면 바로 들어가요
            </h2>
            <p className="mt-2" style={{ fontSize: 14, color: "#6B7480", lineHeight: 1.6 }}>
              가입할 때 인증했던 휴대폰 번호를 입력해주세요.
            </p>

            <div className="text-sm font-bold mt-5.5 mb-2" style={{ color: "#0B2540" }}>휴대폰 번호</div>
            <div className="flex gap-2">
              <input
                className="flex-1 min-w-0 rounded-xl outline-none"
                style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 15, fontVariantNumeric: "tabular-nums" }}
                placeholder="010-0000-0000"
                inputMode="numeric"
                value={phone}
                disabled={Boolean(authUserId)}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, "").slice(0, 13))}
              />
              <button
                onClick={handleSendOtp}
                disabled={otpSending || Boolean(authUserId) || !isValidKoreanPhone(phone)}
                className="flex-shrink-0 rounded-xl font-bold disabled:opacity-60"
                style={{ border: "1.5px solid #0B2540", background: "#fff", padding: "0 15px", fontSize: 13.5, color: "#0B2540", whiteSpace: "nowrap" }}
              >
                {otpSending ? "발송 중..." : codeSent ? "다시 받기" : "인증번호 받기"}
              </button>
            </div>

            {!codeSent && otpError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{otpError}</p>}

            {codeSent && !authUserId && (
              <div>
                <div className="flex items-center justify-between mt-4.5 mb-2">
                  <span className="text-sm font-bold" style={{ color: "#0B2540" }}>인증번호 6자리</span>
                  <span className="font-mono text-xs font-bold" style={{ color: "#E5484D" }}>{fmtLeft(codeLeft)}</span>
                </div>
                <input
                  className="w-full rounded-xl outline-none text-center font-mono font-bold"
                  style={{ border: "1.5px solid var(--color-brandOrange)", padding: 14, fontSize: 20, letterSpacing: "0.32em" }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => onCodeChange(e.target.value)}
                  autoFocus
                />
                {otpError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{otpError}</p>}
                {!otpError && (
                  <p className="mt-2" style={{ fontSize: 11.5, color: "#6B7480", lineHeight: 1.55 }}>
                    문자가 오지 않으면 스팸함을 확인하거나 &quot;다시 받기&quot;를 눌러주세요.
                  </p>
                )}
              </div>
            )}

            {authUserId && (
              <div className="flex items-center gap-2.5 rounded-2xl mt-4.5" style={{ padding: "14px 16px", background: "#E8F8EC" }}>
                <span style={{ fontSize: 16 }}>✔</span>
                <span className="flex-1 text-xs font-bold" style={{ lineHeight: 1.5, color: "#2F9E44" }}>
                  인증 완료 · 계정 확인 중...
                </span>
              </div>
            )}

            <p className="mt-6 text-center" style={{ fontSize: 12.5, color: "#9AA3AD" }}>
              처음이신가요?{" "}
              <Link href={signupHref} style={{ color: "#0B2540", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>
                알림 신청하기
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
