"use client";

import TabLink from "@/components/TabLink";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { HouseIcon, MagnifyingGlassIcon, UserPlusIcon, HandshakeIcon, UserIcon } from "@phosphor-icons/react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { withReturnTo } from "@/lib/safeReturnTo";

export const NAV_HEIGHT = 64;
// 하단 탭 위에 붙는 고정 요소의 bottom 값 — 탭 높이 + iPhone 홈 인디케이터 (globals.css --nav-bottom)
export const NAV_BOTTOM = "var(--nav-bottom)";

// Flame(매물)만 lucide 유지 — 단일 도형이라 fill 전환에 문제없음.
// 나머지는 진짜 solid weight를 지원하는 phosphor-icons로 교체
// (lucide는 outline 전용이라 fill 강제 적용 시 아이콘이 깨짐 — Search/Bell/
// Handshake/User는 손잡이·추·어깨 등 선으로만 된 디테일이 사라져 버림).
const BASE_TABS = [
  { href: "/", label: "홈", icon: HouseIcon, lib: "phosphor" as const },
  { href: "/deals", label: "매물", icon: Flame, lib: "lucide" as const },
  { href: "/buy", label: "찾습니다", icon: MagnifyingGlassIcon, lib: "phosphor" as const },
];

// 2026-10-04 4.5: 비회원 4번째 탭 "알림" → "가입" — 관심있어요(번호 입력)와 알림을 헷갈리지 않게 가입 경로를 하나로
const SIGNUP_TAB = { href: "/signup", label: "가입", icon: UserPlusIcon, lib: "phosphor" as const };
const SHARE_TAB = { href: "/mypage#referral", label: "공유", icon: HandshakeIcon, lib: "phosphor" as const };
const MY_TAB = { href: "/mypage", label: "MY", icon: UserIcon, lib: "phosphor" as const };

type Tab = (Omit<typeof MY_TAB, "href"> & { href: string }) | (typeof BASE_TABS)[number];

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
              <span className="w-5 h-5 rounded-full bg-gray200" />
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
          >
            {tab.lib === "phosphor" ? (
              <tab.icon
                weight="fill"
                className={active ? "w-5 h-5 text-brandOrange" : "w-5 h-5 text-gray500"}
              />
            ) : (
              <tab.icon
                fill="currentColor"
                strokeWidth={0}
                className={active ? "w-5 h-5 text-brandOrange" : "w-5 h-5 text-gray500"}
              />
            )}
            <span
              className="font-bold"
              style={{ fontSize: rem(14), color: active ? "#0B2540" : "#4B5563" }}
            >
              {tab.label}
            </span>
          </TabLink>
        );
      })}
    </nav>
  );
}
