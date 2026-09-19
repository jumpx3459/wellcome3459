"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Flame, Search, Bell, Handshake, User } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const NAV_HEIGHT = 64;

const BASE_TABS = [
  { href: "/", label: "홈", icon: Home },
  { href: "/deals", label: "매물", icon: Flame },
  { href: "/buy", label: "찾습니다", icon: Search },
];

const ALERT_TAB = { href: "/signup", label: "알림", icon: Bell };
const SHARE_TAB = { href: "/mypage#referral", label: "공유", icon: Handshake };
const MY_TAB = { href: "/mypage", label: "MY", icon: User };

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
            <tab.icon className="w-5 h-5" strokeWidth={2.25} style={{ opacity: active ? 1 : 0.45 }} />
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
