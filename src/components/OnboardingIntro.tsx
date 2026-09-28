"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";

const STORAGE_KEY = "dj_onboarded"; // "1" = 명시적 액션(가입 시작/로그인 이동/둘러보기)으로 닫음 — 영구 억제
const LAST_SHOWN_KEY = "dj_onboarding_last_shown"; // 버튼 없이 그냥 닫힌 경우 재노출 쿨다운 계산용
const RESHOW_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3일

// 2026-09-28: 예전엔 "17건 / 평균 41% / 3분" 고정값이었음 — 실제 값만 부모(page.tsx)에서 받아
// 표시하고, 기준 미달이거나 측정할 수 없는 항목(알림 속도)은 빠진다. 하나도 없으면 줄 자체를 숨김.
export type OnboardingStat = { value: string; label: string };

export default function OnboardingIntro({
  logoAnimate = false,
  isMember = false,
  stats = [],
}: {
  logoAnimate?: boolean;
  isMember?: boolean;
  stats?: OnboardingStat[];
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

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

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between text-white"
      style={{
        padding: "44px 26px 30px",
        background: "linear-gradient(155deg,#04101C 0%,#0B2540 58%,#14395C 100%)",
        overflowY: "auto",
      }}
    >
      <div>
        {/* 2026-09-26 (9): 로고와 890명 필이 세로로 쌓여 상단이 불필요하게 길어지고
            그만큼 캐릭터/통계가 아래로 밀려 위계가 흐트러진다는 피드백 — 한 줄로 배치. */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="bg-white rounded-2xl inline-block" style={{ padding: "10px 14px" }}>
              {/* 2026-09-27: 홈 헤더 로고와 동일한 문제 — 마운트 즉시 애니메이션이
                  걸려 스플래시(1.8초)에 가려진 채로 재생·종료됨. 스플래시가 실제로
                  사라지는 시점(logoAnimate)에야 클래스를 붙이도록 지연. */}
              <img
                src="/images/logo.png"
                alt="덤핑점핑"
                className={logoAnimate ? "animate-logo-jump" : ""}
                style={{ height: 34, width: "auto", display: "block" }}
              />
            </div>
            <div className="text-xs mt-2 tracking-wide" style={{ color: "rgba(255,255,255,.75)" }}>
              Powered by JumpX
            </div>
          </div>
          <div
            className="inline-flex items-center gap-1.5 rounded-full flex-shrink-0"
            style={{ background: "rgba(255,255,255,.12)", padding: "7px 13px", marginTop: 2 }}
          >
            {/* 2026-09-27 (재검토): 고정 숫자(890명)는 실제 가입자 수와 어긋날 수
                있는 하드코딩 값이라, 홈과 동일하게 숫자 없는 서술형 카피로 교체. */}
            <span className="text-xs" style={{ color: "#5EEAD4" }}>✔</span>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,.92)" }}>
              지금도 계속 새 매물이 올라와요
            </span>
          </div>
        </div>
        {/* design-v2: deals 헤더의 긴급성 로테이션 문구를 첫 진입 화면에도 노출해
            가입 전부터 각인 효과를 줌 (2026-09-26). */}
        <RotatingUrgencyTag className="mt-4" style={{ color: "var(--color-brandOrangeAccent)" }} />
        <h1
          className="font-display mt-4 leading-[1.45]"
          style={{ fontSize: 23, letterSpacing: "-0.02em", wordBreak: "keep-all" }}
        >
          <span style={{ color: "var(--color-brandOrange)" }}>남는 상품은 빠르게 알리고</span>
          <br />
          급한 상품은 남보다 먼저 잡으세요.
        </h1>
        <p className="mt-3.5" style={{ fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,.88)" }}>
          전국의 임박·과잉·폐업 재고와 &quot;이런 상품 찾습니다&quot; 요청을 가장 먼저 알려드립니다.
        </p>
      </div>

      {/* 2026-09-26 (9): 캐릭터가 96~170px로 작고 위쪽 여백만 넓어 화면 하단이
          휑해 보인다는 피드백 — 존재감을 키움. */}
      <div
        className="flex flex-1 items-end justify-center"
        style={{ minHeight: 0, paddingBottom: 6, overflow: "hidden" }}
      >
        <img
          src="/images/manager-cut.png"
          alt="점핑매니저"
          style={{
            height: "clamp(120px, 26vh, 220px)",
            width: "auto",
            maxHeight: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 14px 26px rgba(0,0,0,.5))",
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        {/* 2026-09-26 (9): 통계 카드가 CTA 버튼과 시각적 무게가 비슷해 캐릭터/CTA보다
            우선순위가 높아 보이던 문제 — 패딩·폰트를 줄여 보조 정보로 격하. */}
        {stats.length > 0 && (
        <div className="flex gap-1.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-xl text-center"
              style={{ background: "rgba(255,255,255,.08)", padding: "8px 8px" }}
            >
              <div className="font-mono text-sm font-bold" style={{ color: "var(--color-brandOrangeAccent)" }}>
                {s.value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.75)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
        )}
        <button
          onClick={startSignup}
          className="w-full font-bold rounded-2xl"
          style={{
            padding: "19px 0",
            background: "linear-gradient(135deg,#E25100,#FF6F0F)",
            fontSize: 18,
            boxShadow: "0 10px 24px rgba(226,81,0,.4)",
          }}
        >
          🔔 30초만에 알림 설정하기
        </button>
        <div className="flex items-center justify-center gap-1" style={{ padding: "2px 10px 0" }}>
          <button
            onClick={goToLogin}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.85)",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              padding: 8,
            }}
          >
            이미 가입했어요
          </button>
          <span style={{ color: "rgba(255,255,255,.35)", fontSize: 13 }}>·</span>
          <button
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.7)",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              padding: 8,
            }}
          >
            둘러보기
          </button>
        </div>
      </div>
    </div>
  );
}
