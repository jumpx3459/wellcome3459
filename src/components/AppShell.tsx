"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import BottomNav, { NAV_HEIGHT } from "./BottomNav";
import DebugPanel from "./DebugPanel"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거

// 관리자 화면은 운영자 전용 도구라 회원용 하단 탭바를 보여주지 않습니다.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = (pathname ?? "").startsWith("/admin");

  // PWA 설치 배너(beforeinstallprompt)가 뜨려면 서비스워커가 등록돼 있어야 해서,
  // 회원가입(알림 신청) 완료를 기다리지 않고 첫 방문 때부터 바로 등록해둡니다.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // 회원용 화면은 모바일 폭(max-w-md)으로 고정. 관리자 화면은 PC 레이아웃(💻/자동)을
  // 쓰려면 이 폭 제한을 벗어나야 해서 전체 폭을 주고, 폭 제한은 admin/page.tsx가
  // 화면별로 직접 건다(로그인·모바일 모드는 max-w-md 유지).
  return (
    <div
      className={
        isAdmin
          ? "min-h-screen overflow-x-hidden"
          : "mx-auto max-w-md min-h-screen bg-white shadow-sm overflow-x-hidden"
      }
    >
      <div style={{ paddingBottom: isAdmin ? 0 : `${NAV_HEIGHT}px` }}>{children}</div>
      {!isAdmin && <BottomNav />}
      <DebugPanel />
    </div>
  );
}
