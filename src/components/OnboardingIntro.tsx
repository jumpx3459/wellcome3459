"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";

const STORAGE_KEY = "dj_onboarded";

const STATS = [
  { value: "17건", label: "오늘 등록" },
  { value: "평균 41%", label: "할인율" },
  { value: "3분", label: "평균 알림 속도" },
];

export default function OnboardingIntro() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage 접근 불가 시 온보딩 생략
    }
  }, []);

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
              <img src="/images/logo.png" alt="덤핑점핑" className="animate-logo-jump" style={{ height: 34, width: "auto", display: "block" }} />
            </div>
            <div className="text-xs mt-2 tracking-wide" style={{ color: "rgba(255,255,255,.75)" }}>
              Powered by JumpX
            </div>
          </div>
          <div
            className="inline-flex items-center gap-1.5 rounded-full flex-shrink-0"
            style={{ background: "rgba(255,255,255,.12)", padding: "7px 13px", marginTop: 2 }}
          >
            <span className="text-xs" style={{ color: "#5EEAD4" }}>✔</span>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,.92)" }}>
              890명+ 덤핑재고 알림 받는 중
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
          <span style={{ color: "var(--color-brandOrange)" }}>남는 재고는 빠르게 알리고</span>
          <br />
          급한 재고는 남보다 먼저 잡으세요.
        </h1>
        <p className="mt-3.5" style={{ fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,.88)" }}>
          전국의 임박·과잉·폐업 재고와 &quot;이런 재고 찾습니다&quot; 요청을 가장 먼저 알려드립니다.
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
        <div className="flex gap-1.5">
          {STATS.map((s) => (
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
        <button
          onClick={dismiss}
          className="text-center"
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,.7)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "underline",
            textUnderlineOffset: 4,
            padding: 10,
          }}
        >
          이미 가입했어요 · 둘러보기
        </button>
      </div>
    </div>
  );
}
