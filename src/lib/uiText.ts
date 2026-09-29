import { rem } from "@/lib/rem";

// MY 등 정보 화면 글자 크기 기준 (2026-09-29, 폼 FormField와 같은 스케일).
// 섹션 제목 18/800 · 카드 제목 17/800 · 설명 15 · 보조 정보 14 · 링크·버튼 15/700.
// 새 문구를 넣을 때 숫자 대신 이 값들을 쓸 것.
export const UI_SECTION = { fontSize: rem(18), fontWeight: 800, color: "#1F2937" } as const;
export const UI_CARD_TITLE = { fontSize: rem(17), fontWeight: 800, color: "#1F2937" } as const;
export const UI_DESC = { fontSize: rem(15), color: "#4B5563", lineHeight: 1.55 } as const;
export const UI_META = { fontSize: rem(14), color: "#6B7480" } as const;
export const UI_LINK = { fontSize: rem(15), fontWeight: 700 } as const;

// 본문 속 일반 버튼 (2026-09-29) — 띄우지 않음(그림자 없음). 주 버튼(주황)·보조 버튼(테두리) 2종.
// 높이 52px · 둥근 모서리 · 글자 17px/800. 하단 고정 버튼은 FloatingCTA, 작은 알약·칩·탭은 여기 해당 안 됨.
export const BTN_CLASS = "flex items-center justify-center text-center rounded-2xl disabled:opacity-60";
export function btnStyle(kind: "primary" | "secondary" = "primary"): import("react").CSSProperties {
  return {
    minHeight: 52,
    padding: "0 20px",
    fontSize: rem(17),
    fontWeight: 800,
    ...(kind === "primary"
      ? { color: "#fff", background: "linear-gradient(135deg,#E25100,#FF6F0F)", border: "none" }
      : { color: "#0B2540", background: "#fff", border: "1.5px solid #D5DAE0" }),
  };
}
