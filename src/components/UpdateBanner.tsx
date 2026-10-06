"use client";

import { useEffect, useRef, useState } from "react";
import { rem } from "@/lib/rem";

// 2026-10-06 새 버전 띠 — 설치 앱을 백그라운드에서 다시 열면 메모리의 옛 화면(옛 JS)이 그대로 남음.
// 화면이 다시 보일 때(visibilitychange) 최대 60초에 1번 /api/version과 이 화면의 빌드 값(next.config.ts APP_BUILD_SHA)을 비교,
// 다르면 하단에 "새 버전이 있어요 [새로고침]". 자동 새로고침은 하지 않음(입력 중 내용 보호). 빌드 값이 "dev"면 비교 안 함.
const CURRENT = process.env.APP_BUILD_SHA || "dev";
const MIN_INTERVAL_MS = 60 * 1000;

export default function UpdateBanner({ bottom }: { bottom: string }) {
  const [stale, setStale] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (CURRENT === "dev") return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheck.current < MIN_INTERVAL_MS) return;
      lastCheck.current = now;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (version && version !== "dev" && version !== CURRENT) setStale(true);
      } catch {}
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  if (!stale) return null;
  return (
    <div className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none" style={{ bottom, padding: "0 12px" }}>
      <div
        role="status"
        data-update-banner
        className="pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-2xl"
        style={{ background: "#111827", color: "#fff", padding: "8px 8px 8px 16px", boxShadow: "0 6px 20px rgba(0,0,0,.18)" }}
      >
        <span className="flex-1 min-w-0 font-bold" style={{ fontSize: rem(15) }}>
          새 버전이 있어요
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex-shrink-0 font-extrabold rounded-xl"
          style={{ minHeight: 44, padding: "0 16px", background: "#fff", color: "#111827", fontSize: rem(15) }}
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
