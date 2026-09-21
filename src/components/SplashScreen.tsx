"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dj_splash_shown_v1";

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // localStorage는 세션이 아니라 기기에 영구 저장되므로, 모바일 웹뷰에서
    // 뒤로가기·새로고침을 해도 "한 번 봤다"는 기록이 사라지지 않습니다.
    // 일부 미리보기(iframe) 환경은 저장소 접근 자체를 막기도 해서 try/catch로 감쌉니다.
    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        setShow(false);
        return;
      }
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 저장소 접근이 막힌 환경 — 이번 진입에서는 그냥 한 번 보여주고 넘어갑니다.
    }
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
