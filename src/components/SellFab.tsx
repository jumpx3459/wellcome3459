"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rem } from "@/lib/rem";
import { FAB_BANNER_FULL_RATIO, fabHidden } from "@/lib/fabScroll";

// 떠 있는 "＋ 매물 등록" 버튼 (2026-10-09 4b-2) — 회원 홈(AlertInboxHome)·/deals에서만 그림(다른 화면엔 넣지 않음).
// 앱 틀(max-w-md 448px) 오른쪽 14px · 하단 탭 위 14px(--nav-bottom이 safe-area 포함). 하단 탭(z-40)보다 위.
// 쓰는 화면은 목록 맨 아래에 90px 여백을 둬서 마지막 카드가 이 버튼에 가리지 않게 할 것. 링크는 주황 배너 [무료 등록]과 같은 /sell
// 2026-10-10 대표 확정: 스크롤 방향과 관계없이 항상 표시. 유일한 예외 — 같은 화면 주황 배너의 [무료 등록] 버튼이 화면에 다 보일 때만 숨김
//   (IntersectionObserver, 조금이라도 벗어나면 표시 · 규칙은 src/lib/fabScroll.ts). 배너가 없는 화면·상태면 항상 표시.
//   숨김·표시는 0.25초 transform·opacity 전환, 동작 줄이기 설정이면 전환 없이 바로.
export const SELL_FAB_HREF = "/sell";
export const SELL_BANNER_SELECTOR = "[data-sell-banner]";
export const SELL_BANNER_BUTTON_SELECTOR = "[data-sell-banner-button]";

export default function SellFab() {
  const [hidden, setHidden] = useState(true); // 첫 그림은 숨김(배너가 보통 첫 화면에 있음) — 확인 뒤 바로 맞춤

  useEffect(() => {
    const target = document.querySelector(SELL_BANNER_BUTTON_SELECTOR) ?? document.querySelector(SELL_BANNER_SELECTOR);
    if (!target || typeof IntersectionObserver === "undefined") {
      setHidden(false);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        setHidden(fabHidden(e.isIntersecting ? e.intersectionRatio : 0));
      },
      { threshold: [0, FAB_BANNER_FULL_RATIO, 1] }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <Link
      href={SELL_FAB_HREF}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className="fixed z-[45] inline-flex items-center justify-center rounded-full text-white whitespace-nowrap transition-[transform,opacity] duration-[250ms] ease-out motion-reduce:transition-none"
      style={{
        right: "max(14px, calc((100vw - 448px) / 2 + 14px))",
        bottom: "calc(var(--nav-bottom) + 14px)",
        height: 48,
        padding: "0 18px",
        background: "#f97316",
        fontSize: rem(17),
        fontWeight: 800,
        boxShadow: "0 6px 16px rgba(249,115,22,.45)",
        opacity: hidden ? 0 : 1,
        transform: hidden ? "translateY(24px)" : "none",
        pointerEvents: hidden ? "none" : undefined,
      }}
      data-sell-fab
      data-fab-hidden={hidden ? "1" : undefined}
    >
      ＋ 매물 등록
    </Link>
  );
}
