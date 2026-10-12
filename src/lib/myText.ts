import type { CSSProperties } from "react";
import { rem } from "@/lib/rem";
import { btnStyle } from "@/lib/uiText";

// MY·공유(/share) 전용 글자 크기 (2026-10-12 feat/my-menu-share) — MY 화면과 MY에서만 쓰는 부품
// (PushStatusCard·ConsentToggles·MyBuyRequests·QuotesTeaserCard·BusinessLicenseUploader·ReferralShareButtons)만 씀.
// 공용 uiText·btnStyle·FieldLabel·EcosystemGrid 값은 그대로(관리자·/sell·홈 글자 크기 영향 없음).

// 머리(남색): 상호 22.5/800 · 성명·회원번호 17.5/600 · 숫자 22.5/700 · 칸 이름 17.5/700 · "정보 수정 ›" 19/700
export const MY_HEAD_NAME = { fontSize: rem(22.5), fontWeight: 800, letterSpacing: "-0.02em" } as const;
export const MY_HEAD_SUB = { fontSize: rem(17.5), fontWeight: 600, color: "rgba(255,255,255,.8)" } as const;
export const MY_HEAD_NUM = { fontSize: rem(22.5), fontWeight: 700 } as const;
export const MY_HEAD_LABEL = { fontSize: rem(17.5), fontWeight: 700, color: "rgba(255,255,255,.8)" } as const;
export const MY_HEAD_EDIT = { fontSize: rem(19), fontWeight: 700, color: "#FFD166" } as const;
export const MY_HEAD_BADGE = { fontSize: rem(15), fontWeight: 700 } as const;

// 메뉴(당근식): 그룹 이름 16/800 #6B7480 · 행 이름 20/700 · 오른쪽 상태 #9CA3AF · 펼친 패널 글자 17.5 #4B5563
export const MY_GROUP = { fontSize: rem(16), fontWeight: 800, color: "#6B7480" } as const;
export const MY_ROW = { fontSize: rem(20), fontWeight: 700, color: "#1F2937" } as const;
export const MY_ROW_RIGHT = { fontSize: rem(17.5), fontWeight: 600, color: "#9CA3AF" } as const;
export const MY_PANEL_BG = "#FFF7ED";

// 본문(패널·카드 안)
export const MY_SECTION = { fontSize: rem(20), fontWeight: 800, color: "#1F2937" } as const;
export const MY_CARD_TITLE = { fontSize: rem(19), fontWeight: 800, color: "#1F2937" } as const;
export const MY_DESC = { fontSize: rem(17.5), color: "#4B5563", lineHeight: 1.55 } as const;
export const MY_META = { fontSize: rem(16), color: "#6B7480" } as const;
export const MY_LINK = { fontSize: rem(17.5), fontWeight: 700 } as const;
export const MY_BADGE = { fontSize: rem(15), fontWeight: 700 } as const;
export const MY_INPUT_FONT_SIZE = rem(18);

// 점핑 서비스 칸: 제목 20/800 · 설명 17.5/600
export const MY_TILE_TITLE = { fontSize: rem(20), fontWeight: 800, color: "#1F2937" } as const;
export const MY_TILE_DESC = { fontSize: rem(17.5), fontWeight: 600, color: "#4B5563" } as const;

// 본문 버튼 — 모양은 공용 btnStyle 그대로, 글자만 MY 크기(18/800)
export function myBtnStyle(kind: "primary" | "secondary" = "primary"): CSSProperties {
  return { ...btnStyle(kind), minHeight: 54, fontSize: rem(18) };
}

// 남색 점무늬 머리 바탕 — MY·/share 같은 모양
export const MY_HEAD_BG: CSSProperties = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
  backgroundSize: "16px 16px, cover",
};
