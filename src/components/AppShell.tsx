"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import InAppBanner from "./InAppBanner";
import AuthExpiredNotice from "./AuthExpiredNotice";
import DebugPanel from "./DebugPanel"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { markAppNavigation, markAppBack } from "@/lib/appNav";
import { supabase } from "@/lib/supabase";
import { markReturningMember } from "@/lib/returningMember";

// 관리자 화면은 운영자 전용 도구라 회원용 하단 탭바를 보여주지 않습니다.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = (pathname ?? "").startsWith("/admin");

  // 2026-09-28: 이 세션에서 실제로 화면 이동이 있었는지 기록 — 뒤로가기(←) 버튼들이
  // "앱 안에서 들어왔으면 이전 화면, 아니면 홈"을 판단하는 데 씀 (src/lib/appNav.ts 참고).
  // 최초 마운트(첫 진입) 때는 기록하지 않고, 그 이후 pathname이 바뀔 때만 기록.
  // popstate(브라우저/제스처 뒤로·앞으로가기)로 인한 이동은 depth를 오히려 줄여야
  // 하는데, pathname 변경 이펙트만으로는 이동 방향(앞으로 vs 뒤로)을 구분할 수
  // 없어서 popstate 리스너가 먼저 viaPopState 플래그를 세우고, pathname 이펙트가
  // 그 플래그를 보고 증가 대신 감소를 호출 — 그렇지 않으면 depth가 계속 쌓이기만
  // 해서 "뒤로 여러 번 눌러 첫 화면까지 온 뒤 다시 ←" 같은 경우 앱 밖으로 나갈 수 있음.
  const isFirstMount = useRef(true);
  const viaPopState = useRef(false);
  useEffect(() => {
    const onPopState = () => {
      viaPopState.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (viaPopState.current) {
      viaPopState.current = false;
      markAppBack();
    } else {
      markAppNavigation();
    }
  }, [pathname]);
  // 2026-09-27: 점핑파트너 영업용 데모 스킨(/p/[slug])은 실제 내비게이션이 있는
  // 앱 화면이 아니라 단일 랜딩 페이지라 하단 탭바가 어울리지 않음 — admin과
  // 동일하게 숨기되, 모바일 앱 미리보기 느낌은 유지하기 위해 폭 제한(max-w-md)은 유지.
  const isPartnerDemo = (pathname ?? "").startsWith("/p/");
  // 2026-09-29: 영문 소개 페이지(/en) — 앱 화면이 아닌 1페이지 소개라 하단 탭 없이 전체 폭
  const isEnglish = pathname === "/en" || (pathname ?? "").startsWith("/en/");
  // 인앱 브라우저 안내 배너는 유입이 몰리는 홈·매물 목록·매물 상세에만
  const showInAppBanner = pathname === "/" || pathname === "/deals" || (pathname ?? "").startsWith("/deals/");

  // PWA 설치 배너(beforeinstallprompt)가 뜨려면 서비스워커가 등록돼 있어야 해서,
  // 회원가입(알림 신청) 완료를 기다리지 않고 첫 방문 때부터 바로 등록해둡니다.
  // 2026-09-29: 로그인 세션이 확인되면 "이 기기에서 로그인한 적 있음" 플래그 — 나중에 세션이 풀린 채로
  // 오면 가입 온보딩 대신 재방문 화면(ReturningMemberIntro). 지우는 건 명시적 로그아웃·탈퇴 때만.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReturningMember();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) markReturningMember();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
        isAdmin || isEnglish
          ? "min-h-screen overflow-x-hidden"
          : "mx-auto max-w-md min-h-screen bg-white shadow-sm overflow-x-hidden"
      }
    >
      {showInAppBanner && <InAppBanner />}
      {/* iPhone 홈 화면 앱: 상태 표시줄 밑(black-translucent)을 네이비로 칠해 시계·배터리가 보이게 */}
      <div aria-hidden className="fixed top-0 left-0 right-0 z-50 pointer-events-none" style={{ height: "var(--sat)", background: "#0B2540" }} />
      <div
        style={{
          paddingTop: "var(--sat)",
          paddingBottom: isAdmin || isPartnerDemo || isEnglish ? "var(--sab)" : "var(--nav-bottom)",
        }}
      >
        {children}
      </div>
      {!isAdmin && !isPartnerDemo && !isEnglish && <BottomNav />}
      {/* 2026-09-29: 토큰 갱신 후에도 401이면 "다시 로그인해주세요" (authFetch가 이벤트 발생) */}
      <AuthExpiredNotice />
      <DebugPanel />
    </div>
  );
}
