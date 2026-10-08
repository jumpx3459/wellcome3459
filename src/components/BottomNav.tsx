"use client";

import TabLink from "@/components/TabLink";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { withReturnTo } from "@/lib/safeReturnTo";

export const NAV_HEIGHT = 64;
// 하단 탭 위에 붙는 고정 요소의 bottom 값 — 탭 높이 + iPhone 홈 인디케이터 (globals.css --nav-bottom)
export const NAV_BOTTOM = "var(--nav-bottom)";

// 2026-10-09 4b-2: 아이콘을 Microsoft Fluent Emoji 3D PNG(MIT, public/icons/nav/LICENSE)로 — 이모지 문자는 기기마다 모양이 달라 쓰지 않음.
// 96×96 파일을 30×30 칸(안 여백 2px, 모서리 10px)에 표시. 현재 탭: 이름 #ea580c 800 + 아이콘 뒤 바탕 #ffedd5
const NAV_ICON = (name: string) => `/icons/nav/${name}.png`;
const BASE_TABS = [
  { href: "/", label: "홈", icon: NAV_ICON("home") },
  { href: "/deals", label: "매물", icon: NAV_ICON("deals") },
  { href: "/buy", label: "찾습니다", icon: NAV_ICON("buy") },
];

// 2026-10-04 4.5: 비회원 4번째 탭 "알림" → "가입" — 관심있어요(번호 입력)와 알림을 헷갈리지 않게 가입 경로를 하나로
// 비회원 "가입" 탭 아이콘은 지시 5종 밖이라 같은 Fluent 3D의 Memo(가입서 쓰기)
const SIGNUP_TAB = { href: "/signup", label: "가입", icon: NAV_ICON("signup") };
const SHARE_TAB = { href: "/mypage#referral", label: "공유", icon: NAV_ICON("share") };
const MY_TAB = { href: "/mypage", label: "MY", icon: NAV_ICON("my") };

type Tab = { href: string; label: string; icon: string };

export default function BottomNav() {
  const pathname = usePathname();
  // 2026-09-28: 세션 확인 전엔 "unknown" — 예전엔 초기값 false라 회원도 잠깐 "알림"(지금은 "가입") 탭이
  // 보였다가 "공유"로 바뀌었음. 확인 전엔 4번째 칸을 중립 자리표시로 둔다.
  const [auth, setAuth] = useState<"unknown" | "member" | "guest">(isSupabaseConfigured ? "unknown" : "guest");
  // usePathname엔 #이 없어서 해시를 따로 추적 (/mypage#referral에서만 "공유" 활성)
  const [hash, setHash] = useState("");
  // 비회원 "가입" 탭이 지금 보던 화면(매물 상세 등)으로 돌아오게 returnTo에 붙일 쿼리 — useSearchParams는 루트 레이아웃에서
  // Suspense 없이 쓰면 빌드가 깨져서 경로가 바뀔 때 window에서 직접 읽음
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session ? "member" : "guest");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? "member" : "guest");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sync = () => {
      setHash(window.location.hash);
      // 가입 후 자동 관심 기록이 따라가지 않게 autoInterest는 returnTo에서 뺌(옛 링크로 들어온 경우)
      const q = new URLSearchParams(window.location.search);
      q.delete("autoInterest");
      const qs = q.toString();
      setSearch(qs ? `?${qs}` : "");
    };
    // 경로가 바뀔 때마다 현재 해시 반영. Next Link의 같은 페이지 해시 이동은 hashchange가 안 날 수 있어
    // 탭 클릭 시에도 직접 갱신한다(아래 onClick).
    const t = setTimeout(sync, 0);
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [pathname]);

  const path = pathname ?? "";
  const shareActive = path === "/mypage" && hash === "#referral";
  const isActive = (tab: Tab) => {
    if (tab.href === "/") return path === "/";
    if (tab === SHARE_TAB) return shareActive;
    if (tab === MY_TAB) return path.startsWith("/mypage") && !shareActive;
    return path.startsWith(tab.href.split(/[#?]/)[0]);
  };

  const signupTab = { ...SIGNUP_TAB, href: withReturnTo("/signup", `${path}${search}`) };
  const fourth = auth === "member" ? SHARE_TAB : auth === "guest" ? signupTab : null;
  const TABS: (Tab | null)[] = [...BASE_TABS, fourth, MY_TAB];

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray200 flex z-40"
      style={{ height: "var(--nav-bottom)", paddingBottom: "var(--sab)" }}
    >
      {TABS.map((tab, i) => {
        if (!tab) {
          return (
            <div key={`placeholder-${i}`} className="flex-1 flex flex-col items-center justify-center gap-1" aria-hidden>
              <span className="bg-gray200" style={{ width: 30, height: 30, borderRadius: 10 }} />
              <span className="rounded bg-gray200" style={{ width: 22, height: 8 }} />
            </div>
          );
        }
        const active = isActive(tab);
        return (
          <TabLink
            key={tab.href}
            href={tab.href}
            onClick={() => setHash(tab.href.includes("#") ? `#${tab.href.split("#")[1]}` : "")}
            className="flex-1 flex flex-col items-center justify-center gap-0.5"
            aria-current={active ? "page" : undefined}
            data-nav-active={active ? "1" : undefined}
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 30, height: 30, padding: 2, borderRadius: 10, background: active ? "#ffedd5" : "transparent" }}
            >
              <img src={tab.icon} alt="" width={26} height={26} draggable={false} style={{ width: 26, height: 26, display: "block" }} />
            </span>
            <span style={{ fontSize: rem(13), fontWeight: active ? 800 : 700, color: active ? "#ea580c" : "#475569", lineHeight: 1.2 }}>
              {tab.label}
            </span>
          </TabLink>
        );
      })}
    </nav>
  );
}
