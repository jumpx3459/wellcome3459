"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { navTab } from "@/lib/appNav";

// 2026-10-01 PR-C: 하단 탭·로고(홈)·해시 이동(/mypage#referral 등) 링크 — 기록을 쌓지 않는 이동(src/lib/appNav.ts navTab).
// 매물 상세 등 화면 "들어가기"는 그냥 Link(push)를 쓸 것. 새 탭 열기(Ctrl·⌘·가운데 클릭)는 기본 동작 그대로.
export default function TabLink({ href, onClick, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navTab(router, href);
      }}
    />
  );
}
