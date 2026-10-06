"use client";

import { safeReturnTo } from "@/lib/safeReturnTo";
import { useResendCountdown, useWebOtp } from "@/lib/useOtpAssist";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendOtp, verifyOtp, isValidKoreanPhone, toLocalPhone, formatPhoneTyping } from "@/lib/auth";
import { mockCategories, categoryIcons, categoryColors } from "@/lib/mockData";
import { subscribeToPush, savePushSubscription } from "@/lib/pushClient";
import { generateRefCode } from "@/lib/refCode";
import Toast, { useToast } from "@/components/Toast";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { fmtLeft } from "@/lib/format";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import { SITE_URL, isCanonicalHost } from "@/lib/siteUrl";
import { getPushBlocker, type PushBlocker } from "@/lib/browserEnv";
import PushBlockerNotice from "@/components/PushBlockerNotice";
import { rem } from "@/lib/rem";
import { clearReturningMember } from "@/lib/returningMember";
import FloatingCTA, { FloatingCTANote, FLOATING_CTA_BUTTON_CLASS, FLOATING_CTA_SPACE, floatingCtaButtonStyle } from "@/components/FloatingCTA";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { CONSENT_TEXT } from "@/lib/consent";
import { announceConsents, saveConsents } from "@/lib/consentClient";
import PrivacyConsentTextSheet from "@/components/PrivacyConsentTextSheet";

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
  const returnTo = safeReturnTo(searchParams.get("returnTo")); // 같은 출처 경로만 (src/lib/safeReturnTo.ts)
  const refCode = searchParams.get("ref"); // 추천인의 member id (점핑파트너 트래킹용)
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
  const { message: toastMessage, showToast } = useToast();

  const [obStep, setObStep] = useState(1);
  // 2026-09-26 (10): 2단계(휴대폰인증+알림방법+약관)가 길어서 인증칸을 스크롤로
  // 지나친 뒤 맨 아래 "휴대폰 인증이 필요해요" CTA를 눌러도 그냥 토스트만 뜨고
  // 인증칸이 어딘지 못 찾겠다는 피드백 — 눌렀을 때 그 칸으로 스크롤+포커스.
  const phoneInputRef = useRef<HTMLInputElement>(null);
  // 2026-10-05: 하단 고정 버튼이 비활성일 때 눌렀을 때 — 흔들림 + 버튼 위 안내(2.5초) + 해당 칸으로 스크롤(자동 포커스 없음)
  const categoryAreaRef = useRef<HTMLDivElement>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const agreeAreaRef = useRef<HTMLDivElement>(null);
  const [ctaNote, setCtaNote] = useState<string | null>(null);
  const ctaNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (ctaNoteTimerRef.current) clearTimeout(ctaNoteTimerRef.current); }, []);
  // 단계(1↔2)는 같은 페이지의 상태 변경이라 스크롤 위치가 그대로 남는다 — 1단계를 아래까지 내린 뒤
  // [다음]하면 2단계 번호 입력칸이 화면 위로 가려짐. 단계가 바뀔 때(앞·뒤 모두) 맨 위로 이동.
  // 입력칸 자동 포커스는 하지 않음(키보드가 갑자기 뜨는 것 방지). 첫 렌더는 건드리지 않음.
  const prevObStepRef = useRef(1);
  useEffect(() => {
    if (prevObStepRef.current === obStep) return;
    prevObStepRef.current = obStep;
    window.scrollTo(0, 0);
  }, [obStep]);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [phone, setPhone] = useState("");

  // 휴대폰 SMS 인증 — schema.sql 설계 원안대로 Supabase Auth phone OTP를 직접 씁니다
  // (src/lib/auth.ts 참고). 데모/목업과 달리 실제 발송·검증 API를 그대로 호출합니다.
  const [codeSent, setCodeSent] = useState(false);
  const [codeLeft, setCodeLeft] = useState(180);
  // 2026-10-06: 재발송 카운트(서버 1분 제한) · WebOTP 시작 신호(발송 성공마다 +1) — src/lib/useOtpAssist.ts
  const resend = useResendCountdown();
  const [sendNonce, setSendNonce] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  // 카카오 알림톡(개인화된 매물 메시지) 발송은 현재 구현돼 있지 않음 — 이 토글은
  // 카카오톡 "채널 추가"(친구 추가) 링크를 가입 완료 때 열어줄 뿐인 공지·이벤트용 보조 채널.
  // 2026-09-30: 마케팅 수신 동의(agreeKakaoMkt)와 분리하고 기본값 false (예전엔 둘이 한 값 + 기본 true).
  const [kakao, setKakao] = useState(false);
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  // 2026-09-30: [필수] 사업 목적 이용·만 14세 이상 확인 (eligibility, 약관 제4조)
  const [agreeEligibility, setAgreeEligibility] = useState(false);
  const [viewingPrivacyText, setViewingPrivacyText] = useState(false);
  // 2026-09-30: [선택] 광고성 정보 수신 동의 — 기본 false. 매물 알림 동의가 앱 푸시 켜기를 겸함(예전 push 토글 대체)
  const [agreeDealAlert, setAgreeDealAlert] = useState(false);
  const [agreeKakaoMkt, setAgreeKakaoMkt] = useState(false);

  // 사업자 회원 여부 + 업체명 — 별도 화면 없이 2단계(휴대폰 인증) 하단에 그대로 유지합니다.
  const [isBusiness, setIsBusiness] = useState(true);
  const [companyName, setCompanyName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "granted" | "denied" | "unsupported" | "noncanonical">(
    "idle"
  );
  // 비정식 주소(xxx.vercel.app 등)에선 구독을 막으므로(src/lib/pushClient.ts), 제출
  // 전에 알림 토글 옆에 정식 주소 링크를 미리 보여준다 — 제출 후엔 곧바로 다른
  // 화면으로 넘어가서 그때 안내하면 거의 안 보임.
  const [nonCanonicalHost, setNonCanonicalHost] = useState(false);
  // 2026-09-28: 카톡 등 인앱 브라우저·iPhone 미설치는 웹푸시 불가 — 알림 토글 아래에 미리 안내하고
  // 제출 때 구독 시도도 하지 않음 (예전엔 결과가 "granted"로 잘못 표시될 수 있었음)
  const [pushBlocker, setPushBlocker] = useState<PushBlocker | null>(null);
  useEffect(() => {
    setNonCanonicalHost(!isCanonicalHost(window.location.hostname));
    setPushBlocker(getPushBlocker());
  }, []);
  const [error, setError] = useState<string | null>(null);

  const applySession = (user: { id: string; phone?: string | null } | null | undefined) => {
    // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
    debugLog(`[signup] applySession user=${user ? user.id.slice(0, 8) : "null"} phone=${JSON.stringify(user?.phone)}`);
    if (user && !user.phone) {
      // 카카오 로그인 시절 만들어진, 전화번호가 없는 낡은 세션 — 로그아웃시켜
      // 정상적인 문자 인증 흐름으로 다시 시작하게 합니다.
      debugLog(`[signup] ⚠️ signOut 발동! user.id=${user.id.slice(0, 8)} user.phone=${JSON.stringify(user.phone)}`);
      // 2026-09-29: scope local — 기본값(global)은 이 회원의 다른 기기·설치 앱 세션까지 전부 끊음
      supabase?.auth.signOut({ scope: "local" });
      return;
    }
    setAuthUserId(user?.id ?? null);
    if (user?.phone) {
      setPhone(toLocalPhone(user.phone));
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
    // 2026-10-01: 자동완성이 입력 이벤트 없이 값만 채운 경우까지 — 누르는 순간 칸의 실제 값을 다시 읽음 (login과 같은 방식)
    const typed = formatPhoneTyping(phoneInputRef.current?.value || phone);
    if (typed !== phone) setPhone(typed);
    if (!isValidKoreanPhone(typed)) {
      setOtpError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    setOtpError(null);
    setOtpSending(true);
    const result = await sendOtp(typed);
    setOtpSending(false);
    if (!result.ok) {
      // 1분 재발송 제한은 빨간 문구 대신 [다시 받기 (N초)] 카운트만 맞춤
      if ("cooldownSeconds" in result) resend.start(result.cooldownSeconds);
      else setOtpError(result.error);
      return;
    }
    setCodeSent(true);
    setCodeLeft(180);
    setOtpCode("");
    resend.start();
    setSendNonce((n) => n + 1);
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
  // 안드로이드 크롬 문자 자동 입력 — 받은 6자리를 칸에 넣고 확인 1회(onCodeChange). 미지원·실패는 조용히 무시
  useWebOtp(codeSent && !authUserId, sendNonce, onCodeChange);

  const tryDifferentNumber = async () => {
    clearReturningMember(); // 명시적 로그아웃 — 재방문 화면 신호도 지움
    await supabase?.auth.signOut({ scope: "local" }); // 이 기기만 (다른 기기 세션 유지)
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
    if (!agreeTos || !agreePrivacy || !agreeEligibility) {
      setError("필수 약관에 동의해주세요.");
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
      if (agreeDealAlert && !pushBlocker) {
        const pushResult = await subscribeToPush();
        if (pushResult.status === "denied") setPushStatus("denied");
        else if (pushResult.status === "unsupported") setPushStatus("unsupported");
        else if (pushResult.status === "noncanonical") setPushStatus("noncanonical");
        else if (pushResult.status === "subscribed") setPushStatus("granted");
      }
      await new Promise((r) => setTimeout(r, 500));
      setSubmitting(false);
      router.push(returnTo || "/"); // 2026-10-06: returnTo 없으면 회원 홈(내 조건 매물) — 예전 /deals
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
        // 2026-09-29: 이미 회원 행이 있으면(재가입) referred_by를 보내지 않음 — upsert라도 BEFORE INSERT
        // 트리거(grant_referral_bonus)가 먼저 돌아 추천인에게 사진 슬롯 +2가 또 지급되던 문제.
        // (referred_by 자체는 members_protect_columns 트리거가 가입 후 변경을 막음)
        ...(referredById && !existingMember ? { referred_by: referredById } : {}),
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

      // 2026-09-30: 동의 기록 — 회원 행이 생긴 뒤라야 저장됨(FK). 실패해도 가입은 진행하고,
      // 필수 동의 기록이 없으면 다음 화면에서 재동의 시트(ConsentGate)가 한 번 더 받는다.
      const consents = [
        { type: "tos" as const, agreed: agreeTos },
        { type: "privacy" as const, agreed: agreePrivacy },
        { type: "eligibility" as const, agreed: agreeEligibility },
        { type: "deal_alert_ad" as const, agreed: agreeDealAlert },
        { type: "kakao_marketing" as const, agreed: agreeKakaoMkt },
      ];
      const consentSaved = await saveConsents(consents, "signup");
      if (consentSaved.ok) announceConsents(consents.filter((c) => c.agreed), consentSaved.recordedAt);
      else debugLog("[signup] consent save failed");

      let pushResult: Awaited<ReturnType<typeof subscribeToPush>> | null = null;
      if (agreeDealAlert && !pushBlocker) {
        pushResult = await subscribeToPush();
        if (pushResult.status === "denied") setPushStatus("denied");
        else if (pushResult.status === "unsupported") setPushStatus("unsupported");
        else if (pushResult.status === "noncanonical") setPushStatus("noncanonical");
        else if (pushResult.status === "subscribed") setPushStatus("granted");
      }

      const { data: catRows } = await supabase
        .from("categories")
        .select("id, name")
        .in("name", categories);

      if (catRows?.length) {
        await supabase.from("member_categories").upsert(
          catRows.map((c) => ({ member_id: userId, category_id: c.id }))
        );
      }

      if (pushResult?.status === "subscribed" && pushResult.subscription.endpoint) {
        // 저장 실패해도 가입 자체는 진행 — 기기엔 구독이 남아 있어서 마이페이지 알림 카드가
        // 열릴 때 조용히 다시 저장한다(PushStatusCard).
        // 가입 화면에서 앱 푸시를 켜고 제출한 것 자체가 명시적 동의라 explicit (토큰은 authFetch가 처리)
        const saved = await savePushSubscription(pushResult.subscription, { explicit: true });
        if (saved !== "saved") debugLog(`[signup] push subscription save failed result=${saved}`);
      }

      try {
        localStorage.removeItem("dj_signup_pending");
      } catch {}

      router.push(returnTo || "/"); // 2026-10-06: returnTo 없으면 회원 홈(내 조건 매물) — 예전 /deals
    } catch (e) {
      debugLog(`[signup] submit catch ${e instanceof Error ? e.message : String(e)} closing kakaoWindow=${!!(kakaoWindow && !kakaoRedirected)}`);
      if (kakaoWindow && !kakaoRedirected) kakaoWindow.close();
      setError("가입 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- 파생 값 (Claude Design 원안의 estAlerts/condCats/condRegions 로직과 동일) ----
  const reqAgreed = agreeTos && agreePrivacy && agreeEligibility;
  const allAgreed = reqAgreed && agreeDealAlert && agreeKakaoMkt;
  const verified = Boolean(authUserId);
  // 2026-09-30: 앱 푸시(매물 알림 동의)는 선택 — 필수 3개(약관·개인정보·이용 대상) + 휴대폰 인증만으로 가입 가능
  const step4Ready = verified && reqAgreed;
  const estAlerts = Math.max(2, categories.length * 4 + 6);
  const condCats =
    categories.length > 0
      ? categories.slice(0, 2).join("·") + (categories.length > 2 ? ` 외 ${categories.length - 2}` : "")
      : "전체 카테고리";
  const myCondText = condCats; // 2026-10-04: 매물 알림은 카테고리만(지역 선택 없음)

  const obCtaLabel =
    obStep === 1
      ? categories.length
        ? `${categories.length}개 선택 · 다음`
        : "관심 카테고리를 골라주세요"
      : obStep === 2
      ? !verified
        ? "휴대폰 인증이 필요해요"
        : !reqAgreed
        ? "필수 항목에 동의해주세요"
        : "동의하고 시작하기"
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
        phoneInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        phoneInputRef.current?.focus();
        return;
      }
      if (!reqAgreed) {
        showToast("필수 동의 항목을 확인해주세요");
        return;
      }
      submit();
      return;
    }
    setObStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  // 비활성(aria-disabled) 상태에서 누름 — goNext·submit은 절대 호출하지 않음
  const onCtaPress = () => {
    if (!obCtaDisabled) {
      goNext();
      return;
    }
    const note =
      obStep === 1
        ? "위에서 관심 카테고리를 1개 이상 눌러 주세요"
        : obStep === 2 && !verified
        ? "휴대폰 번호 인증을 먼저 해 주세요"
        : obStep === 2
        ? "위 [필수] 항목에 체크해 주세요"
        : null;
    if (!note) return;
    setShakeKey((k) => k + 1); // 흔들림은 FloatingCTA가(공용, prefers-reduced-motion이면 없음)
    setCtaNote(note);
    if (ctaNoteTimerRef.current) clearTimeout(ctaNoteTimerRef.current);
    ctaNoteTimerRef.current = setTimeout(() => setCtaNote(null), 2500);
    if (obStep === 1) categoryAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (!verified) phoneInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    else agreeAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pickAllCategories = () => {
    setCategories([...mockCategories]);
    showToast("전체 카테고리로 받습니다 · 나중에 좁힐 수 있어요");
  };

  if (!authChecked) return null;

  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* 2026-09-26 (2): 화이트 헤더 바로 아래에 네이비 스트립이 붙어 있어 톤이
          뚝 끊겨 보인다는 피드백 — buy/sell/signup 3개 화면 모두 헤더와 긴급성
          로테이션 스트립을 하나의 네이비 블록으로 병합 (deals/마이페이지는
          원래부터 헤더 자체가 다크 히어로라 이 문제가 없었음). 진행바 채움색도
          다크 배경용 --color-brandOrangeAccent로 교체(기본 brandOrange는 라이트
          배경 전용). */}
      {/* 2026-09-26 (6): deals/홈과 나란히 볼 때 이 화면만 단색 네이비라 밋밋해
          보인다는 피드백 — 높이는 그대로 두고 배경만 deals/홈과 동일한 도트
          텍스처 그라디언트로 통일 (온보딩 스텝 흐름은 불변). */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        <div style={{ padding: "20px 22px 14px" }}>
          <div className="flex items-center gap-3">
            <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: rem(20), color: "rgba(255,255,255,0.8)", padding: 0, lineHeight: 1 }}>
              ←
            </button>
            {/* 2026-09-26: 탭 화면마다 로고 유무가 달라 브랜드 인지가 끊긴다는 피드백 —
                모든 하단탭 화면 헤더에 작은 로고를 공통으로 배치.
                2026-09-27: buy/sell은 기존 회원의 반복 방문 화면이라 작게 둬도
                되지만, 신청(signup)은 신규 방문자의 첫 브랜드 접점이라 20px는
                너무 작다는 피드백 — 28px로 확대. */}
            <div className="bg-white rounded-lg px-2 py-1.5 flex-shrink-0">
              <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto block" />
            </div>
            {/* 2026-09-27: 2단계뿐인 플로우엔 연속형 프로그레스 바가 정보량이 적다는
                피드백 — 바를 걷어내고 "무엇을 완료하는 단계인지"까지 담은 텍스트
                라벨로 교체, 로고와 대칭 이루도록 우측 끝에 배치. */}
            <span
              className="ml-auto flex-shrink-0 font-bold rounded-full whitespace-nowrap"
              style={{ fontSize: rem(11.5), color: "var(--color-brandOrangeAccent)", background: "rgba(255,255,255,0.14)", padding: "5px 12px" }}
            >
              알림받기 STEP {obStep}/{TOTAL_STEPS}
            </span>
          </div>
        </div>
        {/* 2026-09-27 (재재검토): deals/buy/sell/마이페이지는 로테이션 태그가
            좌측 정렬(라벨 있으면 라벨 좌·태그 우) 기준인데 여기만 가운데 정렬로
            묶여 있던 것 — justify-between으로 신뢰 마커는 좌측, 태그는 우측으로
            분리해 방향을 맞춤. */}
        <div className="flex items-center justify-between" style={{ padding: "9px 22px" }}>
          {/* 2026-09-27 (재검토): 고정 숫자("890명+")는 하드코딩이라 실제 가입자
              수와 어긋날 수 있어, 홈/온보딩과 동일하게 숫자 없는 신뢰 마커로 교체.
              로테이션 태그와 한 줄에 나란히 서야 해서 짧게 "실시간"만 표기. */}
          <div
            className="inline-flex items-center gap-1 rounded-full flex-shrink-0"
            style={{ background: "rgba(255,255,255,.12)", padding: "5px 10px" }}
          >
            <span style={{ color: "#5EEAD4", fontSize: rem(11) }}>✔</span>
            <span className="font-bold" style={{ fontSize: rem(11), color: "rgba(255,255,255,.92)" }}>실시간 업데이트</span>
          </div>
          <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
        </div>

        {/* 2026-09-27: 헤드라인까지 네이비를 확장해 홈 히어로와 톤을 맞춤 —
            카테고리 그리드(흰 카드)부터는 다시 흰 배경으로 전환. */}
        {!alreadyMember && obStep === 1 && (
          <div style={{ padding: "2px 22px 22px" }}>
            <h2 className="font-display" style={{ fontSize: rem(23), color: "#fff", letterSpacing: "-0.02em" }}>
              어떤 상품을 찾고 계세요?
            </h2>
            <p className="mt-2" style={{ fontSize: rem(14.5), lineHeight: 1.6 }}>
              <span className="font-bold" style={{ color: "#fff" }}>🔔 고른 카테고리에 매물이 뜨면 빠르게 알려드려요.</span>{" "}
              <span style={{ color: "rgba(255,255,255,.7)" }}>여러 개 고를 수 있어요.</span>
            </p>
            {/* 2026-10-06: 이미 회원이면 로그인으로(보던 화면 returnTo 그대로) — 누르는 높이 44px */}
            <Link href={loginHref} className="inline-flex items-center gap-1" style={{ minHeight: 44, fontSize: rem(15), marginTop: 2 }}>
              <span style={{ color: "rgba(255,255,255,.78)", fontWeight: 600 }}>이미 회원이세요?</span>
              <span style={{ color: "#fff", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 4 }}>로그인</span>
            </Link>
          </div>
        )}
        {/* 2026-09-27: step1과 동일하게 네이비를 헤드라인까지 확장 — 일관성 유지. */}
        {!alreadyMember && obStep === 2 && (
          <div style={{ padding: "2px 22px 22px" }}>
            <h2 className="font-display" style={{ fontSize: rem(23), color: "#fff", letterSpacing: "-0.02em" }}>
              휴대폰 인증만 하면 끝이에요
            </h2>
            <p className="mt-2" style={{ fontSize: rem(14), lineHeight: 1.6, color: "rgba(255,255,255,.75)" }}>
              인증한 번호로 점핑매니저가 연락드려요
            </p>
            {/* 2026-10-06: 이미 회원이면 로그인으로(보던 화면 returnTo 그대로) — 누르는 높이 44px */}
            <Link href={loginHref} className="inline-flex items-center gap-1" style={{ minHeight: 44, fontSize: rem(15), marginTop: 2 }}>
              <span style={{ color: "rgba(255,255,255,.78)", fontWeight: 600 }}>이미 회원이세요?</span>
              <span style={{ color: "#fff", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 4 }}>로그인</span>
            </Link>
          </div>
        )}
      </div>

      <div className="flex-1" style={{ padding: alreadyMember ? "24px 22px 20px" : `24px 22px ${FLOATING_CTA_SPACE}px` }}>
        {alreadyMember ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "32px 6px 0" }}>
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 76, height: 76, background: "#E8F8EC", fontSize: rem(34) }}
            >
              ✔
            </div>
            <h2 className="font-display mt-4.5" style={{ fontSize: rem(23), color: "#0B2540", letterSpacing: "-0.02em" }}>
              이미 가입된 번호예요
            </h2>
            <p className="mt-2.5" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.7 }}>
              이 번호로 등록된 계정이 있어요.
              <br />
              기존 알림 조건 그대로 바로 이용하실 수 있습니다.
            </p>
            <div className="w-full rounded-2xl mt-5 text-left" style={{ background: "#F5F6F8", padding: "15px 16px" }}>
              <div className="text-xs font-bold" style={{ color: "#6B7480" }}>가입된 번호</div>
              <div className="mt-1 font-bold" style={{ fontSize: rem(16), color: "#0B2540", fontVariantNumeric: "tabular-nums" }}>
                {maskPhone(phone)}
              </div>
            </div>
            <button
              onClick={() => router.push(returnTo || "/")}
              className={`w-full mt-4.5 ${BTN_CLASS}`}
              style={btnStyle("primary")}
            >
              {returnTo ? "매물 보러 가기" : "내 조건 매물 보기"}
            </button>
            <button
              onClick={tryDifferentNumber}
              className="mt-2.5"
              style={{ background: "none", border: "none", color: "#6B7480", fontSize: rem(13.5), fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 4, padding: 10 }}
            >
              다른 번호로 가입하기
            </button>
          </div>
        ) : null}

        {!alreadyMember && obStep === 1 && (
          <div>
            {/* 헤드라인/서브카피는 위 네이비 히어로 블록으로 이동함 (2026-09-27) */}
            <div ref={categoryAreaRef} className="grid grid-cols-2 gap-2.5" style={{ scrollMarginTop: 16 }}>
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
                      style={{ width: 30, height: 30, fontSize: rem(15), background: categoryColors[c].bg }}
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
            {/* 2026-09-27: 13px+회색+밑줄이 겹쳐 너무 안 띄던 문제 — 카테고리명
                (text-sm≈14px) 수준으로 폰트만 키우고, 회색·밑줄은 유지해
                "보조 액션"이라는 시각적 위계는 그대로 둠. */}
            <button
              onClick={pickAllCategories}
              className="mt-4"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: rem(14), fontWeight: 700, color: "#6B7480", textDecoration: "underline", textUnderlineOffset: 4, padding: "8px 0" }}
            >
              아직 잘 모르겠어요 · 전체 받기 →
            </button>

          </div>
        )}

        {!alreadyMember && obStep === 2 && (
          <div>
            {/* 헤드라인/서브카피는 위 네이비 히어로 블록으로 이동함 (2026-09-27) */}
            <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>휴대폰 번호</div>
            <div className="flex gap-2">
              <input
                ref={phoneInputRef}
                type="tel"
                name="username"
                autoComplete="username"
                className="flex-1 min-w-0 rounded-xl outline-none"
                style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: rem(15), fontVariantNumeric: "tabular-nums" }}
                placeholder="010-0000-0000"
                inputMode="numeric"
                value={phone}
                disabled={verified}
                onChange={(e) => setPhone(formatPhoneTyping(e.target.value))}
              />
              {/* 2026-09-27: 형식이 안 맞을 때 버튼을 disabled로 막아버리면 클릭이
                  안 먹혀서 handleSendOtp의 "정확히 입력해주세요" 에러 메시지가 뜰
                  기회조차 없었음(눌러도 무반응으로 보임) — 전송 중/이미 인증완료일
                  때만 막고, 형식이 안 맞을 땐 흐리게만 보이되 클릭은 되게 해서
                  에러 메시지가 뜨도록 수정. */}
              <button
                onClick={handleSendOtp}
                disabled={otpSending || verified || resend.left > 0}
                className="flex-shrink-0 rounded-xl font-bold"
                style={{
                  border: "1.5px solid #0B2540",
                  background: "#fff",
                  padding: "0 15px",
                  fontSize: rem(13.5),
                  color: "#0B2540",
                  whiteSpace: "nowrap",
                  opacity: otpSending || verified || !isValidKoreanPhone(phone) ? 0.6 : 1,
                  ...(resend.left > 0 ? { background: "#F1F3F5", color: "#6B7480", borderColor: "#E4E7EB", opacity: 1 } : null),
                }}
              >
                {otpSending ? "발송 중..." : `${codeSent ? "다시 받기" : "인증번호 받기"}${resend.left > 0 ? ` (${resend.left}초)` : ""}`}
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
                  style={{ border: "1.5px solid var(--color-brandOrange)", padding: 14, fontSize: rem(20), letterSpacing: "0.32em" }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => onCodeChange(e.target.value)}
                  autoFocus
                />
                {otpError && <p className="text-sm font-medium mt-2" style={{ color: "#E5484D" }}>{otpError}</p>}
                {!otpError && (
                  <p className="mt-2" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.55 }}>
                    문자가 오지 않으면 스팸함을 확인하거나 &quot;다시 받기&quot;를 눌러주세요.
                  </p>
                )}
              </div>
            )}

            {/* 2026-10-05: 미인증 상태의 노란 안내 상자("인증된 번호로만 판매자 연락처를 열람…")는 잘못된 안내라 삭제.
                인증 완료(verified) 초록 확인 상자만 유지. */}
            {verified && (
              <div className="flex items-center gap-2.5 rounded-2xl mt-4.5" style={{ padding: "14px 16px", background: "#E8F8EC" }}>
                <span style={{ fontSize: rem(17) }}>📱</span>
                <span className="flex-1 text-xs font-bold" style={{ lineHeight: 1.5, color: "#2F9E44" }}>
                  ✔ 인증 완료
                </span>
              </div>
            )}

            {verified && (
              <div className="mt-4.5">
                <label className="text-sm font-bold mb-2 block" style={{ color: "#0B2540" }}>업체명 (선택)</label>
                <input
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4E7EB", padding: "13px 14px", fontSize: rem(15) }}
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

            {/* 2026-09-30: 동의 항목 정리 — 앱 푸시는 [선택] 매물 알림 수신 동의(광고성 정보)로 받고, 동의하면
                제출 때 알림 권한을 요청한다(예전엔 앱 푸시 토글이 필수 조건이었음). 카카오톡 채널 추가(친구 추가 링크)는
                마케팅 동의와 분리한 별도 토글(기본 꺼짐). 선택 항목은 모두 기본 false, 필수는 이용약관·개인정보 2개.
                동의 기록은 제출 때 /api/consents(member_consents, source signup)로 저장. */}
            <div ref={agreeAreaRef} className="mt-5 rounded-2xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB", scrollMarginTop: 16 }}>
              <button
                onClick={() => {
                  const all = allAgreed;
                  setAgreeTos(!all);
                  setAgreePrivacy(!all);
                  setAgreeEligibility(!all);
                  setAgreeDealAlert(!all);
                  setAgreeKakaoMkt(!all);
                }}
                className="flex items-center gap-2.5 w-full text-left"
                style={{ borderBottom: "1px solid #EEF0F2", background: "#FAFBFC", padding: "14px 15px" }}
              >
                <span
                  className="rounded-md flex items-center justify-center flex-shrink-0 text-white font-black"
                  style={{
                    width: 22,
                    height: 22,
                    fontSize: rem(13),
                    background: allAgreed ? "var(--color-brandOrange)" : "#fff",
                    border: allAgreed ? "1.5px solid var(--color-brandOrange)" : "1.5px solid #C9CFD6",
                  }}
                >
                  {allAgreed ? "✓" : ""}
                </span>
                <span className="text-sm font-bold" style={{ color: "#0B2540" }}>약관 전체 동의</span>
              </button>

              {[
                { key: "tos", label: CONSENT_TEXT.tos.label, tag: "필수", on: agreeTos, toggle: () => setAgreeTos(!agreeTos), href: CONSENT_TEXT.tos.href },
                { key: "privacy", label: CONSENT_TEXT.privacy.label, tag: "필수", on: agreePrivacy, toggle: () => setAgreePrivacy(!agreePrivacy), view: () => setViewingPrivacyText(true) },
                { key: "eligibility", label: CONSENT_TEXT.eligibility.label, tag: "필수", on: agreeEligibility, toggle: () => setAgreeEligibility(!agreeEligibility) },
                { key: "deal_alert_ad", label: CONSENT_TEXT.deal_alert_ad.label, desc: CONSENT_TEXT.deal_alert_ad.desc, tag: "선택", on: agreeDealAlert, toggle: () => setAgreeDealAlert(!agreeDealAlert) },
                { key: "kakao_marketing", label: CONSENT_TEXT.kakao_marketing.label, desc: CONSENT_TEXT.kakao_marketing.desc, tag: "선택", on: agreeKakaoMkt, toggle: () => setAgreeKakaoMkt(!agreeKakaoMkt) },
              ].map((a) => (
                <div key={a.key} className="flex items-start w-full" style={{ borderBottom: "1px solid #F1F3F5", background: "#fff" }}>
                  <button onClick={a.toggle} className="flex items-start gap-2.5 flex-1 min-w-0 text-left" style={{ padding: "12px 15px" }}>
                    <span
                      className="rounded flex items-center justify-center flex-shrink-0 text-white font-black"
                      style={{ width: 20, height: 20, marginTop: 1, fontSize: rem(12), background: a.on ? "var(--color-brandOrange)" : "#fff", border: a.on ? "1.5px solid var(--color-brandOrange)" : "1.5px solid #C9CFD6" }}
                    >
                      {a.on ? "✓" : ""}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span style={{ fontSize: rem(14), lineHeight: 1.45, color: a.on ? "#1A1F26" : "#6B7480" }}>
                        <b style={{ color: a.tag === "필수" ? "#E25100" : "#6B7480" }}>[{a.tag}]</b> {a.label}
                      </span>
                      {a.desc && (
                        <span className="block mt-1" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.5 }}>
                          {a.desc}
                        </span>
                      )}
                    </span>
                  </button>
                  {a.href && (
                    <a href={a.href} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 font-bold" style={{ fontSize: rem(14), color: "#9AA3AD", padding: "12px 15px 12px 4px" }}>
                      보기 ›
                    </a>
                  )}
                  {a.view && (
                    <button type="button" onClick={a.view} className="flex-shrink-0 font-bold" style={{ fontSize: rem(14), color: "#9AA3AD", padding: "12px 15px 12px 4px" }}>
                      보기 ›
                    </button>
                  )}
                </div>
              ))}
            </div>
            {viewingPrivacyText && <PrivacyConsentTextSheet onClose={() => setViewingPrivacyText(false)} />}

            {agreeDealAlert && pushBlocker && (
              <div className="mt-2">
                <PushBlockerNotice kind={pushBlocker} />
              </div>
            )}
            {agreeDealAlert && !pushBlocker && nonCanonicalHost && (
              <div className="text-xs rounded-xl mt-2 leading-relaxed" style={{ color: "#6B7480", background: "#F5F6F8", padding: "10px 14px" }}>
                이 주소에서는 알림을 켤 수 없어요. 정식 주소에서 알림을 켜주세요 →{" "}
                <a href={`${SITE_URL}/signup`} className="font-bold underline" style={{ color: "#E25100" }}>
                  {SITE_URL.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {agreeDealAlert && (
              <p className="mt-2" style={{ fontSize: rem(14), color: "#6B7480" }}>
                {myCondText} · 주간 약 {estAlerts}건
              </p>
            )}

            {/* 카카오톡 채널 추가 — 친구 추가 링크를 여는 것뿐이라 수신 동의와 별개 (기본 꺼짐) */}
            <button
              onClick={() => setKakao(!kakao)}
              className="w-full flex items-center gap-3 text-left rounded-2xl mt-3"
              style={{ padding: "13px 15px", background: "#fff", border: kakao ? "2px solid var(--color-toggleOn)" : "1.5px solid #E4E7EB" }}
            >
              <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, background: "#FEE500", fontSize: rem(16) }}>💬</span>
              <span className="flex-1">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold" style={{ color: "#0B2540", whiteSpace: "nowrap" }}>카카오톡 채널 추가</span>
                  <span className="text-xs font-bold" style={{ color: "#6B7480", whiteSpace: "nowrap" }}>[선택]</span>
                </span>
                <span className="block text-xs mt-0.5" style={{ color: "#6B7480" }}>
                  {kakao ? "가입 완료 때 채널 추가 화면이 열려요" : "공지·이벤트 소식을 카톡으로 받기"}
                </span>
              </span>
              <span className="rounded-full flex-shrink-0 relative" style={{ width: 42, height: 25, background: kakao ? "var(--color-toggleOn)" : "#D5D9DE", transition: "background .2s" }}>
                <span className="absolute rounded-full bg-white" style={{ top: 2, width: 19, height: 19, left: kakao ? 20 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
              </span>
            </button>

            <p className="mt-2.5" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.6 }}>
              맞춤 특가 알림은 앱 푸시로만 발송돼요. 카카오톡 채널은 공지·이벤트 소식용 보조 채널입니다.
            </p>
            <p className="mt-3" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.6 }}>
              개인정보는 회원 관리·매물 알림 발송·본인 확인에 사용하며, 탈퇴 시 관계 법령에 따라 보관하는 항목을 제외하고 지체 없이 파기합니다.
            </p>

            {pushStatus === "denied" && (
              <div className="text-sm rounded-lg mt-3" style={{ color: "var(--color-orange)", background: "var(--color-dangerBg)", padding: "12px 16px" }}>
                브라우저 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용해주세요.
              </div>
            )}
            {pushStatus === "noncanonical" && (
              <div className="text-sm rounded-lg mt-3 leading-relaxed" style={{ color: "#6B7480", background: "#F5F6F8", padding: "12px 16px" }}>
                정식 주소에서 알림을 켜주세요 →{" "}
                <a href={`${SITE_URL}/mypage`} className="font-bold underline" style={{ color: "#E25100" }}>
                  {SITE_URL.replace(/^https?:\/\//, "")}
                </a>
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
        // design-v2: bottom: 0으로 두면 AppShell의 fixed 하단 탭바(BottomNav, z-40)에
        // 이 영역이 가려서 탭바 높이만큼 띄움 — buy/sell과 같은 원인, 같은 수정.
        // 2026-09-26: position:sticky였는데 실제로는 전혀 안 떠 있던 버그 발견
        // (buy/sell과 동일 원인 — layout.tsx의 overflow-x-hidden 단독 설정이
        // overflow-y:auto로 계산되면서 의도치 않은 sticky 기준 컨테이너가 됐는데
        // 그 컨테이너 자체는 내부 스크롤이 발생한 적이 없어 sticky가 무력화됨).
        // fixed로 교체하고 위 콘텐츠에 paddingBottom 132px 추가.
        // 2026-09-27: 홈 하단 CTA와 동일한 톤으로 통일 — 불투명 흰 바+실선 테두리
        // 대신 반투명+블러 카드 + 상단 페이드로, 스크롤 중인 폼 내용이 자연스럽게
        // 이어지도록 함.
        // 2026-09-29: 공용 하단 고정 버튼(FloatingCTA) — 판·블러 없이 버튼만 띄움
        <FloatingCTA shakeKey={shakeKey}>
            {/* 2026-09-27: 비활성 상태에서 흰 텍스트+#C9CFD6 배경 조합이 명도 대비
                약 1.5:1(WCAG 최소 4.5:1)이라 "카테고리를 골라주세요" 문구가 거의
                안 보인다는 피드백 — 비활성일 때만 텍스트를 앱 표준 보조색
                gray500(#6B7480)로 바꿔 대비 약 3.3:1로 개선. */}
            {ctaNote && obCtaDisabled && (
              <div role="status">
                <FloatingCTANote tone="dark">{ctaNote}</FloatingCTANote>
              </div>
            )}
            {/* 비활성은 disabled 대신 aria-disabled — 눌러서 안내를 받게 함(색은 가입 화면 전용: 배경 #FFEDD5·글자 #9A3412 대비 6.38:1) */}
            <button
              onClick={onCtaPress}
              disabled={submitting}
              aria-disabled={obCtaDisabled}
              className={FLOATING_CTA_BUTTON_CLASS}
              style={obCtaDisabled ? { ...floatingCtaButtonStyle(true), background: "#FFEDD5", color: "#9A3412" } : floatingCtaButtonStyle()}
            >
              {submitting ? "처리 중..." : obCtaLabel}
            </button>
        </FloatingCTA>
      )}

      <Toast message={toastMessage} fitWidth bottom="calc(var(--nav-bottom) + 12px + 56px + 12px)" />
    </main>
  );
}
