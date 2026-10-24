import { rem } from "@/lib/rem";

// 2026-10-04 F-4 사용 편의: 관리자 카드 제목 통일 — 파란 글자(굵게) + 왼쪽 3px 파란 선.
// 제목 옆 숫자(span, LABEL 회색·빨강 멈춤 등)는 각자 inline 색이라 그대로 유지. 크기는 예전 UI_SECTION(18)과 같음.
// 대시보드 위쪽 지표 묶음 제목(조치 필요·핵심 지표 등)은 카드 목록이 아니라 그대로 UI_SECTION.
export const CARD_TITLE_PROPS = {
  className: "text-blue-800 font-bold border-l-[3px] border-blue-800 pl-2",
  style: { fontSize: rem(18) },
  "data-card-title": "",
} as const;

// 2026-10-24 목록 카드(AdminListCard) 제목 줄 시인성 — 연한 남색 띠 위 진한 남색 글자(한 단계 크게 20px·굵게) + 왼쪽 4px 남색 선.
// 남색 계열만(빨강 금지, 마감임박 주황·마감 지남 회색 강조와 혼동 방지). 목록 카드가 아닌 제목(사업자 조회·관리자 목록 등)은 위 CARD_TITLE_PROPS 그대로.
export const LIST_CARD_TITLE_PROPS = {
  className: "font-bold border-l-4 pl-2",
  style: { fontSize: rem(20), color: "#312E81", borderLeftColor: "#4338CA" },
  "data-card-title": "",
} as const;
export const LIST_CARD_BAND_BG = "#EEF2FF"; // indigo-50 — 글자(#312E81) 대비 약 11:1, [접기](#3730A3) 약 9:1
