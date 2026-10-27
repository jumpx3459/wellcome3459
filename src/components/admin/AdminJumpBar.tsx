"use client";

import { rem } from "@/lib/rem";

// 2026-10-26 admin-layout-v1: 화면 위에 붙어 따라오는 바로가기 칩 — 조치·매물·구매요청·회원·지표.
// 누르면 해당 섹션 위로 스크롤(이 바 높이만큼 여백). 권한 없는 섹션 칩은 부르는 쪽에서 빼고 넘김. 로직·데이터 변경 없음.
export type JumpChip = { label: string; targetId: string };

export default function AdminJumpBar({ chips }: { chips: JumpChip[] }) {
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const bar = document.querySelector<HTMLElement>("[data-jump-bar]");
    const banner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--session-banner-h")) || 0; // 세션 만료 배너가 떠 있으면 그 높이도
    const offset = (bar?.getBoundingClientRect().height ?? 0) + banner + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  };
  return (
    <nav
      aria-label="바로가기"
      data-jump-bar
      className="sticky z-30 bg-white border-b border-gray200"
      style={{ top: "var(--session-banner-h, 0px)", paddingTop: "env(safe-area-inset-top, 0px)" }} // 세션 만료 배너가 떠 있으면 그 아래에 붙음
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-2">
        {chips.map((c) => (
          <button
            key={c.targetId}
            type="button"
            onClick={() => go(c.targetId)}
            className="flex-shrink-0 font-bold rounded-full border-2 border-gray200 text-navy bg-white whitespace-nowrap"
            style={{ minHeight: 44, padding: "0 16px", fontSize: rem(15) }}
            data-jump-chip={c.targetId}
          >
            {c.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
