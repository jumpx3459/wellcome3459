"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { icon: "🔍", text: "전국의 임박·과잉 재고를\n가장 먼저 발견하고" },
  { icon: "🔔", text: "원하는 상품이 나오면\n가장 먼저 알려드려요" },
  { icon: "🧑‍✈️", text: "점핑매니저가\n판매자까지 직접 연결해드려요" },
];

const STORAGE_KEY = "dj_onboarded";
const STEP_DURATION = 1800;

export default function OnboardingIntro() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage 접근 불가 시 온보딩 생략
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (step >= STEPS.length - 1) {
      const t = setTimeout(finish, STEP_DURATION);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_DURATION);
    return () => clearTimeout(t);
  }, [visible, step]);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8"
      style={{ background: "#0B2540" }}
    >
      <button
        onClick={finish}
        className="absolute top-6 right-5 text-sm font-bold text-white/70"
      >
        건너뛰기 →
      </button>
      <div key={step} className="animate-onboarding-step flex flex-col items-center text-center gap-4">
        <span className="text-5xl">{STEPS[step].icon}</span>
        <p className="text-xl font-bold text-white leading-relaxed whitespace-pre-line">
          {STEPS[step].text}
        </p>
      </div>
      <div className="absolute bottom-10 flex gap-2">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: i === step ? "#F2891F" : "rgba(255,255,255,0.3)" }}
          />
        ))}
      </div>
    </div>
  );
}
