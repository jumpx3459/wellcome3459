"use client";

import { rem } from "@/lib/rem";
import { NEEDS_ACTION_CHIP_STYLE, NEEDS_ACTION_PASSED_CHIP_STYLE } from "@/lib/admin/needsAction";
import { ADMIN_TEXT } from "@/lib/adminText";

// 2026-10-20: 목록 줄의 상태 칩(미연락·대기·심사중) — 색은 needsAction.ts 한 곳
export function NeedsActionChip({ children, tone = "orange" }: { children: string; tone?: "orange" | "gray" }) {
  return (
    <span
      className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
      style={{ fontSize: rem(14), ...(tone === "gray" ? NEEDS_ACTION_PASSED_CHIP_STYLE : NEEDS_ACTION_CHIP_STYLE) }}
      data-needs-chip={tone === "gray" ? "passed" : ""}
    >
      {children}
    </span>
  );
}

// 카드 안 필터 토글 — 꺼짐: "미연락만" / 켜짐: "미연락만 ✕"(누르면 전체 목록)
export function ActionFilterChip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `${label} 해제(전체 보기)` : label}
      data-action-filter={on ? "on" : "off"}
      className="self-start text-xs font-bold rounded-full px-3 py-1.5 whitespace-nowrap"
      style={on ? { background: "#9A3412", color: "#fff" } : { background: "#F5F6F8", color: ADMIN_TEXT.muted }}
    >
      {on ? `${label} ✕` : label}
    </button>
  );
}

// 필터가 켜진 채 0건일 때의 빈 상태
export function ActionFilterEmpty({ text, onShowAll }: { text: string; onShowAll: () => void }) {
  return (
    <div className="text-center text-gray500 py-6 text-sm flex flex-col items-center gap-3" data-action-empty="">
      <span>{text}</span>
      <button type="button" onClick={onShowAll} className="text-sm font-bold text-navy border-2 border-gray200 rounded-xl px-4 py-2">
        전체 보기
      </button>
    </div>
  );
}
