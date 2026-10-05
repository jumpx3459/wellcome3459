"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { isStandalone } from "@/lib/browserEnv";
import { LINK_BASE } from "@/components/ReturningMemberIntro";

const STORAGE_KEY = "dj_onboarded"; // "1" = 명시적 액션(가입 시작/로그인 이동/둘러보기)으로 닫음 — 영구 억제
const LAST_SHOWN_KEY = "dj_onboarding_last_shown"; // 버튼 없이 그냥 닫힌 경우 재노출 쿨다운 계산용
const RESHOW_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3일

// 2026-10-05: 통계 칸("오늘 등록"·"평균 할인율") 삭제 → 진행 중 매물 수 한 줄만. 10건 이상일 때만 보여 줌
// (적은 숫자는 오히려 빈약해 보임). null = 로딩 중·불러오기 실패 → 줄 없음(자리도 안 차지).
export const ACTIVE_COUNT_MIN = 10;

export default function OnboardingIntro({
  logoAnimate = false,
  isMember = false,
  activeCount = null,
}: {
  logoAnimate?: boolean;
  isMember?: boolean;
  activeCount?: number | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  // 2026-10-03: 홈 화면에 추가한 앱(standalone)은 사파리와 저장소가 분리돼 로그인이 풀린 채 열림 —
  // 가입 권유 대신 "로그인하고 알림 켜기"(→ 로그인 뒤 MY 알림 카드)를 앞에 둔다.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => setStandalone(isStandalone()), []);

  useEffect(() => {
    if (isMember) {
      setVisible(false);
      return;
    }
    try {
      // 명시적 액션(가입 시작/로그인 이동/둘러보기)으로 닫은 적 있으면 영구 억제
      if (localStorage.getItem(STORAGE_KEY) === "1") return;

      // 2026-09-28: 버튼을 누르지 않고 그냥 닫아서(=결정을 못 내린 이탈) 위 영구
      // 플래그가 안 남은 방문자는, 완전히 기회를 잃지 않도록 일정 기간(3일) 후
      // 다시 한 번 보여줌. "둘러보기" 등 명시적으로 거절한 경우는 위에서 이미 걸러짐.
      const lastShown = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0);
      if (lastShown && Date.now() - lastShown < RESHOW_COOLDOWN_MS) return;

      setVisible(true);
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    } catch {
      // localStorage 접근 불가 시 온보딩 생략
    }
  }, [isMember]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setVisible(false);
  }

  function startSignup() {
    dismiss();
    router.push("/signup");
  }

  // 2026-09-27: "이미 가입했어요 · 둘러보기" 버튼 하나가 온보딩만 닫고 마케팅 홈을
  // 보여줬는데, 이미 가입한 사람 입장에선 다시 가입 유도 화면(무료 알림받기 CTA)이
  // 뜨는 셈이라 혼란스러움. 기존 회원 전용 경량 로그인(/login, 전화번호+OTP만
  // 물어보고 세션 있으면 재인증 없이 바로 /mypage로 보냄)으로 분리 연결.
  function goToLogin() {
    dismiss();
    router.push("/login");
  }

  function goToAlertLogin() {
    dismiss();
    router.push(`/login?returnTo=${encodeURIComponent("/mypage#alerts")}`);
  }

  if (!visible) return null;

  const showCount = activeCount !== null && activeCount >= ACTIVE_COUNT_MIN;

  return (
    // 2026-10-05: 재방문 화면(ReturningMemberIntro)과 같은 구성 — 위 남색 머리(내용만큼의 높이) + 아래 흰 영역(화면 맨 아래까지).
    // 흰 영역은 아래 기준: 하단 24px → 링크(44) → 22px → 주 버튼(52) → [10px ← 진행 중 매물 줄] → 12px → 캐릭터.
    // 캐릭터 = min(240px(줄 있으면 210px), 남는 높이 − 위 16px), 남는 공간은 캐릭터 위에만 생김.
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      style={{ overflowY: "auto" }}
      role="dialog"
      aria-modal="true"
      aria-label="덤핑점핑 시작하기"
    >
      <div
        data-intro-head
        className="flex-shrink-0 text-white"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
          paddingTop: "var(--sat)",
        }}
      >
        <div className="mx-auto w-full max-w-md" style={{ padding: "20px 22px 22px" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm flex-shrink-0">
              {/* 2026-09-27: 마운트 즉시 애니메이션이면 스플래시(1.8초)에 가려진 채로 끝남 — 스플래시가 사라질 때(logoAnimate) 붙임 */}
              <img
                src="/images/logo.png"
                alt="덤핑점핑"
                className={`h-7 w-auto block${logoAnimate ? " animate-logo-jump" : ""}`}
              />
            </div>
            {/* 2026-09-27: 고정 숫자(890명) 대신 숫자 없는 서술형 */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,.12)", padding: "7px 13px" }}
            >
              <span className="text-xs" style={{ color: "#5EEAD4" }}>✔</span>
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,.92)" }}>
                지금도 계속 새 매물이 올라와요
              </span>
            </div>
          </div>
          <RotatingUrgencyTag className="mt-3" style={{ color: "var(--color-brandOrangeAccent)" }} />
          <h1 className="font-display text-2xl mt-2 leading-[1.4]" style={{ wordBreak: "keep-all" }}>
            <span style={{ color: "var(--color-brandOrange)" }}>남는 상품은 빠르게 알리고</span>
            <br />
            급한 상품은 남보다 먼저 잡으세요.
          </h1>
          <p className="mt-2" style={{ fontSize: rem(15), lineHeight: 1.6, color: "rgba(255,255,255,.88)" }}>
            임박·과잉·폐업 재고를 가장 먼저 알려드려요.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 flex flex-col" style={{ padding: "0 22px calc(24px + var(--sab))", minHeight: 0 }}>
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <div className="absolute flex items-end justify-center" style={{ top: 16, left: 0, right: 0, bottom: 0 }}>
            <img
              src="/images/manager-cut.png"
              alt="점핑매니저"
              style={{ height: showCount ? 210 : 240, maxHeight: "100%", width: "auto", maxWidth: "100%", objectFit: "contain" }}
            />
          </div>
        </div>

        <div className="flex flex-col flex-shrink-0" style={{ marginTop: 12 }}>
          {showCount && (
            <p className="text-center" style={{ fontSize: rem(14), color: "#5B6470", marginBottom: 10 }}>
              지금 진행 중인 매물 <b style={{ color: "var(--color-brandOrange)", fontWeight: 800 }}>{activeCount}</b>건
            </p>
          )}
          <button
            type="button"
            onClick={standalone ? goToAlertLogin : startSignup}
            className={`w-full ${BTN_CLASS}`}
            style={btnStyle("primary")}
          >
            {standalone ? "🔔 로그인하고 알림 켜기" : "🔔 30초만에 알림 설정하기"}
          </button>
          <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 22 }}>
            <button type="button" onClick={standalone ? startSignup : goToLogin} style={{ ...LINK_BASE, color: "#0B2540", fontWeight: 700 }}>
              {standalone ? "처음이에요 · 가입하기" : "이미 가입했어요"}
            </button>
            <span aria-hidden style={{ color: "#9AA3AD", fontSize: rem(15) }}>·</span>
            <button type="button" onClick={dismiss} style={{ ...LINK_BASE, color: "#5B6470", fontWeight: 600 }}>
              둘러보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
