"use client";

import { useEffect, useRef } from "react";

// 2026-10-07: 하단 고정 버튼(FloatingCTA)의 "눌렀는데 막힘" 흔들림(0.35초) — 가입 화면(2026-10-05)에서 쓰던 동작을 공용으로 옮김.
// shakeKey가 바뀔 때마다 한 번 흔든다(0은 흔들지 않음). prefers-reduced-motion이면 흔들지 않음.
// 보이지 않는 표시 요소만 그리고 부모(고정 틀) 안의 버튼을 찾아 흔든다 — FloatingCTAMeasure와 같은 방식.
export default function FloatingCTAShake({ shakeKey }: { shakeKey: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!shakeKey) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const btn = ref.current?.parentElement?.querySelector("button, a");
    btn?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 350, easing: "ease-in-out" },
    );
  }, [shakeKey]);
  return <span ref={ref} hidden />;
}
