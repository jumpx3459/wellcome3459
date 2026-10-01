"use client";

import type { ReactNode } from "react";
import { rem } from "@/lib/rem";

// 매물 폼 묶음 (2026-10-01 fix/form-overflow) — 관리자 "새 매물 직접 등록"·/sell 공통.
// 접혀도 칸은 그대로 두고(hidden) 값·업로드 상태 유지. 검증 오류가 접힌 칸에서 나면 폼이 open을 켜고 그 칸으로 스크롤.

// 칸 배치 — 폼 폭 기준(@container, 폼 루트에 @container): 1칸 → 2칸(560px~) → 3칸(840px~). PC 1024px 이상이면 폼 960px라 3칸
export const FORM_ROW3 = "grid grid-cols-1 gap-4 items-start @min-[560px]:grid-cols-2 @min-[560px]:gap-x-3 @min-[840px]:grid-cols-3";
export const FORM_ROW2 = "grid grid-cols-1 gap-4 items-start @min-[560px]:grid-cols-2 @min-[560px]:gap-x-3";

// 항상 펼친 묶음 제목 (① 필수 정보 · ② 사진·영상)
export function FormSectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 style={{ fontSize: rem(17), fontWeight: 800, color: "#0B2540" }}>{children}</h2>
      {hint && <p className="mt-0.5" style={{ fontSize: rem(14), color: "#4B5563" }}>{hint}</p>}
    </div>
  );
}

export default function FormAccordion({
  id,
  title,
  count,
  requiredCount = 0,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count: number; // "○개 입력됨"
  requiredCount?: number; // 접힌 묶음 안 필수 칸 수 — 제목에 주황 "필수 ○개" (관리자 폼 거래 조건의 카테고리)
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white" style={{ border: "1.5px solid #E4E7EB" }}>
      <button
        type="button"
        id={`${id}-head`}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 text-left"
        style={{ padding: "14px 16px", minHeight: 52 }}
      >
        <span className="flex items-center gap-2 flex-wrap min-w-0">
          <span style={{ fontSize: rem(17), fontWeight: 800, color: "#0B2540" }}>{title}</span>
          {requiredCount > 0 && <span style={{ fontSize: rem(14), fontWeight: 800, color: "#E25100" }}>필수 {requiredCount}개</span>}
          {count > 0 && <span style={{ fontSize: rem(14), fontWeight: 600, color: "#6B7480" }}>{count}개 입력됨</span>}
        </span>
        <span aria-hidden className="flex-shrink-0 font-bold" style={{ fontSize: rem(15), color: "#6B7480" }}>
          {open ? "접기 ▴" : "펼치기 ▾"}
        </span>
      </button>
      <div id={`${id}-body`} role="region" aria-labelledby={`${id}-head`} hidden={!open} style={{ padding: "2px 16px 18px" }}>
        {children}
      </div>
    </section>
  );
}
