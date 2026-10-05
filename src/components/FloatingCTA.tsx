import type { CSSProperties, ReactNode } from "react";
import { rem } from "@/lib/rem";
import FloatingCTAMeasure from "@/components/FloatingCTAMeasure";

// 하단 고정 버튼 공용 (2026-09-29, 결정 변경: 예전 "흰 반투명 판 + 블러 + 위 그라데이션" 취소).
// 판 없이 주황 버튼만 그림자로 띄운다. 하단 탭(--nav-bottom, safe-area 포함) 위로 GAP만큼 띄움.
// 사용처: sell·buy·매물 상세(관심있어요)·비회원 홈·가입. 페이지 본문엔 paddingBottom: FLOATING_CTA_SPACE.
export const FLOATING_CTA_GAP = 12; // 하단 탭과 버튼 사이
export const FLOATING_CTA_HEIGHT = 56;
// 페이지 하단 여백 = 버튼 높이 + 간격 + 여유 — 마지막 입력칸·안내 카드가 버튼에 가리지 않게
export const FLOATING_CTA_SPACE = FLOATING_CTA_HEIGHT + FLOATING_CTA_GAP + 24;
// 2026-10-03: 실제 높이 기준 여백 — 버튼 아래 안내 알약·큰 글자로 버튼 묶음이 커지는 화면(매물 상세)용.
// --floating-cta-h는 FloatingCTAMeasure가 채움(없으면 고정값과 같음)
export const FLOATING_CTA_SPACE_FIT = `calc(var(--floating-cta-h, ${FLOATING_CTA_HEIGHT + FLOATING_CTA_GAP}px) + 24px)`;

export function floatingCtaButtonStyle(inactive = false): CSSProperties {
  return {
    minHeight: FLOATING_CTA_HEIGHT,
    fontSize: rem(17),
    fontWeight: 800,
    color: inactive ? "#4B5563" : "#fff",
    background: inactive ? "#C9CFD6" : "linear-gradient(135deg,#E25100,#FF6F0F)",
    boxShadow: inactive ? "0 6px 16px rgba(11,37,64,.18)" : "0 10px 24px rgba(226,81,0,.35), 0 2px 6px rgba(11,37,64,.15)",
    transition: "background .2s, box-shadow .2s",
  };
}
// 버튼·링크에 같이 붙일 클래스 (둥근 모서리, 가운데 정렬)
export const FLOATING_CTA_BUTTON_CLASS = "w-full flex items-center justify-center text-center rounded-2xl disabled:opacity-60";

// 버튼 위 짧은 안내·오류 (판이 없어서 글자만 두면 뒤 내용과 섞여 안 읽힘 → 작은 흰 알약)
// tone "dark": 가입 화면 비활성 버튼 누름 안내 전용(2026-10-05 대표 선택 B1) — 짙은 바탕·흰 굵은 글자 16px(대비 17.7:1)
export function FloatingCTANote({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" | "dark" }) {
  if (tone === "dark") {
    return (
      <div
        className="mx-auto mb-2 w-fit max-w-full text-center"
        style={{ fontSize: rem(16), fontWeight: 700, color: "#fff", background: "#111827", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 12px rgba(11,37,64,.2)" }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className="mx-auto mb-2 w-fit max-w-full rounded-full bg-white text-center font-medium"
      style={{ fontSize: rem(14), padding: "6px 12px", color: tone === "error" ? "var(--color-orange)" : "#4B5563", boxShadow: "0 4px 12px rgba(11,37,64,.15)" }}
    >
      {children}
    </div>
  );
}

export default function FloatingCTA({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`fixed z-10 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pointer-events-none ${className}`}
      style={{ bottom: `calc(var(--nav-bottom) + ${FLOATING_CTA_GAP}px)` }}
    >
      <div className="pointer-events-auto">{children}</div>
      <FloatingCTAMeasure gap={FLOATING_CTA_GAP} />
    </div>
  );
}
