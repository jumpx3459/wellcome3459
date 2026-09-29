import { rem } from "@/lib/rem";

// MY 등 정보 화면 글자 크기 기준 (2026-09-29, 폼 FormField와 같은 스케일).
// 섹션 제목 18/800 · 카드 제목 17/800 · 설명 15 · 보조 정보 14 · 링크·버튼 15/700.
// 새 문구를 넣을 때 숫자 대신 이 값들을 쓸 것.
export const UI_SECTION = { fontSize: rem(18), fontWeight: 800, color: "#1F2937" } as const;
export const UI_CARD_TITLE = { fontSize: rem(17), fontWeight: 800, color: "#1F2937" } as const;
export const UI_DESC = { fontSize: rem(15), color: "#4B5563", lineHeight: 1.55 } as const;
export const UI_META = { fontSize: rem(14), color: "#6B7480" } as const;
export const UI_LINK = { fontSize: rem(15), fontWeight: 700 } as const;
