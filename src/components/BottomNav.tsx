"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { HouseIcon, MagnifyingGlassIcon, BellIcon, HandshakeIcon, UserIcon } from "@phosphor-icons/react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const NAV_HEIGHT = 64;

// Flame(매물)만 lucide 유지 — 단일 도형이라 fill 전환에 문제없음.
// 나머지는 진짜 solid weight를 지원하는 phosphor-icons로 교체
// (lucide는 outline 전용이라 fill 강제 적용 시 아이콘이 깨짐 — Search/Bell/
// Handshake/User는 손잡이·추·어깨 등 선으로만 된 디테일이 사라져 버림).
const BASE_TABS = [
  { href: "/", label: "홈", icon: HouseIcon, lib: "phosphor" as const },
  { href: "/deals", label: "매물", icon: Flame, lib: "lucide" as const },
  { href: "/buy", label: "찾습니다", icon: MagnifyingGlassIcon, lib: "phosphor" as const },
];

const ALERT_TAB = { href: "/signup", label: "알림", icon: BellIcon, lib: "phosphor" as const };
const SHARE_TAB = { href: "/mypage#referral", label: "공유", icon: HandshakeIcon, lib: "phosphor" as const };
const MY_TAB = { href: "/mypage", label: "MY", icon: UserIcon, lib: "phosphor" as const };

export default function BottomNav() {
  const pathname = usePathname();
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setIsMember(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsMember(Boolean(session));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const TABS = [...BASE_TABS, isMember ? SHARE_TAB : ALERT_TAB, MY_TAB];

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray200 flex z-40"
      style={{ height: `${NAV_HEIGHT}px` }}
    >
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : (pathname ?? "").startsWith(tab.href.split("#")[0]);
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
              className="text-[11px] font-bold"
              style={{ color: active ? "#0B2540" : "#6B7480" }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
