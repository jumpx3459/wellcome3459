"use client";

import { useEffect, useState } from "react";

/** 짧은 메시지를 잠깐 띄웠다가 자동으로 사라지게 하는 토스트 훅 */
export function useToast(duration = 2200) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  return { message, showToast: setMessage };
}

// bottom: 기본 80px(그대로). 하단 고정 버튼이 있는 화면(가입)만 버튼 위 값을 넘김.
// fitWidth: 기본은 화면 절반(left:50%)에 갇혀 좁은 화면에서 여러 줄로 꺾이므로, 가입 화면만 글자 길이만큼 펼침(최대 화면 폭-32px).
export default function Toast({ message, bottom = "80px", fitWidth = false }: { message: string | null; bottom?: string; fitWidth?: boolean }) {
  return (
    <div
      aria-live="polite"
      className="fixed left-1/2 z-50 pointer-events-none transition-opacity duration-300"
      style={{ bottom, transform: "translateX(-50%)", opacity: message ? 1 : 0, ...(fitWidth ? { width: "max-content", maxWidth: "calc(100vw - 32px)" } : {}) }}
    >
      <div
        className="text-white text-sm font-bold rounded-full px-5 py-3 shadow-lg text-center max-w-[calc(100vw-32px)] break-keep"
        style={{ background: "rgba(11,37,64,0.92)" }}
      >
        {message || ""}
      </div>
    </div>
  );
}
