"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { rem } from "@/lib/rem";
import { fabHidden, nextFabScrollState, type FabScrollState } from "@/lib/fabScroll";

// 떠 있는 "＋ 매물 등록" 버튼 (2026-10-09 4b-2) — 회원 홈(AlertInboxHome)·/deals에서만 그림(다른 화면엔 넣지 않음).
// 앱 틀(max-w-md 448px) 오른쪽 14px · 하단 탭 위 14px(--nav-bottom이 safe-area 포함). 하단 탭(z-40)보다 위.
// 쓰는 화면은 목록 맨 아래에 90px 여백을 둬서 마지막 카드가 이 버튼에 가리지 않게 할 것. 링크는 주황 배너 [무료 등록]과 같은 /sell
// 2026-10-09 4a: 같은 화면의 주황 등록 배너([data-sell-banner])가 조금이라도 보이면 숨기고, 화면 밖으로 나가면 0.2초 페이드로 표시
//   (IntersectionObserver). 배너가 없는 화면·상태면 표시.
// 2026-10-10: 아래로 스크롤하면 숨기고(한 번에 4px 넘게) 위로 스크롤하면 다시 표시. 0.25초 transform·opacity 전환, 동작 줄이기 설정이면 전환 없이 바로.
// 2026-10-10 fix/deals-fab-visibility: 배너 전체(1px만 보여도 숨김) 대신 [무료 등록] 버튼이 화면에 다 보일 때만 숨김 — 배너 끝만 걸린 구간에서
//   등록 버튼이 0개였음. 버튼이 벗어나는 순간 표시, 목록 끝(사업자 정보 푸터)이 보이면 방향과 관계없이 표시. 규칙은 src/lib/fabScroll.ts
export const SELL_FAB_HREF = "/sell";
export const SELL_BANNER_SELECTOR = "[data-sell-banner]";
export const SELL_BANNER_BUTTON_SELECTOR = "[data-sell-banner-button]";
export const FAB_FOOTER_SELECTOR = "[data-business-footer]";

export default function SellFab() {
  const [bannerVisible, setBannerVisible] = useState(true); // 첫 그림은 숨김(배너가 보통 첫 화면에 있음) — 확인 뒤 바로 맞춤
  const [footerVisible, setFooterVisible] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const scrollState = useRef<FabScrollState>({ hidden: false, lastY: 0 });

  useEffect(() => {
    scrollState.current = { hidden: false, lastY: window.scrollY };
    const onScroll = () => {
      const next = nextFabScrollState(scrollState.current, window.scrollY);
      if (next === scrollState.current) return;
      scrollState.current = next;
      setScrollHidden(next.hidden);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const target = document.querySelector(SELL_BANNER_BUTTON_SELECTOR) ?? document.querySelector(SELL_BANNER_SELECTOR);
    const footer = document.querySelector(FAB_FOOTER_SELECTOR);
    const observers: IntersectionObserver[] = [];
    if (typeof IntersectionObserver === "undefined") {
      setBannerVisible(false);
    } else {
      if (target) {
        // 다 보일 때(threshold 1)만 숨김 — 조금이라도 벗어나면 표시하고, 방향 기록도 "표시"로(위로 올리다 배너가 걸린 구간에서 0개 방지)
        const io = new IntersectionObserver(
          (entries) => {
            const e = entries[entries.length - 1];
            const full = e.isIntersecting && e.intersectionRatio >= 0.99;
            setBannerVisible(full);
            if (!full) {
              scrollState.current = { hidden: false, lastY: window.scrollY };
              setScrollHidden(false);
            }
          },
          { threshold: [0, 0.99, 1] }
        );
        io.observe(target);
        observers.push(io);
      } else {
        setBannerVisible(false); // 배너가 없는 화면·상태면 이 조건은 무시
      }
      if (footer) {
        const io = new IntersectionObserver((entries) => setFooterVisible(entries[entries.length - 1].isIntersecting), { threshold: 0 });
        io.observe(footer);
        observers.push(io);
      }
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  const hidden = fabHidden({ footerVisible, bannerVisible, scrollHidden });
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
      data-fab-banner={bannerVisible ? "1" : undefined}
      data-fab-footer={footerVisible ? "1" : undefined}
    >
      ＋ 매물 등록
    </Link>
  );
}
