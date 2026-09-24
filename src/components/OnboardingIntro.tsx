"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
        padding: "56px 26px 30px",
        background: "linear-gradient(155deg,#04101C 0%,#0B2540 58%,#14395C 100%)",
        overflowY: "auto",
      }}
    >
      <div>
        <div className="bg-white rounded-2xl inline-block" style={{ padding: "10px 14px" }}>
          <img src="/images/logo.png" alt="덤핑점핑" className="animate-logo-jump" style={{ height: 34, width: "auto", display: "block" }} />
        </div>
        <div className="text-xs mt-2 tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>
          Powered by JumpX
        </div>
        <div
          className="inline-flex items-center gap-1.5 rounded-full mt-8"
          style={{ background: "rgba(255,255,255,.12)", padding: "7px 13px" }}
        >
          <span className="text-xs" style={{ color: "#5EEAD4" }}>✔</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,.92)" }}>
            890명+ 덤핑재고 알림 받는 중
          </span>
        </div>
        <h1
          className="font-display mt-4 leading-[1.45]"
          style={{ fontSize: 23, letterSpacing: "-0.02em", wordBreak: "keep-all" }}
        >
          <span style={{ color: "var(--color-brandOrange)" }}>남는 재고는 빠르게 알리고</span>
          <br />
          급한 재고는 남보다 먼저 잡으세요.
        </h1>
        <p className="mt-3.5" style={{ fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,.82)" }}>
          전국의 임박·과잉·폐업 재고와 &quot;이런 재고 찾습니다&quot; 요청을 가장 먼저 알려드립니다.
        </p>
      </div>

      <div
        className="flex flex-1 items-end justify-center"
        style={{ minHeight: 0, paddingBottom: 6, overflow: "hidden" }}
      >
        <img
          src="/images/manager-cut.png"
          alt="점핑매니저"
          style={{
            height: "clamp(96px, 20vh, 170px)",
            width: "auto",
            maxHeight: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 14px 26px rgba(0,0,0,.5))",
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-xl text-center"
              style={{ background: "rgba(255,255,255,.08)", padding: "12px 10px" }}
            >
              <div className="font-mono text-lg font-bold" style={{ color: "var(--color-brandOrangeAccent)" }}>
                {s.value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.65)" }}>
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
            color: "rgba(255,255,255,.6)",
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
