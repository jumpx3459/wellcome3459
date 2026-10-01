import type { ReactNode } from "react";
import { rem } from "@/lib/rem";

// sell·buy 폼 공통 글자 크기 (2026-09-29, 실기기 피드백) — 라벨 17px/800, (필수)/(선택) 모든 칸,
// 입력 글자 17px, 안내 문구 15px, 칩 16px. 새 칸을 만들 때도 이 값들을 쓸 것.
export const FORM_LABEL_STYLE = { fontSize: rem(17), fontWeight: 800, color: "#0B2540" } as const;
export const FORM_INPUT_FONT_SIZE = rem(17);
export const FORM_HINT_STYLE = { fontSize: rem(15), color: "#4B5563", lineHeight: 1.55 } as const;
export const FORM_CHIP_FONT_SIZE = rem(16);

// 매물 등록 폼(/sell·관리자 DealForm) 글자 크기 (2026-10-01 PR-B [7]) — 입력 16px, 라벨 15px 굵게, 안내 14px, 버튼·칩 15px.
// 칸이 많은 폼이라 sell·buy 공통값(17px)보다 한 단계 작게. buy 등 다른 폼은 위 FORM_* 그대로.
export const DEAL_LABEL_STYLE = { fontSize: rem(15), fontWeight: 700, color: "#0B2540" } as const;
export const DEAL_INPUT_FONT_SIZE = rem(16);
export const DEAL_HINT_STYLE = { fontSize: rem(14), color: "#4B5563", lineHeight: 1.5 } as const;
export const DEAL_CHIP_FONT_SIZE = rem(15);
export const DEAL_BUTTON_FONT_SIZE = rem(15);

const TAG = {
  required: { text: "(필수)", color: "#E25100" },
  optional: { text: "(선택)", color: "#6B7480" },
} as const;

export function FieldTag({ need, compact }: { need: keyof typeof TAG; compact?: boolean }) {
  return (
    <span className="font-bold whitespace-nowrap" style={{ fontSize: rem(compact ? 13 : 15), color: TAG[need].color }}>
      {TAG[need].text}
    </span>
  );
}

// 칸 제목 + (필수)/(선택). extra = 오른쪽 끝에 붙일 것(예: "전 지역 선택" 버튼)
export function FieldLabel({
  need,
  children,
  className = "mb-2",
  extra,
  compact,
  htmlFor,
}: {
  need: keyof typeof TAG;
  children: ReactNode;
  className?: string;
  extra?: ReactNode;
  compact?: boolean; // 매물 등록 폼 크기(DEAL_LABEL_STYLE)
  htmlFor?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`} style={compact ? DEAL_LABEL_STYLE : FORM_LABEL_STYLE}>
      {htmlFor ? <label htmlFor={htmlFor}>{children}</label> : <span>{children}</span>}
      <FieldTag need={need} compact={compact} />
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}
