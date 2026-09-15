"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendOtp, verifyOtp } from "@/lib/auth";
import { mockCategories, mockRegions, categoryIcons } from "@/lib/mockData";
import { subscribeToPush } from "@/lib/pushClient";
import { generateRefCode } from "@/lib/refCode";
import ScrollHint from "@/components/ScrollHint";
import InstallAppButton from "@/components/InstallAppButton";

// "01012345678" -> "010****5678" 형태로 화면에만 일부 가려서 보여줍니다
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_xbwDJX/friend";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const refCode = searchParams.get("ref"); // 추천인의 member id (점핑파트너 트래킹용)

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [phone, setPhone] = useState("");

  // 휴대폰 SMS 인증 2단계 상태 — 카카오 로그인 대신 schema.sql 설계 원안대로
  // Supabase Auth phone OTP를 직접 씁니다(src/lib/auth.ts 참고).
  const [otpStep, setOtpStep] = useState<"phone" | "code">("phone");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>(["농수축산물", "냉동냉장식품"]);
  const [regions, setRegions] = useState<string[]>(["서울"]);
  const [isBusiness, setIsBusiness] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [addKakaoChannel, setAddKakaoChannel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "granted" | "denied" | "unsupported">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [showSelectionPrompt, setShowSelectionPrompt] = useState(false);
  const [highlight, setHighlight] = useState<"categories" | "regions" | null>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const regionsRef = useRef<HTMLDivElement>(null);

  const applySession = (user: { id: string; phone?: string | null } | null | undefined) => {
    if (user && !user.phone) {
      // 카카오 로그인 시절 만들어진, 전화번호가 없는 낡은 세션 — 로그아웃시켜
      // 정상적인 문자 인증 흐름으로 다시 시작하게 합니다.
      supabase?.auth.signOut();
      return;
    }
    setAuthUserId(user?.id ?? null);
    if (user?.phone) {
      setPhone(`0${user.phone.replace(/^\+?82/, "")}`);
      try {
        localStorage.setItem("dj_signup_pending", "1");
      } catch {}
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session?.user);
      setAuthChecked(true);
    });
    // 인증번호 확인(verifyOtp)이 성공하면 Supabase가 세션을 발급하고, 이 구독이
    // 자동으로 authUserId를 채워줍니다 — handleVerifyOtp에서 따로 세팅할 필요 없음.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUserId || !supabase) return;
    supabase
      .from("members")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle()
      .then(({ data }) => {
        const already = Boolean(data);
        setAlreadyMember(already);
        if (already) {
          try {
            localStorage.removeItem("dj_signup_pending");
          } catch {}
        }
      });
  }, [authUserId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      try {
        if (localStorage.getItem("dj_signup_pending") === "1") {
          e.preventDefault();
          e.returnValue = "";
        }
      } catch {}
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const selectAllAndClose = () => {
    if (categories.length === 0) setCategories([...mockCategories]);
    if (regions.length === 0) setRegions([...mockRegions]);
    setShowSelectionPrompt(false);
  };

  const goPickManually = () => {
    setShowSelectionPrompt(false);
    const missing = categories.length === 0 ? "categories" : "regions";
    const ref = missing === "categories" ? categoriesRef : regionsRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlight(missing);
    setTimeout(() => setHighlight(null), 1500);
  };

  const handleSendOtp = async () => {
    setOtpError(null);
    setOtpSending(true);
    const result = await sendOtp(phone);
    setOtpSending(false);
    if (!result.ok) {
      setOtpError(result.error);
      return;
    }
    setOtpStep("code");
  };

  const handleVerifyOtp = async () => {
    setOtpError(null);
    setOtpVerifying(true);
    const result = await verifyOtp(phone, otpCode);
    setOtpVerifying(false);
    if (!result.ok) {
      setOtpError(result.error);
      return;
    }
    // authUserId는 위 onAuthStateChange 구독이 세션 발급과 동시에 자동으로 채워줍니다.
  };

  const submit = async () => {
    setError(null);
    if (!authUserId) {
      setError("휴대폰 인증을 먼저 진행해주세요.");
      return;
    }
    if (!/^01[0-9]{8,9}$/.test(phone.replace(/-/g, ""))) {
      setError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    if (!agreed) {
      setError("기기 알림 수신 동의는 필수예요.");
      return;
    }
    if (categories.length === 0) {
      setShowSelectionPrompt(true);
      return;
    }

    // 팝업 차단 회피 — 사용자 클릭과 같은 동기 호출 스택에서 빈 창을 먼저 열어두고,
    // upsert 성공 후에 카카오 채널 URL로 이동시킵니다(비동기 호출 이후에 열면 팝업이 막힘).
    const kakaoWindow = addKakaoChannel ? window.open("", "_blank") : null;

    setSubmitting(true);

    // 알라미와 동일하게, 카카오톡 같은 중간 채널 없이 기기에 직접 알림을
    // 띄우기 위해 브라우저 알림 권한 + 푸시 구독을 먼저 받습니다.
    const pushResult = await subscribeToPush();
    if (pushResult.status === "denied") setPushStatus("denied");
    else if (pushResult.status === "unsupported") setPushStatus("unsupported");
    else setPushStatus("granted");

    if (!isSupabaseConfigured || !supabase) {
      // 데모 모드: 실제 저장 없이 다음 화면으로 이동
      if (kakaoWindow) {
        kakaoWindow.close();
      }
      await new Promise((r) => setTimeout(r, 500));
      setSubmitting(false);
      router.push(returnTo || "/deals");
      return;
    }

    try {
      const userId = authUserId;

      // 추천 링크(?ref=짧은코드)로 들어왔으면 코드를 추천인의 실제 회원 id로 변환
      let referredById: string | null = null;
      if (refCode) {
        try {
          const res = await fetch("/api/resolve-ref", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: refCode }),
          });
          const resolved = await res.json();
          if (resolved.id && resolved.id !== userId) referredById = resolved.id;
        } catch {
          // 추천인 코드 조회 실패 — 트래킹 없이 가입은 그대로 진행
        }
      }

      // 이미 내 코드가 있으면 재사용, 없으면 새로 발급 (회원가입 재시도 시 코드가 바뀌지 않도록)
      const { data: existingMember } = await supabase
        .from("members")
        .select("ref_code")
        .eq("id", userId)
        .maybeSingle();

      const { error: memberError } = await supabase.from("members").upsert({
        id: userId,
        phone,
        is_business: isBusiness,
        company_name: companyName ? companyName : null,
        ref_code: existingMember?.ref_code ?? generateRefCode(),
        ...(referredById ? { referred_by: referredById } : {}),
      });
      if (memberError) {
        if (kakaoWindow) {
          kakaoWindow.close();
        }
        setError(
          memberError.code === "23505"
            ? "이미 사용 중인 휴대폰 번호예요. 다른 번호로 시도하거나 고객센터로 문의해주세요."
            : "가입 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."
        );
        setSubmitting(false);
        return;
      }

      if (kakaoWindow) {
        kakaoWindow.location.href = KAKAO_CHANNEL_URL;
      }

      const { data: catRows } = await supabase
        .from("categories")
        .select("id, name")
        .in("name", categories);
      const { data: regRows } = await supabase
        .from("regions")
        .select("id, name")
        .in("name", regions);

      if (catRows?.length) {
        await supabase.from("member_categories").upsert(
          catRows.map((c) => ({ member_id: userId, category_id: c.id }))
        );
      }
      if (regRows?.length) {
        await supabase.from("member_regions").upsert(
          regRows.map((r) => ({ member_id: userId, region_id: r.id }))
        );
      }

      if (pushResult.status === "subscribed" && pushResult.subscription.endpoint) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: userId, subscription: pushResult.subscription }),
        });
      }

      try {
        localStorage.removeItem("dj_signup_pending");
      } catch {}

      router.push(returnTo || "/deals");
    } catch {
      if (kakaoWindow) {
        kakaoWindow.close();
      }
      setError("가입 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyMember) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="font-display text-xl text-navy mb-2">이미 가입된 번호예요</h1>
        <p className="text-gray500 text-base leading-relaxed mb-6">
          카테고리·지역 알림 설정은 마이페이지에서 바꿀 수 있어요.
        </p>
        <Link
          href={returnTo || "/mypage"}
          className="text-white text-center font-bold rounded-2xl text-base px-8"
          style={{ background: "linear-gradient(135deg, #D9531E, #F2891F)", padding: "14px 32px" }}
        >
          {returnTo ? "매물 보러 가기" : "마이페이지로 이동"}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-8 pb-6 text-white"
        style={{ background: "linear-gradient(135deg, #0B2540, #1B3A5C)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Link href="/" className="bg-white rounded-lg px-3.5 py-2.5 inline-block">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
          </Link>
          <span className="text-white/70 text-sm tracking-wide">Powered by JumpX</span>
        </div>
        <div className="text-sm font-bold tracking-widest" style={{ color: "#FFD166" }}>
          문자 인증 한 번이면 끝나요
        </div>
        <h1 className="font-display text-2xl mt-2 leading-snug">
          알림 받을 카테고리와
          <br />
          지역만 골라주세요
        </h1>
        <ScrollHint />
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-6" style={{ paddingBottom: "108px" }}>
        <InstallAppButton />

        <div
          className="rounded-2xl p-5"
          style={{ background: "linear-gradient(135deg, #FFF7DE, #FFFFFF)", border: "2px solid #FFE49C" }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-base font-bold text-navy">휴대폰 인증</span>
            <span className="text-xs font-bold text-orange bg-white px-2 py-0.5 rounded-full">
              문자 인증번호
            </span>
          </div>

          {!authChecked ? (
            <div className="text-sm text-gray500 py-3">확인 중...</div>
          ) : !authUserId ? (
            otpStep === "phone" ? (
              <>
                <input
                  className="w-full border-2 border-gray200 rounded-xl px-4 text-lg outline-none focus:border-orange"
                  style={{ height: "56px" }}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-gray500 mt-1.5">
                  점핑매니저 연락 및 알림 계정 확인용으로만 사용해요.
                </p>
                {otpError && <p className="text-sm text-orange font-medium mt-2">{otpError}</p>}
                <button
                  onClick={handleSendOtp}
                  disabled={otpSending || phone.length < 9}
                  className="w-full mt-3 flex items-center justify-center gap-2 rounded-2xl font-bold disabled:opacity-60"
                  style={{ background: "#F2891F", color: "#fff", height: "56px", fontSize: "17px" }}
                >
                  {otpSending ? "발송 중..." : "📱 인증번호 받기"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray500 mb-2">
                  {maskPhone(phone)}(으)로 보낸 인증번호를 입력하세요
                </p>
                <input
                  className="w-full border-2 border-gray200 rounded-xl px-4 text-2xl font-mono font-semibold tracking-[0.3em] text-center outline-none focus:border-orange"
                  style={{ height: "56px" }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                  autoFocus
                />
                {otpError && <p className="text-sm text-orange font-medium mt-2">{otpError}</p>}
                <button
                  onClick={handleVerifyOtp}
                  disabled={otpVerifying || otpCode.length < 4}
                  className="w-full mt-3 rounded-2xl font-bold disabled:opacity-60"
                  style={{ background: "#F2891F", color: "#fff", height: "56px", fontSize: "17px" }}
                >
                  {otpVerifying ? "확인 중..." : "인증 확인"}
                </button>
                <div className="flex items-center justify-center gap-3 mt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep("phone");
                      setOtpCode("");
                      setOtpError(null);
                    }}
                    className="text-xs font-bold text-gray500"
                  >
                    번호 다시 입력
                  </button>
                  <span className="text-gray200">|</span>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpSending}
                    className="text-xs font-bold text-gray500 disabled:opacity-60"
                  >
                    인증번호 재전송
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <div
                className="flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 mb-3"
                style={{ height: "44px", background: "#E8F8EC", color: "#1D8A44" }}
              >
                ✓ 휴대폰 인증 완료 ({maskPhone(phone)})
              </div>

              <div className="mt-4">
                <label className="text-sm font-bold text-navy mb-2 block">업체명 (선택)</label>
                <input
                  className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                  style={{ height: "52px" }}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 웰컴코리아(주)"
                />
                <p className="text-xs text-gray500 mt-1.5">
                  입력하시면 점핑매니저가 더 빠르게 도와드려요
                </p>
              </div>
            </>
          )}
        </div>

        <div
          ref={categoriesRef}
          style={{
            boxShadow: highlight === "categories" ? "0 0 0 3px rgba(242,137,31,0.5)" : "none",
            borderRadius: "16px",
            transition: "box-shadow 0.3s",
          }}
        >
          <label className="mb-2 flex items-center justify-between">
            <span className="text-base font-bold text-navy">관심 카테고리</span>
            <button
              type="button"
              onClick={() =>
                setCategories(categories.length === mockCategories.length ? [] : [...mockCategories])
              }
              className="text-xs font-bold text-orange"
            >
              {categories.length === mockCategories.length ? "전체 해제" : "전체 선택"}
            </button>
          </label>
          {/* 홈 화면 컬러톤 정리와 통일: 카테고리별 파스텔 대신, 선택 여부만
              브랜드 오렌지 단색으로 표현 (미선택 = 중성 회색, 선택 = 오렌지) */}
          <div className="grid grid-cols-3 gap-2">
            {mockCategories.map((c) => {
              const picked = categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggle(categories, setCategories, c)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border py-3.5 px-1 text-center"
                  style={
                    picked
                      ? { background: "#F2891F", borderColor: "#F2891F", color: "#fff" }
                      : { background: "#F5F6F8", borderColor: "#F5F6F8", color: "#1B3A5C" }
                  }
                >
                  <span className="text-2xl leading-none">{categoryIcons[c]}</span>
                  <span className="text-sm font-bold leading-tight">{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={regionsRef}
          style={{
            boxShadow: highlight === "regions" ? "0 0 0 3px rgba(242,137,31,0.5)" : "none",
            borderRadius: "16px",
            transition: "box-shadow 0.3s",
          }}
        >
          <label className="mb-2 flex items-center justify-between">
            <span className="text-base font-bold text-navy">관심 지역</span>
            <button
              type="button"
              onClick={() =>
                setRegions(regions.length === mockRegions.length ? [] : [...mockRegions])
              }
              className="text-xs font-bold text-orange"
            >
              {regions.length === mockRegions.length ? "전체 해제" : "전체 선택"}
            </button>
          </label>
          <p className="text-xs text-gray500 -mt-1 mb-2">
            선택 안 하면 전국 매물 알림을 다 받아요
          </p>
          <div className="grid grid-cols-4 gap-2">
            {mockRegions.map((r) => (
              <button
                key={r}
                onClick={() => toggle(regions, setRegions, r)}
                className={`text-sm py-2.5 rounded-full border-2 font-bold text-center ${
                  regions.includes(r)
                    ? "bg-navy text-white border-navy"
                    : "border-gray200 text-gray500"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsBusiness(!isBusiness)}
          className="flex items-center justify-between border-2 border-gray200 rounded-xl px-4 text-left"
          style={{ minHeight: "64px" }}
        >
          <div>
            <div className="text-base font-medium text-gray900">사업자 회원이에요</div>
            <div className="text-xs text-gray500 mt-0.5">선택 · 점핑매니저 검증에 활용</div>
          </div>
          <div
            className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 ${
              isBusiness ? "bg-orange" : "bg-gray200"
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                isBusiness ? "left-6" : "left-1"
              }`}
            />
          </div>
        </button>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-orange w-5 h-5 flex-shrink-0"
          />
          <span className="text-sm text-gray500 leading-relaxed">
            <b className="text-gray900">[필수]</b> 기기 알림(푸시) 수신 및{" "}
            <a href="/privacy" target="_blank" className="text-orange font-bold underline">
              개인정보 처리방침
            </a>{" "}
            동의
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={addKakaoChannel}
            onChange={(e) => setAddKakaoChannel(e.target.checked)}
            className="mt-0.5 accent-orange w-5 h-5 flex-shrink-0"
          />
          <span className="text-sm text-gray500 leading-relaxed">
            카카오톡 채널도 함께 추가할게요 · 공지·이벤트 소식
          </span>
        </label>

        {pushStatus === "denied" && (
          <div className="text-sm text-orange bg-dangerBg rounded-lg px-4 py-3">
            브라우저 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용해주세요.
          </div>
        )}
        {pushStatus === "unsupported" && (
          <div className="text-sm text-gray500 bg-gray100 rounded-lg px-4 py-3 leading-relaxed">
            {typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent) ? (
              <>
                아이폰은 <b className="text-gray900">공유 버튼 → &quot;홈 화면에 추가&quot;</b>로 앱을 설치해야
                알림을 받을 수 있어요. 지금은 가입만 진행하고, 나중에 홈 화면에 추가한 뒤 다시 접속하시면
                알림이 활성화돼요.
              </>
            ) : (
              "현재 브라우저에서는 기기 알림을 지원하지 않아요. 매물은 리스트에서 계속 확인할 수 있어요."
            )}
          </div>
        )}

        {error && <div className="text-sm text-orange font-medium">{error}</div>}
      </div>

      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-6 pt-3 bg-white"
        style={{ boxShadow: "0 -8px 20px rgba(11,37,64,0.08)", bottom: "64px" }}
      >
        {authUserId && (categories.length === 0 || !agreed) && (
          <div className="text-xs text-gray500 mb-2 flex flex-col gap-0.5">
            {categories.length === 0 && <span>○ 관심 카테고리를 선택해주세요</span>}
            {!agreed && <span>○ 개인정보 처리방침에 동의해주세요</span>}
          </div>
        )}
        <button
          onClick={submit}
          disabled={submitting || !authUserId}
          className="w-full text-white font-bold rounded-2xl text-lg disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #D9531E, #F2891F)", padding: "18px 0" }}
        >
          {submitting ? "처리 중..." : "알림 받기 시작"}
        </button>
      </div>

      {showSelectionPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowSelectionPrompt(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-xl text-navy mb-1.5">
              관심 카테고리를 골라주세요
            </div>
            <p className="text-sm text-gray500 mb-5 leading-relaxed">
              어떤 매물 알림을 받을지 알아야 딱 맞는 특가만 보내드릴 수 있어요.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={selectAllAndClose}
                className="w-full text-white font-bold rounded-2xl text-base"
                style={{ background: "linear-gradient(135deg, #D9531E, #F2891F)", padding: "16px 0" }}
              >
                🎯 전체 카테고리·지역 다 받을게요
              </button>
              <button
                onClick={goPickManually}
                className="w-full font-bold rounded-2xl text-base border-2 border-gray200 text-navy"
                style={{ padding: "16px 0" }}
              >
                📋 직접 선택할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
