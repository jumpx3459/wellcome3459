"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/format";

export default function CountdownBadge({
  closesAt,
  size = "sm",
}: {
  closesAt: string;
  size?: "sm" | "lg";
}) {
  // 서버 렌더링 시각과 브라우저 표시 시각이 달라 숫자가 어긋나는 하이드레이션 에러를
  // 막기 위해, 처음에는 계산하지 않고 마운트 이후(클라이언트에서만) 실제 값을 채웁니다.
  const [state, setState] = useState<{ label: string; urgent: boolean } | null>(null);

  useEffect(() => {
    setState(formatCountdown(closesAt));
    const id = setInterval(() => setState(formatCountdown(closesAt)), 1000);
    return () => clearInterval(id);
  }, [closesAt]);

  const label = state?.label ?? "--:--:--";

  if (size === "lg") {
    return (
      <div className="bg-dangerBg rounded-2xl px-4 py-4 flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: "var(--color-urgent)" }}>⏱ 마감까지</span>
        <span className="text-2xl font-black font-mono" style={{ color: "var(--color-urgent)" }}>{label}</span>
      </div>
    );
  }

  return (
    <span
      className="text-xs font-bold text-white px-2.5 py-1.5 rounded-full flex items-center gap-1"
      style={{ background: "var(--color-urgent)" }}
    >
      ⏱ {label}
    </span>
  );
}
