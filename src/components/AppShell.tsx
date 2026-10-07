"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import InAppBanner from "./InAppBanner";
import InAppExternalGate from "./InAppExternalGate";
import AuthExpiredNotice from "./AuthExpiredNotice";
import ConsentGate from "./ConsentGate";
import ActiveDayPing from "./ActiveDayPing";
import UpdateBanner from "./UpdateBanner";
import DebugPanel from "./DebugPanel"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { noteRouteChange, consumeReplaceFlag } from "@/lib/appNav";
import { supabase } from "@/lib/supabase";
import { markReturningMember } from "@/lib/returningMember";
import { saveRefFromSearch } from "@/lib/refStore";

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
  // 2026-10-01 PR-C: 시트·모달 뒤로가기(같은 주소의 popstate)는 pathname이 안 바뀌어 플래그가 남던 문제 —
  // popstate가 도착한 주소를 기억해 두고, 바뀐 pathname과 같을 때만 "뒤로가기로 온 이동"으로 봄.
  // replace 이동(navReplace — 하단 탭끼리·해시·홈)은 기록이 안 쌓였으니 세지 않음. (src/lib/appNav.ts)
  const isFirstMount = useRef(true);
  const popPath = useRef<string | null>(null);
  useEffect(() => {
    const onPopState = () => {
      popPath.current = window.location.pathname;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    const path = pathname ?? "";
    if (isFirstMount.current) {
      isFirstMount.current = false;
      noteRouteChange(path, "first");
      return;
    }
    const viaPop = popPath.current === path;
    popPath.current = null;
    noteRouteChange(path, viaPop ? "pop" : consumeReplaceFlag() ? "replace" : "push");
  }, [pathname]);
  // 2026-10-07: 어떤 페이지든 ?ref=CODE로 들어오면 기기에 저장(30일) — 홈 CTA·재방문 링크·탭·로그인↔가입으로 가도 가입 때 반영 (src/lib/refStore.ts)
  // 로그인한 회원은 저장하지 않음 — 가입 뒤 returnTo(?ref= 포함)로 돌아와도 방금 지운 값이 다시 저장되지 않게
  useEffect(() => {
    if (!window.location.search.includes("ref=")) return;
    let cancelled = false;
    (async () => {
      let loggedIn = false;
      try {
        if (supabase) loggedIn = Boolean((await supabase.auth.getSession()).data.session?.user);
      } catch {}
      if (!cancelled && !loggedIn) saveRefFromSearch(window.location.search);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  // 2026-09-27: 점핑파트너 영업용 데모 스킨(/p/[slug])은 실제 내비게이션이 있는
  // 앱 화면이 아니라 단일 랜딩 페이지라 하단 탭바가 어울리지 않음 — admin과
  // 동일하게 숨기되, 모바일 앱 미리보기 느낌은 유지하기 위해 폭 제한(max-w-md)은 유지.
  const isPartnerDemo = (pathname ?? "").startsWith("/p/");
  const isSellPage = pathname === "/sell";
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
    // 2026-10-01 fix/form-overflow: overflow-x-hidden은 이 div를 스크롤 영역으로 만들어, 화면보다 넓은 요소가 있으면
    // 입력칸을 누를 때 브라우저가 이 div를 옆으로 스크롤(왼쪽 흰 띠·오른쪽 잘림·흔들림). clip은 스크롤 영역이 아니라
    // 옆으로 밀릴 수 없음 — 지원 안 하는 옛 브라우저는 인라인 값이 무시되고 class의 hidden이 적용됨.
    // /sell은 PC에서 폼을 넓게 쓰도록 이 칸도 넓힘(sm 680px · lg 1160px — 2026-10-02 lg 2단, 내용 1120px). 하단 탭·고정 버튼은 그대로 가운데 448px.
    <div
      className={
        isAdmin || isEnglish
          ? "min-h-screen overflow-x-hidden"
          : `mx-auto max-w-md min-h-screen bg-white shadow-sm overflow-x-hidden${isSellPage ? " sm:max-w-[680px] lg:max-w-[1160px]" : ""}`
      }
      style={{ overflowX: "clip" }}
    >
      {showInAppBanner && <InAppBanner />}
      {/* 2026-10-07: 인앱 브라우저로 가입·로그인에 들어오면 바깥 브라우저로 먼저 안내(진입 한 곳) */}
      {(pathname === "/signup" || pathname === "/login") && <InAppExternalGate />}
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
      {/* 2026-09-30: 기존 회원 약관 재동의 시트 + 동의/철회 직후 안내 */}
      <ConsentGate />
      {/* 2026-09-30 (커밋 K): 회원 방문 기록 — 한국 날짜 하루 1번 (member_active_days) */}
      {!isAdmin && <ActiveDayPing />}
      {/* 2026-10-06: 배포 뒤 옛 화면이 남아 있으면 "새 버전이 있어요 [새로고침]" — 하단 탭 위(탭 없는 화면은 안전 영역 위) */}
      <UpdateBanner bottom={isAdmin || isPartnerDemo || isEnglish ? "calc(var(--sab) + 12px)" : "calc(var(--nav-bottom) + 12px)"} />
      <DebugPanel />
    </div>
  );
}
