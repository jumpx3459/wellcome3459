"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { rem } from "@/lib/rem";
import { ADMIN_MENU_LABELS, type AdminMenuId } from "@/lib/adminMenus";

// 2026-10-29 관리자 사이드바(feat/admin-sidebar): 메뉴 이동 UI 두 가지 — PC(isDesktop) 좌측 220px sticky 사이드바, 폰 상단 sticky 메뉴 칩(9개·가로 스크롤·44px·활성 칩 자동 보이기).
// 이동·보일 메뉴·숫자(0이면 숨김)는 모두 부르는 쪽(page.tsx)이 정해서 넘김 — 여기는 그리기만. 예전 AdminJumpBar(스크롤 앵커 칩)를 대체.
export type AdminMenuItem = { id: AdminMenuId; badge?: number };

function Badge({ n, id }: { n?: number; id: AdminMenuId }) {
  if (!n || n <= 0) return null;
  return (
    <span
      className="font-bold rounded-full flex-shrink-0 text-center"
      style={{ fontSize: rem(13), minWidth: 22, padding: "1px 7px", background: "#FDEEE8", color: "#C2410C", border: "1px solid #F5C4A8", fontVariantNumeric: "tabular-nums" }}
      data-menu-badge={id}
      aria-label={`${n}건`}
    >
      {n}
    </span>
  );
}

export function AdminMenuChips({ items, active, onSelect }: { items: AdminMenuItem[]; active: AdminMenuId; onSelect: (id: AdminMenuId) => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  // 활성 칩이 가로 스크롤 밖에 있으면 보이게(스크롤은 이 칩 줄 안에서만 — 페이지 세로 스크롤은 건드리지 않음)
  useEffect(() => {
    const bar = barRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-menu-chip="${active}"]`);
    if (!bar || !chip) return;
    const left = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);
  return (
    <nav
      aria-label="관리자 메뉴"
      data-menu-nav="chips"
      className="sticky z-30 bg-white border-b border-gray200"
      style={{ top: "var(--session-banner-h, 0px)", paddingTop: "env(safe-area-inset-top, 0px)" }} // 세션 만료 배너가 떠 있으면 그 아래에 붙음
    >
      <div ref={barRef} className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-2">
        {items.map((m) => {
          const on = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              aria-current={on ? "page" : undefined}
              className="flex-shrink-0 font-bold rounded-full whitespace-nowrap inline-flex items-center gap-1.5"
              style={{
                minHeight: 44,
                padding: "0 16px",
                fontSize: rem(15),
                border: `2px solid ${on ? "#0B2540" : "#E4E7EB"}`,
                background: on ? "#0B2540" : "#fff",
                color: on ? "#fff" : "#0B2540",
              }}
              data-menu-chip={m.id}
            >
              {ADMIN_MENU_LABELS[m.id]}
              <Badge n={m.badge} id={m.id} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminSidebar({ items, active, onSelect, footer }: { items: AdminMenuItem[]; active: AdminMenuId; onSelect: (id: AdminMenuId) => void; footer?: ReactNode }) {
  return (
    <aside
      data-menu-nav="sidebar"
      className="flex-shrink-0 sticky z-20 flex flex-col bg-white border-r border-gray200"
      style={{ width: 220, top: "var(--session-banner-h, 0px)", height: "calc(100dvh - var(--session-banner-h, 0px))", overflowY: "auto" }}
    >
      <nav aria-label="관리자 메뉴" className="flex flex-col gap-1 p-3">
        {items.map((m) => {
          const on = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              aria-current={on ? "page" : undefined}
              className="w-full text-left font-bold rounded-xl flex items-center justify-between gap-2"
              style={{
                minHeight: 44,
                padding: "0 12px",
                fontSize: rem(16),
                background: on ? "#EEF2F7" : "transparent",
                color: on ? "#0B2540" : "#374151",
                boxShadow: on ? "inset 3px 0 0 #E25100" : undefined,
              }}
              data-menu-item={m.id}
            >
              <span className="min-w-0">{ADMIN_MENU_LABELS[m.id]}</span>
              <Badge n={m.badge} id={m.id} />
            </button>
          );
        })}
      </nav>
      {footer && <div className="mt-auto p-3 border-t border-gray200 flex flex-col gap-2" data-sidebar-footer>{footer}</div>}
    </aside>
  );
}
