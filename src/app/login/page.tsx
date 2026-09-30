"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendOtp, verifyOtp, isValidKoreanPhone, toE164Phone, formatPhoneTyping } from "@/lib/auth";
import { fmtLeft } from "@/lib/format";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { NAV_BOTTOM } from "@/components/BottomNav";
import { rem } from "@/lib/rem";
import { authFetch } from "@/lib/authFetch";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 2026-09-28 (3): "비밀번호 로그인도 결국 번호를 매번 입력해야 하냐"는 지적 —
// phone+password는 Supabase Auth 구조상 식별자(번호) 없이는 로그인이 불가능해
// 번호 자체를 없앨 수는 없지만, 로그인 성공 시 이 기기에 번호를 기억해뒀다가
// 다음 방문부터 자동으로 채워주면 체감상 "비밀번호만 입력"하는 경험이 된다.
const LAST_PHONE_KEY = "dj_last_phone";
// 2026-09-29: 이 기기에서 마지막으로 성공한 로그인 방식 — 다음 방문 때 그 탭을 기본으로
const LOGIN_METHOD_KEY = "dj_login_method";
// 인증번호 로그인 뒤 "비밀번호를 만들어 두세요" 시트를 [나중에]로 닫았는지
const PW_PROMPT_DISMISSED_KEY = "dj_pw_prompt_dismissed";
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

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

  // 2026-09-27: 재접속마다(특히 PWA 재설치 후, 세션이 통째로 날아가는 경우) SMS
  // OTP를 매번 받아야 하는 게 번거롭다는 피드백 — 마이페이지에서 비밀번호를
  // 미리 설정해둔 회원은 SMS 없이 바로 로그인할 수 있는 탭을 추가. 비밀번호를
  // 잊으면 그냥 "인증번호로 로그인" 탭으로 돌아가면 되므로 별도 찾기 플로우 불필요.
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
  // 세션 이벤트(onAuthStateChange)가 verifyOtp 응답보다 먼저 올 수 있어서, 요청 "전에" ref에 기록해 둔다
  const loggedInVia = useRef<"otp" | "password" | null>(null);
  // 2026-10-01: 비밀번호 관리자·자동완성이 입력 이벤트 없이 칸에 값만 채우면 phone state가 비어 있어
  // "휴대폰 번호를 정확히 입력해주세요"가 떴음(칸에는 010-3441-3459가 보이는데) → 누르는 순간 칸의 실제 값을 다시 읽음
  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null); // 비밀번호 관리자가 번호·비밀번호를 같이 채우는 경우 대비
  const readPhone = () => {
    const typed = formatPhoneTyping(phoneRef.current?.value || phone);
    if (typed !== phone) setPhone(typed);
    return typed;
  };
  const [showPwPrompt, setShowPwPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordSigningIn, setPasswordSigningIn] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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

  // 2026-09-28 (3): 이전에 로그인 성공했던 번호를 자동으로 채워줌 — 사용자가
  // 이미 입력을 시작했으면(phone 값 존재) 덮어쓰지 않도록 마운트 시 1회만.
  // 2026-09-28 (4): 공용 PC/타인 기기에서 로그인하면 번호가 그 기기에 남는다는
  // 지적 — 로그아웃 기능 자체가 회원 화면엔 아직 없어(관리자 화면에만 있음)
  // "로그아웃 시 삭제"는 걸 데가 없어서, 대신 자동으로 채워진 번호 옆에 수동으로
  // 지울 수 있는 링크를 노출. rememberedPhone은 "이 번호가 로컬에 저장된
  // 값에서 왔다"는 표시로만 씀 — 지우기 링크 노출 여부 판단용.
  const [rememberedPhone, setRememberedPhone] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_PHONE_KEY);
      if (saved) {
        setPhone(formatPhoneTyping(saved));
        setRememberedPhone(true);
      }
      if (localStorage.getItem(LOGIN_METHOD_KEY) === "password") setAuthMode("password");
    } catch {}
  }, []);

  const forgetSavedPhone = () => {
    try {
      localStorage.removeItem(LAST_PHONE_KEY);
    } catch {}
    setPhone("");
    setRememberedPhone(false);
  };

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
        if (!already) return;
        // 인증번호로 방금 로그인했고 비밀번호가 없으면 권유 시트 1회 — 보유 여부는 서버(app_metadata)에서 확인
        if (loggedInVia.current === "otp" && lsGet(PW_PROMPT_DISMISSED_KEY) !== "1") {
          authFetch("/api/auth/password-status")
            .then((r) => (r.ok ? r.json() : { hasPassword: true })) // 확인 실패 시엔 안 띄우고 그냥 이동
            .then((d: { hasPassword?: boolean }) => {
              if (d.hasPassword) router.push(returnTo || "/mypage");
              else setShowPwPrompt(true);
            })
            .catch(() => router.push(returnTo || "/mypage"));
          return;
        }
        router.push(returnTo || "/mypage");
      });
  }, [authUserId, returnTo, router]);

  useEffect(() => {
    if (!codeSent || authUserId || codeLeft <= 0) return;
    const t = setInterval(() => setCodeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [codeSent, authUserId, codeLeft]);

  const handleSendOtp = async () => {
    const typed = readPhone();
    if (!isValidKoreanPhone(typed)) {
      setOtpError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    setOtpError(null);
    setOtpSending(true);
    const result = await sendOtp(typed);
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
    loggedInVia.current = "otp";
    const result = await verifyOtp(phone, code);
    setOtpVerifying(false);
    if (!result.ok) {
      setOtpError(result.error);
      setOtpCode("");
      return;
    }
    try {
      localStorage.setItem(LAST_PHONE_KEY, phone.replace(/[^0-9]/g, "")); // 저장은 숫자만, 표시는 010-1234-5678
    } catch {}
    lsSet(LOGIN_METHOD_KEY, "otp");
    // authUserId는 위 onAuthStateChange 구독이 세션 발급과 동시에 채워줌
  };

  const handlePasswordSignIn = async () => {
    setPasswordError(null);
    const typed = readPhone();
    if (!isValidKoreanPhone(typed)) {
      setPasswordError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    const typedPassword = passwordRef.current?.value || password;
    if (typedPassword !== password) setPassword(typedPassword);
    if (!typedPassword) {
      setPasswordError("비밀번호를 입력해주세요.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) return;
    setPasswordSigningIn(true);
    loggedInVia.current = "password";
    const { error } = await supabase.auth.signInWithPassword({ phone: toE164Phone(typed), password: typedPassword });
    setPasswordSigningIn(false);
    if (error) {
      // 번호별로 "비밀번호 없음"을 구분해 알려주면 아무 번호나 넣어 회원 여부를 알아낼 수 있어서 한 문구로
      setPasswordError("번호 또는 비밀번호가 맞지 않아요. 비밀번호를 아직 안 만드셨다면 인증번호로 로그인해주세요");
      return;
    }
    try {
      localStorage.setItem(LAST_PHONE_KEY, typed.replace(/[^0-9]/g, "")); // 저장은 숫자만, 표시는 010-1234-5678
    } catch {}
    lsSet(LOGIN_METHOD_KEY, "password");
    // 이전에 만든 비밀번호엔 표시가 없어서, 비밀번호로 들어오면 서버(app_metadata)에 표시 (권유 시트가 다시 안 뜨게)
    authFetch("/api/auth/mark-password").catch(() => {});
    // authUserId는 위 onAuthStateChange 구독이 세션 발급과 동시에 채워줌 (OTP 흐름과 동일)
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
      {/* 2026-09-28: buy/sell/signup은 전부 네이비 도트 텍스처 그라디언트 헤더 +
          로고뱃지로 통일했는데 /login만 흰 배경+회색 화살표의 예전 스타일이 남아
          있었음(피드백) — 동일한 헤더 구조로 교체. */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        <div style={{ padding: "20px 22px 22px" }}>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push("/")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: rem(20), color: "rgba(255,255,255,0.8)", padding: 0, lineHeight: 1 }}
            >
              ←
            </button>
            <Link href="/" className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
              <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto" />
            </Link>
          </div>
          {/* 2026-09-28: 다른 헤더(buy/sell/signup/홈)와 통일감을 맞추기 위해 브랜드
              표기(Powered by JumpX)를 추가. 로테이션 긴급성 문구는 비회원 전환
              유도용이라, 이미 가입한 회원이 재접속하는 로그인 화면과는 맞지 않아
              의도적으로 넣지 않음. */}
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Powered by JumpX</div>
          <div className="text-xs font-bold tracking-widest mt-2.5" style={{ color: "#FFD166" }}>로그인</div>
          <h1 className="font-display text-2xl mt-1.5 text-white">
            {membership === "not_member" ? (
              "아직 가입 안 된 번호예요"
            ) : (
              <>
                번호만 인증하면{" "}
                <br className="hidden sm:inline" />
                바로 들어가요
              </>
            )}
          </h1>
          {membership !== "not_member" && (
            <p className="mt-2" style={{ fontSize: rem(13.5), color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
              가입할 때 인증했던 휴대폰 번호를 입력해주세요.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col" style={{ padding: "24px 22px 20px" }}>
        {membership === "not_member" ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "12px 6px 0" }}>
            <div className="rounded-full flex items-center justify-center" style={{ width: 76, height: 76, background: "#FDEEE8", fontSize: rem(34) }}>
              🔍
            </div>
            <p className="mt-4.5" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.7 }}>
              이 번호로 등록된 계정이 없어요.
              <br />
              알림 신청부터 시작해주세요.
            </p>
            <Link
              href={signupHref}
              className={`w-full mt-5 ${BTN_CLASS}`}
              style={btnStyle("primary")}
            >
              알림 신청하러 가기
            </Link>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
          <div>
            {/* 2026-09-27: 비밀번호를 설정해둔 회원은 SMS 없이 바로 로그인할 수
                있도록 탭 추가. 비밀번호를 잊으면 그냥 "인증번호로 로그인" 탭으로
                돌아가면 되므로 별도 비밀번호 찾기 플로우는 만들지 않음. */}
            {!authUserId && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAuthMode("otp")}
                  className="flex-1 text-center font-bold rounded-xl"
                  style={{
                    padding: "9px 0",
                    fontSize: rem(13.5),
                    background: authMode === "otp" ? "linear-gradient(135deg,#E25100,#FF6F0F)" : "#F5F6F8",
                    color: authMode === "otp" ? "#fff" : "#6B7480",
                  }}
                >
                  인증번호로 로그인
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("password")}
                  className="flex-1 text-center font-bold rounded-xl"
                  style={{
                    padding: "9px 0",
                    fontSize: rem(13.5),
                    background: authMode === "password" ? "linear-gradient(135deg,#E25100,#FF6F0F)" : "#F5F6F8",
                    color: authMode === "password" ? "#fff" : "#6B7480",
                  }}
                >
                  비밀번호로 로그인
                </button>
              </div>
            )}

            {authMode === "otp" && (
              <>
                <div className="flex items-center justify-between mt-4.5 mb-2">
                  <span className="text-sm font-bold" style={{ color: "#0B2540" }}>휴대폰 번호</span>
                  {rememberedPhone && !authUserId && (
                    <button type="button" onClick={forgetSavedPhone} className="text-xs font-bold underline" style={{ color: "#9AA3AD" }}>
                      다른 번호세요? 지우기
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    ref={phoneRef}
                    type="tel"
                    name="username"
                    autoComplete="username"
                    className="flex-1 min-w-0 rounded-xl outline-none"
                    style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: rem(15), fontVariantNumeric: "tabular-nums" }}
                    placeholder="010-0000-0000"
                    inputMode="numeric"
                    value={phone}
                    disabled={Boolean(authUserId)}
                    onChange={(e) => setPhone(formatPhoneTyping(e.target.value))}
                  />
                  <button
                    onClick={handleSendOtp}
                    disabled={otpSending || Boolean(authUserId)}
                    className="flex-shrink-0 rounded-xl font-bold disabled:opacity-60"
                    style={{
                      opacity: isValidKoreanPhone(phone) ? undefined : 0.6,
                      border: "none",
                      background: "linear-gradient(135deg,#E25100,#FF6F0F)",
                      padding: "0 15px",
                      fontSize: rem(13.5),
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {otpSending ? "발송 중..." : codeSent ? "다시 받기" : "인증번호 받기"}
                  </button>
                </div>

                {!codeSent && otpError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{otpError}</p>}
                {!authUserId && (
                  <p className="mt-2.5" style={{ fontSize: rem(14), color: "#4B5563", lineHeight: 1.55 }}>
                    💡 비밀번호를 설정해 두면 문자 없이 바로 로그인돼요 (마이페이지 → 비밀번호 설정)
                  </p>
                )}

                {codeSent && !authUserId && (
                  <div>
                    <div className="flex items-center justify-between mt-4.5 mb-2">
                      <span className="text-sm font-bold" style={{ color: "#0B2540" }}>인증번호 6자리</span>
                      <span className="font-mono text-xs font-bold" style={{ color: "#E5484D" }}>{fmtLeft(codeLeft)}</span>
                    </div>
                    <input
                      className="w-full rounded-xl outline-none text-center font-mono font-bold"
                      style={{ border: "1.5px solid var(--color-brandOrange)", padding: 14, fontSize: rem(20), letterSpacing: "0.32em" }}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => onCodeChange(e.target.value)}
                      autoFocus
                    />
                    {otpError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{otpError}</p>}
                    {!otpError && (
                      <p className="mt-2" style={{ fontSize: rem(11.5), color: "#6B7480", lineHeight: 1.55 }}>
                        문자가 오지 않으면 스팸함을 확인하거나 &quot;다시 받기&quot;를 눌러주세요.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {authMode === "password" && !authUserId && (
              <>
                <div className="flex items-center justify-between mt-4.5 mb-2">
                  <span className="text-sm font-bold" style={{ color: "#0B2540" }}>휴대폰 번호</span>
                  {rememberedPhone && (
                    <button type="button" onClick={forgetSavedPhone} className="text-xs font-bold underline" style={{ color: "#9AA3AD" }}>
                      다른 번호세요? 지우기
                    </button>
                  )}
                </div>
                <input
                  ref={phoneRef}
                  type="tel"
                  name="username"
                  autoComplete="username"
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: rem(15), fontVariantNumeric: "tabular-nums" }}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneTyping(e.target.value))}
                />
                <div className="text-sm font-bold mt-3.5 mb-2" style={{ color: "#0B2540" }}>비밀번호</div>
                <input
                  ref={passwordRef}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  onFocus={() => readPhone()} // 번호만 자동완성된 뒤 비밀번호를 치면 다시 그려질 때 번호 칸이 비지 않게 먼저 반영
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: rem(15) }}
                  placeholder="마이페이지에서 설정한 비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordSignIn()}
                />
                {passwordError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{passwordError}</p>}
                <button
                  onClick={handlePasswordSignIn}
                  disabled={passwordSigningIn}
                  className={`w-full mt-4.5 ${BTN_CLASS}`}
                  style={btnStyle("primary")}
                >
                  {passwordSigningIn ? "로그인 중..." : "로그인"}
                </button>
                <p className="mt-2.5" style={{ fontSize: rem(14), color: "#4B5563", lineHeight: 1.55 }}>
                  비밀번호를 아직 안 만드셨나요? 인증번호로 로그인한 뒤 마이페이지에서 만들 수 있어요
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordError(null);
                    setAuthMode("otp"); // 입력한 번호(phone)는 두 탭이 같은 state라 그대로 유지
                  }}
                  className="mt-1.5 font-bold underline underline-offset-4"
                  style={{ fontSize: rem(14), color: "#0B2540", minHeight: 44 }}
                >
                  인증번호로 로그인
                </button>
              </>
            )}

            {authUserId && (
              <div className="flex items-center gap-2.5 rounded-2xl mt-4.5" style={{ padding: "14px 16px", background: "#E8F8EC" }}>
                <span style={{ fontSize: rem(16) }}>✔</span>
                <span className="flex-1 text-xs font-bold" style={{ lineHeight: 1.5, color: "#2F9E44" }}>
                  인증 완료 · 계정 확인 중...
                </span>
              </div>
            )}

            {showPwPrompt && (
              <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true" aria-label="비밀번호 설정 권유">
                <div className="w-full max-w-md bg-white rounded-t-3xl text-center" style={{ padding: "26px 20px calc(20px + var(--sab))" }}>
                  <div aria-hidden style={{ fontSize: rem(36), lineHeight: 1 }}>🔑</div>
                  <p className="font-black mt-3" style={{ fontSize: rem(19), color: "#0B2540" }}>
                    다음부터 문자 없이 로그인하려면 비밀번호를 만들어 두세요
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/mypage#password")}
                    className={`w-full mt-5 ${BTN_CLASS}`}
                    style={btnStyle("primary")}
                  >
                    지금 만들기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      lsSet(PW_PROMPT_DISMISSED_KEY, "1");
                      router.push(returnTo || "/mypage");
                    }}
                    className="mt-3 w-full"
                    style={{ minHeight: 44, fontSize: rem(15), color: "#6B7480" }}
                  >
                    나중에
                  </button>
                </div>
              </div>
            )}

            <p className="mt-6 text-center" style={{ fontSize: rem(12.5), color: "#9AA3AD" }}>
              처음이신가요?{" "}
              <Link href={signupHref} style={{ color: "#0B2540", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>
                알림 신청하기
              </Link>
            </p>
          </div>

          {/* 2026-09-28: 폼 아래 남는 여백이 휑하다는 피드백 — 매니저 캐릭터로 채움.
              2026-09-28 (2): main이 min-h-screen(정확히 1화면) + items-end라
              캐릭터가 뷰포트 맨 아래(100vh 지점)에 딱 붙는데, 그 지점이 바로
              하단 고정 네비바(BottomNav, fixed, NAV_HEIGHT=64px)가 덮는 자리라
              발이 잘려 보였음. AppShell의 paddingBottom:NAV_HEIGHT는 본문이
              1화면보다 길어서 스크롤될 때만 효과가 있고, 정확히 1화면을 채우는
              이 레이아웃(flex-end)에는 적용이 안 됨 — 이 블록에 직접 네비바
              높이만큼 paddingBottom을 줘서 그 위에서 끝나도록 고정. 요청대로
              사이즈도 키움. */}
          <div
            className="flex-1 flex items-end justify-center"
            style={{ minHeight: 24, paddingTop: 20, paddingBottom: NAV_BOTTOM }}
          >
            <img
              src="/images/manager-cut.png"
              alt="점핑매니저"
              style={{ height: "clamp(110px, 24vh, 190px)", width: "auto", objectFit: "contain" }}
            />
          </div>
          </div>
        )}
      </div>
    </main>
  );
}
