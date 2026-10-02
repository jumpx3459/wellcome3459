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

export default function Toast({ message }: { message: string | null }) {
  return (
    <div
      aria-live="polite"
      className="fixed left-1/2 z-50 pointer-events-none transition-opacity duration-300"
      style={{ bottom: "80px", transform: "translateX(-50%)", opacity: message ? 1 : 0 }}
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
