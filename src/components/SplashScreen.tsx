"use client";

import { useEffect, useState } from "react";

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // 2026-09-26: 기존엔 localStorage 플래그로 기기당 최초 1회만 노출했으나,
    // 네이티브 앱처럼 실행(재접속)할 때마다 브랜드 로고를 각인시키는 게
    // 낫다는 판단으로 변경. 이 컴포넌트는 "/" 진입(콜드 스타트) 시에만
    // 마운트되므로 SPA 내부 라우팅 중엔 재노출되지 않는다 — 짧은 1.8초 +
    // 건너뛰기 버튼으로 피로감을 낮춘다.
    const timer = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {children}
      {show && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "#0B2540" }}
        >
          <div className="bg-white rounded-2xl px-6 py-5 mb-3">
            <img src="/images/logo.png" alt="덤핑점핑" className="w-40 h-auto" />
          </div>

          <p className="text-white/80 text-lg font-bold tracking-wide mb-8">Powered by JumpX</p>

          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{
              border: "3px solid rgba(255,255,255,0.2)",
              borderTopColor: "#FF6F0F",
            }}
          />

          <p className="text-white/70 text-sm mt-5">덤핑정보 불러오는 중...</p>

          <button
            onClick={() => setShow(false)}
            className="absolute bottom-10 text-white/50 text-sm underline"
          >
            건너뛰기
          </button>
        </div>
      )}
    </>
  );
}
