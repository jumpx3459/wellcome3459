"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rem } from "@/lib/rem";
import { nextFabScrollState } from "@/lib/fabScroll";

// 떠 있는 "＋ 매물 등록" 버튼 (2026-10-09 4b-2) — 회원 홈(AlertInboxHome)·/deals에서만 그림(다른 화면엔 넣지 않음).
// 앱 틀(max-w-md 448px) 오른쪽 14px · 하단 탭 위 14px(--nav-bottom이 safe-area 포함). 하단 탭(z-40)보다 위.
// 쓰는 화면은 목록 맨 아래에 90px 여백을 둬서 마지막 카드가 이 버튼에 가리지 않게 할 것. 링크는 주황 배너 [무료 등록]과 같은 /sell
// 2026-10-09 4a: 같은 화면의 주황 등록 배너([data-sell-banner])가 조금이라도 보이면 숨기고, 화면 밖으로 나가면 0.2초 페이드로 표시
//   (IntersectionObserver). 배너가 없는 화면·상태면 표시.
// 2026-10-10: 아래로 스크롤하면 숨기고(한 번에 4px 넘게 내려가고 scrollY 40 넘을 때) 위로 스크롤하면 다시 표시.
//   배너 숨김과 함께 — 둘 중 하나라도 숨김이면 숨김. 0.25초 transform·opacity 전환, 동작 줄이기 설정이면 전환 없이 바로.
export const SELL_FAB_HREF = "/sell";
export const SELL_BANNER_SELECTOR = "[data-sell-banner]";

export default function SellFab() {
  const [bannerVisible, setBannerVisible] = useState(true); // 첫 그림은 숨김(배너가 보통 첫 화면에 있음) — 확인 뒤 바로 맞춤

  useEffect(() => {
    const banner = document.querySelector(SELL_BANNER_SELECTOR);
    if (!banner || typeof IntersectionObserver === "undefined") {
      setBannerVisible(false);
      return;
    }
    const io = new IntersectionObserver((entries) => setBannerVisible(entries.some((e) => e.isIntersecting)), { threshold: 0 });
    io.observe(banner);
    return () => io.disconnect();
  }, []);

  const [scrollHidden, setScrollHidden] = useState(false);
  useEffect(() => {
    let st = { hidden: false, lastY: window.scrollY };
    const onScroll = () => {
      const next = nextFabScrollState(st, window.scrollY);
      if (next === st) return;
      st = next;
      setScrollHidden(next.hidden);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hidden = bannerVisible || scrollHidden;
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
      data-fab-scroll-hidden={scrollHidden ? "1" : undefined}
    >
      ＋ 매물 등록
    </Link>
  );
}
