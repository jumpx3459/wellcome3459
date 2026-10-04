import { rem } from "@/lib/rem";

// 2026-10-04 F-4 사용 편의: 관리자 카드 제목 통일 — 파란 글자(굵게) + 왼쪽 3px 파란 선.
// 제목 옆 숫자(span, LABEL 회색·빨강 멈춤 등)는 각자 inline 색이라 그대로 유지. 크기는 예전 UI_SECTION(18)과 같음.
// 대시보드 위쪽 지표 묶음 제목(조치 필요·핵심 지표 등)은 카드 목록이 아니라 그대로 UI_SECTION.
export const CARD_TITLE_PROPS = {
  className: "text-blue-800 font-bold border-l-[3px] border-blue-800 pl-2",
  style: { fontSize: rem(18) },
  "data-card-title": "",
} as const;
