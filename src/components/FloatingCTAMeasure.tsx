"use client";

import { useEffect, useRef } from "react";

// 2026-10-03: 하단 고정 버튼(FloatingCTA)의 실제 높이를 --floating-cta-h(px, 하단 탭과의 간격 포함)로 알림.
// 버튼 아래 안내 알약·큰 글자 설정으로 버튼 묶음이 고정값(FLOATING_CTA_SPACE)보다 커지면 본문 끝이 가려졌음 —
// 본문 아래 여백은 FLOATING_CTA_SPACE_FIT(이 변수 + 여유)로. 보이지 않는 표시 요소만 그리고, 부모(고정 틀)를 잰다.
export default function FloatingCTAMeasure({ gap }: { gap: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--floating-cta-h", `${Math.ceil(box.getBoundingClientRect().height) + gap}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--floating-cta-h");
    };
  }, [gap]);
  return <span ref={ref} hidden />;
}
