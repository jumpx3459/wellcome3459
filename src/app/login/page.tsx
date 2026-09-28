"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendOtp, verifyOtp, isValidKoreanPhone, toE164Phone } from "@/lib/auth";
import { fmtLeft } from "@/lib/format";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { NAV_HEIGHT } from "@/components/BottomNav";

// 2026-09-28 (3): "비밀번호 로그인도 결국 번호를 매번 입력해야 하냐"는 지적 —
// phone+password는 Supabase Auth 구조상 식별자(번호) 없이는 로그인이 불가능해
// 번호 자체를 없앨 수는 없지만, 로그인 성공 시 이 기기에 번호를 기억해뒀다가
// 다음 방문부터 자동으로 채워주면 체감상 "비밀번호만 입력"하는 경험이 된다.
const LAST_PHONE_KEY = "dj_last_phone";

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
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_PHONE_KEY);
      if (saved) setPhone(saved);
    } catch {}
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
    try {
      localStorage.setItem(LAST_PHONE_KEY, phone);
    } catch {}
    // authUserId는 위 onAuthStateChange 구독이 세션 발급과 동시에 채워줌
  };

  const handlePasswordSignIn = async () => {
    setPasswordError(null);
    if (!isValidKoreanPhone(phone)) {
      setPasswordError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    if (!password) {
      setPasswordError("비밀번호를 입력해주세요.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) return;
    setPasswordSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ phone: toE164Phone(phone), password });
    setPasswordSigningIn(false);
    if (error) {
      setPasswordError("번호 또는 비밀번호가 올바르지 않아요.");
      return;
    }
    try {
      localStorage.setItem(LAST_PHONE_KEY, phone);
    } catch {}
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
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "rgba(255,255,255,0.8)", padding: 0, lineHeight: 1 }}
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
                번호만 인증하면
                <br />
                바로 들어가요
              </>
            )}
          </h1>
          {membership !== "not_member" && (
            <p className="mt-2" style={{ fontSize: 13.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
              가입할 때 인증했던 휴대폰 번호를 입력해주세요.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col" style={{ padding: "24px 22px 20px" }}>
        {membership === "not_member" ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "12px 6px 0" }}>
            <div className="rounded-full flex items-center justify-center" style={{ width: 76, height: 76, background: "#FDEEE8", fontSize: 34 }}>
              🔍
            </div>
            <p className="mt-4.5" style={{ fontSize: 14, color: "#6B7480", lineHeight: 1.7 }}>
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
                    fontSize: 13.5,
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
                    fontSize: 13.5,
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
                <div className="text-sm font-bold mt-4.5 mb-2" style={{ color: "#0B2540" }}>휴대폰 번호</div>
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
                    style={{
                      border: "none",
                      background: "linear-gradient(135deg,#E25100,#FF6F0F)",
                      padding: "0 15px",
                      fontSize: 13.5,
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
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
              </>
            )}

            {authMode === "password" && !authUserId && (
              <>
                <div className="text-sm font-bold mt-4.5 mb-2" style={{ color: "#0B2540" }}>휴대폰 번호</div>
                <input
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 15, fontVariantNumeric: "tabular-nums" }}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, "").slice(0, 13))}
                />
                <div className="text-sm font-bold mt-3.5 mb-2" style={{ color: "#0B2540" }}>비밀번호</div>
                <input
                  type="password"
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 15 }}
                  placeholder="마이페이지에서 설정한 비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordSignIn()}
                />
                {passwordError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{passwordError}</p>}
                <button
                  onClick={handlePasswordSignIn}
                  disabled={passwordSigningIn}
                  className="w-full text-white font-bold rounded-2xl mt-4.5 text-center disabled:opacity-60"
                  style={{ padding: "15px 0", fontSize: 15.5, background: "linear-gradient(135deg,#E25100,#FF6F0F)" }}
                >
                  {passwordSigningIn ? "로그인 중..." : "로그인"}
                </button>
                <p className="mt-2.5" style={{ fontSize: 11.5, color: "#9AA3AD" }}>
                  비밀번호를 아직 안 만드셨거나 잊으셨다면 &quot;인증번호로 로그인&quot;을 이용해주세요.
                </p>
              </>
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
            style={{ minHeight: 24, paddingTop: 20, paddingBottom: NAV_HEIGHT }}
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
