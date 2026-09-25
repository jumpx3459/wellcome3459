"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendOtp, verifyOtp, isValidKoreanPhone } from "@/lib/auth";
import { mockCategories, mockRegions, categoryIcons, categoryColors } from "@/lib/mockData";
import { subscribeToPush } from "@/lib/pushClient";
import { generateRefCode } from "@/lib/refCode";
import Toast, { useToast } from "@/components/Toast";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { fmtLeft } from "@/lib/format";

// "01012345678" -> "010****5678" 형태로 화면에만 일부 가려서 보여줍니다
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_xcFZrX/friend";
const TOTAL_STEPS = 2;

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
  const { message: toastMessage, showToast } = useToast();

  const [obStep, setObStep] = useState(1);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [phone, setPhone] = useState("");

  // 휴대폰 SMS 인증 — schema.sql 설계 원안대로 Supabase Auth phone OTP를 직접 씁니다
  // (src/lib/auth.ts 참고). 데모/목업과 달리 실제 발송·검증 API를 그대로 호출합니다.
  const [codeSent, setCodeSent] = useState(false);
  const [codeLeft, setCodeLeft] = useState(180);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [regionOpen, setRegionOpen] = useState(false);
  const [push, setPush] = useState(true);
  // 카카오 알림톡(개인화된 매물 메시지) 발송은 현재 구현돼 있지 않음 — 이 토글은
  // 카카오톡 "채널 추가"(친구 추가) 링크로 보낼 뿐인 공지·이벤트용 보조 채널이라,
  // 알림 수신 여부 판정(anyChannel)에서는 제외한다. 2단계(휴대폰 인증) 하단 채널
  // 토글과 그 아래 마케팅 수신 동의는 여전히 이 값 하나를 공유한다(Claude Design 원안 유지).
  const [kakao, setKakao] = useState(true);
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 사업자 회원 여부 + 업체명 — 별도 화면 없이 2단계(휴대폰 인증) 하단에 그대로 유지합니다.
  const [isBusiness, setIsBusiness] = useState(true);
  const [companyName, setCompanyName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "granted" | "denied" | "unsupported">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const applySession = (user: { id: string; phone?: string | null } | null | undefined) => {
    // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
    debugLog(`[signup] applySession user=${user ? user.id.slice(0, 8) : "null"} phone=${JSON.stringify(user?.phone)}`);
    if (user && !user.phone) {
      // 카카오 로그인 시절 만들어진, 전화번호가 없는 낡은 세션 — 로그아웃시켜
      // 정상적인 문자 인증 흐름으로 다시 시작하게 합니다.
      debugLog(`[signup] ⚠️ signOut 발동! user.id=${user.id.slice(0, 8)} user.phone=${JSON.stringify(user.phone)}`);
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
      debugLog(`[signup] mount getSession -> ${data.session ? "EXISTS" : "NULL"}`);
      applySession(data.session?.user);
      setAuthChecked(true);
    });
    // 인증번호 확인(verifyOtp)이 성공하면 Supabase가 세션을 발급하고, 이 구독이
    // 자동으로 authUserId를 채워줍니다.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
      debugLog(`[signup] onAuthStateChange event=${event} session=${session ? "EXISTS" : "NULL"} phone=${JSON.stringify(session?.user?.phone)}`);
      applySession(session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUserId || !supabase) return;
    debugLog(`[signup] members-check effect fired for authUserId=${authUserId.slice(0, 8)}`);
    supabase
      .from("members")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle()
      .then(async ({ data, error: queryError }) => {
        const already = Boolean(data);
        setAlreadyMember(already);
        if (already) {
          try {
            localStorage.removeItem("dj_signup_pending");
          } catch {}
        }
        // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
        const { data: sessionCheck } = await supabase!.auth.getSession();
        debugLog(
          `[signup] members-check result already=${already} queryError=${queryError?.message ?? "none"} ` +
            `authUserId=${authUserId.slice(0, 8)} sessionNow=${
              sessionCheck.session ? "EXISTS" : "NULL"
            } sessionUserId=${sessionCheck.session?.user?.id?.slice(0, 8) ?? "none"}`
        );
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

  // 인증번호 재전송 카운트다운
  useEffect(() => {
    if (!codeSent || authUserId || codeLeft <= 0) return;
    const t = setInterval(() => setCodeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [codeSent, authUserId, codeLeft]);

  const toggleIn = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

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
    // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
    debugLog(`[signup] verifyOtp result ok=${result.ok} ${result.ok ? `id=${result.data.id.slice(0, 8)} phone=${result.data.phone}` : `error=${result.error}`}`);
    if (!result.ok) {
      setOtpError(result.error);
      setOtpCode("");
      return;
    }
    // authUserId는 위 onAuthStateChange 구독이 세션 발급과 동시에 자동으로 채워줍니다.
  };

  const onCodeChange = (value: string) => {
    const v = value.replace(/[^0-9]/g, "").slice(0, 6);
    setOtpCode(v);
    if (v.length === 6 && !authUserId && !otpVerifying) {
      handleVerifyOtp(v);
    }
  };

  const tryDifferentNumber = async () => {
    await supabase?.auth.signOut();
    setAlreadyMember(false);
    setAuthUserId(null);
    setPhone("");
    setOtpCode("");
    setCodeSent(false);
  };

  const submit = async () => {
    let kakaoRedirected = false;
    setError(null);
    if (!authUserId) {
      setError("휴대폰 인증을 먼저 완료해주세요.");
      return;
    }
    if (!agreeTos || !agreePrivacy) {
      setError("필수 약관에 동의해주세요.");
      return;
    }
    if (!push && !kakao) {
      setObStep(2);
      setError("알림 받을 방법을 하나 이상 선택해주세요.");
      return;
    }
    if (categories.length === 0) {
      setObStep(1);
      setError("관심 카테고리를 선택해주세요.");
      return;
    }

    // 팝업 차단 회피 — 사용자 클릭과 같은 동기 호출 스택에서 빈 창을 먼저 열어두고,
    // upsert 성공 후에 카카오 채널 URL로 이동시킵니다(비동기 호출 이후에 열면 팝업이 막힘).
    const kakaoWindow = kakao ? window.open("", "_blank") : null;
    debugLog(`[signup] submit start kakao=${kakao} kakaoWindow=${kakaoWindow ? (kakaoWindow === window ? "SELF(same-tab)" : "new-window") : "null(blocked?)"}`);

    setSubmitting(true);

    // 버그 수정: 예전엔 이 시점에 곧바로 subscribeToPush()를 기다렸는데,
    // 이 함수는 브라우저 알림 권한 요청(Notification.requestPermission())을
    // 포함해서 사용자가 응답할 때까지 무한정 멈춰 있을 수 있다. 그러는 동안
    // 위에서 미리 열어둔 카카오 창은 리다이렉트되지 않은 채 about:blank로
    // 방치돼 "빈 화면으로 이동한 채 멈췄다"처럼 보인다. 그래서 푸시 권한
    // 요청은 카카오 창의 운명(리다이렉트 또는 닫기)이 결정된 뒤로 미룬다.
    if (!isSupabaseConfigured || !supabase) {
      // 데모 모드: 실제 저장 없이 다음 화면으로 이동
      if (kakaoWindow) kakaoWindow.close();
      if (push) {
        const pushResult = await subscribeToPush();
        if (pushResult.status === "denied") setPushStatus("denied");
        else if (pushResult.status === "unsupported") setPushStatus("unsupported");
        else setPushStatus("granted");
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
        debugLog(`[signup] members upsert error code=${memberError.code} closing kakaoWindow=${!!kakaoWindow}`);
        if (kakaoWindow) kakaoWindow.close();
        setError(
          memberError.code === "23505"
            ? "이미 사용 중인 휴대폰 번호예요. 다른 번호로 시도하거나 고객센터로 문의해주세요."
            : "가입 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."
        );
        setSubmitting(false);
        return;
      }

      if (kakaoWindow) {
        debugLog(`[signup] redirecting kakaoWindow -> ${KAKAO_CHANNEL_URL}`);
        kakaoWindow.location.href = KAKAO_CHANNEL_URL;
        kakaoRedirected = true;
      }

      let pushResult: Awaited<ReturnType<typeof subscribeToPush>> | null = null;
      if (push) {
        pushResult = await subscribeToPush();
        if (pushResult.status === "denied") setPushStatus("denied");
        else if (pushResult.status === "unsupported") setPushStatus("unsupported");
        else setPushStatus("granted");
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

      if (pushResult?.status === "subscribed" && pushResult.subscription.endpoint) {
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
    } catch (e) {
      debugLog(`[signup] submit catch ${e instanceof Error ? e.message : String(e)} closing kakaoWindow=${!!(kakaoWindow && !kakaoRedirected)}`);
      if (kakaoWindow && !kakaoRedirected) kakaoWindow.close();
      setError("가입 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- 파생 값 (Claude Design 원안의 estAlerts/condCats/condRegions 로직과 동일) ----
  const reqAgreed = agreeTos && agreePrivacy;
  const anyChannel = push; // 카카오 채널 추가는 실제 알림 채널이 아니라 판정에서 제외
  const verified = Boolean(authUserId);
  const step4Ready = verified && reqAgreed && anyChannel;
  const estAlerts = Math.max(2, categories.length * 4 + (regions.length === 0 ? 6 : regions.length * 2));
  const condCats =
    categories.length > 0
      ? categories.slice(0, 2).join("·") + (categories.length > 2 ? ` 외 ${categories.length - 2}` : "")
      : "전체 카테고리";
  const allRegionsOn = regions.length === mockRegions.length;
  const condRegions =
    regions.length === 0 || allRegionsOn
      ? "전 지역"
      : regions.slice(0, 2).join("·") + (regions.length > 2 ? ` 외 ${regions.length - 2}` : "");
  const myCondText = `${condCats} · ${condRegions}`;

  const obCtaLabel =
    obStep === 1
      ? categories.length
        ? `${categories.length}개 선택 · 다음`
        : "카테고리를 골라주세요"
      : obStep === 2
      ? !verified
        ? "휴대폰 인증이 필요해요"
        : !reqAgreed
        ? "필수 항목에 동의해주세요"
        : !anyChannel
        ? "알림 받을 방법을 골라주세요"
        : "동의하고 알림 받기 시작"
      : "다음";
  const obCtaDisabled = (obStep === 1 && categories.length === 0) || (obStep === 2 && !step4Ready);

  const goBack = () => {
    if (obStep <= 1) {
      router.push("/");
      return;
    }
    setObStep((s) => s - 1);
  };

  const goNext = () => {
    if (obStep === 1 && categories.length === 0) {
      showToast("관심 카테고리를 1개 이상 골라주세요");
      return;
    }
    if (obStep === 2) {
      if (!verified) {
        showToast("휴대폰 인증을 먼저 완료해주세요");
        return;
      }
      if (!reqAgreed) {
        showToast("필수 동의 항목을 확인해주세요");
        return;
      }
      if (!anyChannel) {
        showToast("알림 받으려면 앱 푸시를 켜주세요");
        return;
      }
      submit();
      return;
    }
    setObStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const pickAllCategories = () => {
    setCategories([...mockCategories]);
    showToast("전체 카테고리로 받습니다 · 나중에 좁힐 수 있어요");
  };

  const pickAllRegions = () => {
    setRegions(allRegionsOn ? [] : [...mockRegions]);
    showToast(allRegionsOn ? "지역 선택을 비웠어요" : "전국 모든 지역으로 받습니다");
  };

  if (!authChecked) return null;

  return (
    <main className="flex flex-col min-h-screen bg-white">
      <div style={{ padding: "20px 22px 14px", borderBottom: "1px solid #EEF0F2" }}>
        <div className="flex items-center gap-3">
          <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6B7480", padding: 0, lineHeight: 1 }}>
            ←
          </button>
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: "#E4E7EB" }}>
            <div
              style={{
                height: "100%",
                background: "var(--color-brandOrange)",
                borderRadius: 99,
                transition: "width .3s ease",
                width: `${Math.round((obStep / TOTAL_STEPS) * 100)}%`,
              }}
            />
          </div>
          <span className="font-mono text-xs font-bold" style={{ color: "#6B7480" }}>{obStep}/{TOTAL_STEPS}</span>
        </div>
      </div>

      <div className="flex-1" style={{ padding: "24px 22px 20px" }}>
        {alreadyMember ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "32px 6px 0" }}>
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 76, height: 76, background: "#E8F8EC", fontSize: 34 }}
            >
              ✔
            </div>
            <h2 className="font-display mt-4.5" style={{ fontSize: 23, color: "#0B2540", letterSpacing: "-0.02em" }}>
              이미 가입된 번호예요
            </h2>
            <p className="mt-2.5" style={{ fontSize: 14, color: "#6B7480", lineHeight: 1.7 }}>
              이 번호로 등록된 계정이 있어요.
              <br />
              기존 알림 조건 그대로 바로 이용하실 수 있습니다.
            </p>
            <div className="w-full rounded-2xl mt-5 text-left" style={{ background: "#F5F6F8", padding: "15px 16px" }}>
              <div className="text-xs font-bold" style={{ color: "#6B7480" }}>가입된 번호</div>
              <div className="mt-1 font-bold" style={{ fontSize: 16, color: "#0B2540", fontVariantNumeric: "tabular-nums" }}>
                {maskPhone(phone)}
              </div>
            </div>
            <button
              onClick={() => router.push(returnTo || "/mypage")}
              className="w-full text-white font-bold rounded-2xl mt-4.5"
              style={{ padding: "17px 0", fontSize: 16.5, background: "linear-gradient(135deg,#E25100,#FF6F0F)", boxShadow: "0 8px 20px rgba(226,81,0,.3)" }}
            >
              {returnTo ? "매물 보러 가기" : "마이페이지로 이동"}
            </button>
            <button
              onClick={tryDifferentNumber}
              className="mt-2.5"
              style={{ background: "none", border: "none", color: "#6B7480", fontSize: 13.5, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 4, padding: 10 }}
            >
              다른 번호로 가입하기
            </button>
          </div>
        ) : null}

        {!alreadyMember && obStep === 1 && (
          <div>
            <h2 className="font-display" style={{ fontSize: 23, color: "#0B2540", letterSpacing: "-0.02em" }}>
              어떤 재고를 찾고 계세요?
            </h2>
            <p className="mt-2" style={{ fontSize: 14, color: "#6B7480", lineHeight: 1.6 }}>
              고른 카테고리에 매물이 뜨면 즉시 알려드려요. 여러 개 고를 수 있어요.
            </p>
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              {mockCategories.map((c) => {
                const picked = categories.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleIn(categories, setCategories, c)}
                    className="flex items-center gap-2.5 text-left rounded-2xl"
                    style={{
                      padding: "12px 11px",
                      background: "#fff",
                      border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                    }}
                  >
                    <span
                      className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ width: 30, height: 30, fontSize: 15, background: categoryColors[c].bg }}
                    >
                      {categoryIcons[c]}
                    </span>
                    <span className="text-sm font-bold leading-tight" style={{ color: "#1A1F26" }}>
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={pickAllCategories}
              className="mt-4"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#6B7480", textDecoration: "underline", textUnderlineOffset: 4, padding: "8px 0" }}
            >
              아직 잘 모르겠어요 · 전체 받기 →
            </button>

            <div className="mt-6" style={{ borderTop: "1px solid #EEF0F2", paddingTop: 18 }}>
              <button
                type="button"
                onClick={() => setRegionOpen((v) => !v)}
                className="w-full flex items-center justify-between flex-wrap gap-x-2 gap-y-1"
              >
                <span style={{ color: "#0B2540", fontSize: 15, fontWeight: 700, wordBreak: "keep-all" }}>
                  🗺️ 관심지역 선택{" "}
                  <span style={{ color: "#6B7480", fontWeight: 500 }}>(선택 안 하면 전국)</span>
                </span>
                <span className="font-bold ml-auto" style={{ color: "#6B7480", fontSize: 13, whiteSpace: "nowrap" }}>
                  {regionOpen
                    ? "접기 ▲"
                    : allRegionsOn || regions.length === 0
                    ? "전국 (선택 안 함) · 펼치기 ▾"
                    : `${regions.length}곳 선택됨 · 펼치기 ▾`}
                </span>
              </button>
              {regionOpen && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {mockRegions.map((r) => {
                      const picked = regions.includes(r);
                      return (
                        <button
                          key={r}
                          onClick={() => toggleIn(regions, setRegions, r)}
                          className="rounded-full font-bold"
                          style={{
                            padding: "10px 14px",
                            fontSize: 14,
                            background: "#fff",
                            border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                            color: "#1A1F26",
                          }}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={pickAllRegions}
                    className="mt-3"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#6B7480", textDecoration: "underline", textUnderlineOffset: 4, padding: "6px 0" }}
                  >
                    {allRegionsOn ? "전국 전체 선택됨 · 해제하기" : "전국 어디든 괜찮아요 →"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!alreadyMember && obStep === 2 && (
          <div>
            <h2 className="font-display" style={{ fontSize: 23, color: "#0B2540", letterSpacing: "-0.02em" }}>
              휴대폰 인증만 하면 끝이에요
            </h2>
            <p className="mt-2" style={{ fontSize: 14, color: "#6B7480", lineHeight: 1.6 }}>
              인증된 번호로 알림을 보내고, 판매자 연락처 열람도 이 번호로 확인합니다.
            </p>

            <div className="text-sm font-bold mt-5.5 mb-2" style={{ color: "#0B2540" }}>휴대폰 번호</div>
            <div className="flex gap-2">
              <input
                className="flex-1 min-w-0 rounded-xl outline-none"
                style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 15, fontVariantNumeric: "tabular-nums" }}
                placeholder="010-0000-0000"
                inputMode="numeric"
                value={phone}
                disabled={verified}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, "").slice(0, 13))}
              />
              <button
                onClick={handleSendOtp}
                disabled={otpSending || verified || !isValidKoreanPhone(phone)}
                className="flex-shrink-0 rounded-xl font-bold disabled:opacity-60"
                style={{ border: "1.5px solid #0B2540", background: "#fff", padding: "0 15px", fontSize: 13.5, color: "#0B2540", whiteSpace: "nowrap" }}
              >
                {otpSending ? "발송 중..." : codeSent ? "다시 받기" : "인증번호 받기"}
              </button>
            </div>

            {/* 발송 전 실패(형식/레이트리밋/서버 오류)는 아직 인증번호 입력칸이 없으니
                여기서 바로 보여줌. 인증번호 입력 후 실패(오입력 등)는 사용자 시선이
                아래 인증번호 칸에 있으므로 그 근처에서 별도로 보여줌(아래 블록 참고) —
                이 자리에 통째로 몰아두면 codeSent 이후엔 화면 위쪽이라 놓치기 쉬웠음. */}
            {!codeSent && otpError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{otpError}</p>}

            {codeSent && !verified && (
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

            <div className="flex items-center gap-2.5 rounded-2xl mt-4.5" style={{ padding: "14px 16px", background: verified ? "#E8F8EC" : "#F5F6F8" }}>
              <span style={{ fontSize: 16 }}>📱</span>
              <span className="flex-1 text-xs font-bold" style={{ lineHeight: 1.5, color: verified ? "#2F9E44" : "#6B7480" }}>
                {verified ? "✔ 인증 완료 · 이 번호로 알림을 보냅니다" : "인증된 번호로만 판매자 연락처를 열람할 수 있어요"}
              </span>
            </div>

            {verified && (
              <div className="mt-4.5">
                <label className="text-sm font-bold mb-2 block" style={{ color: "#0B2540" }}>업체명 (선택)</label>
                <input
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4E7EB", padding: "13px 14px", fontSize: 15 }}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 웰컴코리아(주)"
                />
                <label className="flex items-center justify-between mt-3" style={{ minHeight: 44 }}>
                  <span className="text-sm" style={{ color: "#1A1F26" }}>사업자 회원이에요 · 점핑매니저 검증에 활용</span>
                  <button
                    type="button"
                    onClick={() => setIsBusiness(!isBusiness)}
                    className="rounded-full relative flex-shrink-0"
                    style={{ width: 46, height: 27, background: isBusiness ? "var(--color-toggleOn)" : "#D5D9DE", transition: "background .2s" }}
                  >
                    <span className="absolute rounded-full bg-white" style={{ top: 3, width: 21, height: 21, left: isBusiness ? 22 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
                  </button>
                </label>
              </div>
            )}

            {/* design-v2: 예전엔 여기 있던 "어디로 알려드릴까요?" 전체 화면 스텝을 없애고,
                토글 자체를 이 화면(2단계) 하단으로 옮겼습니다 — 알림 권한은 별도 스텝으로
                끊기보다 맥락 안에서 물어보는 쪽이 이탈이 적다는 벤치마킹 결과 반영.
                기본값은 그대로 push=on/kakao=on이라 대부분은 손댈 필요 없이 지나갑니다. */}
            <div className="mt-5" style={{ borderTop: "1px solid #EEF0F2", paddingTop: 16 }}>
              <div className="text-xs font-bold" style={{ color: "#0B2540" }}>알림 받을 방법</div>
              <div className="text-xs mt-0.5 mb-3" style={{ color: "#6B7480" }}>
                {myCondText} · 주간 약 {estAlerts}건
              </div>

              <button
                onClick={() => setPush(!push)}
                className="w-full flex items-center gap-3 text-left rounded-2xl"
                style={{ padding: "13px 15px", background: "#fff", border: push ? "2px solid var(--color-toggleOn)" : "1.5px solid #E4E7EB" }}
              >
                <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, background: "#FDEEE8", fontSize: 16 }}>🔔</span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-bold" style={{ color: "#0B2540" }}>앱 푸시 알림</span>
                    <span className="text-xs font-bold" style={{ color: "#E25100" }}>[기본]</span>
                  </span>
                  <span className="block text-xs mt-0.5" style={{ color: "#6B7480" }}>조건에 맞는 매물이 뜨는 즉시</span>
                </span>
                <span className="rounded-full flex-shrink-0 relative" style={{ width: 42, height: 25, background: push ? "var(--color-toggleOn)" : "#D5D9DE", transition: "background .2s" }}>
                  <span className="absolute rounded-full bg-white" style={{ top: 2, width: 19, height: 19, left: push ? 20 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
                </span>
              </button>

              <button
                onClick={() => setKakao(!kakao)}
                className="w-full flex items-center gap-3 text-left rounded-2xl mt-2"
                style={{ padding: "13px 15px", background: "#fff", border: kakao ? "2px solid var(--color-toggleOn)" : "1.5px solid #E4E7EB" }}
              >
                <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, background: "#FEE500", fontSize: 16 }}>💬</span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: "#0B2540", whiteSpace: "nowrap" }}>카카오톡 채널 추가</span>
                    <span className="text-xs font-bold" style={{ color: "#6B7480", whiteSpace: "nowrap" }}>[선택]</span>
                  </span>
                  <span className="block text-xs mt-0.5" style={{ color: "#6B7480" }}>
                    {kakao ? "추가됨 · 공지·이벤트 소식 받는 중" : "공지·이벤트 소식을 카톡으로 받기"}
                  </span>
                </span>
                <span className="rounded-full flex-shrink-0 relative" style={{ width: 42, height: 25, background: kakao ? "var(--color-toggleOn)" : "#D5D9DE", transition: "background .2s" }}>
                  <span className="absolute rounded-full bg-white" style={{ top: 2, width: 19, height: 19, left: kakao ? 20 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
                </span>
              </button>

              <p className="mt-2.5" style={{ fontSize: 11, color: "#6B7480", lineHeight: 1.6 }}>
                맞춤 특가 알림은 앱 푸시로만 발송돼요. 카카오톡 채널은 공지·이벤트 소식용 보조 채널입니다.
              </p>

              {!anyChannel && (
                <div
                  className="flex items-center gap-2.5 w-full text-left rounded-2xl mt-2.5"
                  style={{ border: "1.5px solid #E5484D", background: "#FDEEE8", padding: "13px 15px" }}
                >
                  <span style={{ fontSize: 15 }}>⚠️</span>
                  <span className="flex-1 text-xs font-bold" style={{ color: "#E5484D", lineHeight: 1.5 }}>
                    알림 받을 방법이 없어요 · 앱 푸시를 켜주세요
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB" }}>
              <button
                onClick={() => {
                  const all = agreeTos && agreePrivacy && kakao;
                  setAgreeTos(!all);
                  setAgreePrivacy(!all);
                  setKakao(!all);
                }}
                className="flex items-center gap-2.5 w-full text-left"
                style={{ borderBottom: "1px solid #EEF0F2", background: "#FAFBFC", padding: "14px 15px" }}
              >
                <span
                  className="rounded-md flex items-center justify-center flex-shrink-0 text-white font-black"
                  style={{
                    width: 22,
                    height: 22,
                    fontSize: 13,
                    background: agreeTos && agreePrivacy && kakao ? "var(--color-brandOrange)" : "#fff",
                    border: agreeTos && agreePrivacy && kakao ? "1.5px solid var(--color-brandOrange)" : "1.5px solid #C9CFD6",
                  }}
                >
                  {agreeTos && agreePrivacy && kakao ? "✓" : ""}
                </span>
                <span className="text-sm font-bold" style={{ color: "#0B2540" }}>약관 전체 동의</span>
              </button>

              {[
                { key: "tos", label: "서비스 이용약관 동의", tag: "필수", on: agreeTos, toggle: () => setAgreeTos(!agreeTos) },
                { key: "privacy", label: "개인정보 수집·이용 동의", tag: "필수", on: agreePrivacy, toggle: () => setAgreePrivacy(!agreePrivacy) },
                { key: "marketing", label: "마케팅·광고 정보 수신 (카카오톡 채널 소식)", tag: "선택", on: kakao, toggle: () => setKakao(!kakao) },
              ].map((a) => (
                <button
                  key={a.key}
                  onClick={a.toggle}
                  className="flex items-center gap-2.5 w-full text-left"
                  style={{ borderBottom: "1px solid #F1F3F5", background: "#fff", padding: "12px 15px" }}
                >
                  <span
                    className="rounded flex items-center justify-center flex-shrink-0 text-white font-black"
                    style={{ width: 20, height: 20, fontSize: 12, background: a.on ? "var(--color-brandOrange)" : "#fff", border: a.on ? "1.5px solid var(--color-brandOrange)" : "1.5px solid #C9CFD6" }}
                  >
                    {a.on ? "✓" : ""}
                  </span>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: a.tag === "필수" ? "#E25100" : "#6B7480" }}>[{a.tag}]</span>
                  <span className="flex-1" style={{ fontSize: 12.5, lineHeight: 1.45, color: a.on ? "#1A1F26" : "#6B7480" }}>{a.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-3" style={{ fontSize: 11, color: "#6B7480", lineHeight: 1.6 }}>
              개인정보는 재고 알림 발송·본인 확인 목적으로만 사용하며, 알림 해지 시 즉시 파기합니다. 사업자 인증은 MY에서 언제든 추가할 수 있어요.
            </p>

            {pushStatus === "denied" && (
              <div className="text-sm rounded-lg mt-3" style={{ color: "var(--color-orange)", background: "var(--color-dangerBg)", padding: "12px 16px" }}>
                브라우저 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용해주세요.
              </div>
            )}
            {pushStatus === "unsupported" && (
              <div className="text-sm rounded-lg mt-3 leading-relaxed" style={{ color: "#6B7480", background: "#F5F6F8", padding: "12px 16px" }}>
                {typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent) ? (
                  <>
                    아이폰은 <b style={{ color: "#1A1F26" }}>공유 버튼 → &quot;홈 화면에 추가&quot;</b>로 앱을 설치해야
                    알림을 받을 수 있어요. 지금은 가입만 진행하고, 나중에 홈 화면에 추가한 뒤 다시 접속하시면
                    알림이 활성화돼요.
                  </>
                ) : (
                  "현재 브라우저에서는 기기 알림을 지원하지 않아요. 매물은 리스트에서 계속 확인할 수 있어요."
                )}
              </div>
            )}
            {error && <div className="text-sm font-medium mt-3" style={{ color: "var(--color-orange)" }}>{error}</div>}
          </div>
        )}
      </div>

      {!alreadyMember && (
        <div
          className="sticky bottom-0 z-10"
          style={{ padding: "14px 22px 24px", borderTop: "1px solid #EEF0F2", background: "#fff" }}
        >
          <button
            onClick={goNext}
            disabled={submitting}
            className="w-full font-black rounded-2xl text-white disabled:opacity-60"
            style={{
              padding: "18px 0",
              fontSize: 17,
              transition: "all .2s",
              background: obCtaDisabled ? "#C9CFD6" : "linear-gradient(135deg,#E25100,#FF6F0F)",
              boxShadow: obCtaDisabled ? "none" : "0 8px 20px rgba(226,81,0,.3)",
            }}
          >
            {submitting ? "처리 중..." : obCtaLabel}
          </button>
        </div>
      )}

      <Toast message={toastMessage} />
    </main>
  );
}
