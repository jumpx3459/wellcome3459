"use client";

import type { CSSProperties } from "react";
import { rem } from "@/lib/rem";
import { STORAGE_TYPES, STORAGE_ICONS, type StorageType } from "@/lib/dealFields";
import { DEAL_CHIP_FONT_SIZE } from "@/components/FormField";

// 매물 등록 폼 공통 입력 (2026-10-01 PR-B) — /sell·관리자 DealForm. 입력칸 모양은 각 폼이 className/style로 넘김.

// 자유 입력 + 예시(datalist·칩). 칩을 누르면 그 값으로 채움 — 직접 고쳐 써도 됨 [5]
export function SuggestInput({
  id,
  value,
  onChange,
  examples,
  placeholder,
  className,
  style,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  examples: readonly string[];
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const listId = `${id}-examples`;
  return (
    <>
      <input
        id={id}
        list={listId}
        className={className}
        style={style}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {examples.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {examples.map((e) => {
          const picked = value === e;
          return (
            <button
              key={e}
              type="button"
              onClick={() => onChange(picked ? "" : e)}
              className="rounded-full font-bold"
              style={{
                fontSize: rem(13),
                padding: "4px 10px",
                background: picked ? "#E9ECEF" : "#fff",
                border: picked ? "1.5px solid #6B7480" : "1px solid #E4E7EB",
                color: picked ? "#1A1F26" : "#4B5563",
              }}
            >
              {picked ? "✓ " : ""}
              {e}
            </button>
          );
        })}
      </div>
    </>
  );
}

// MOQ 칸 아래 [전량 일괄] 칩 (2026-11-03 feat/moq-whole-lot) — 포장 단위 예시 칩과 같은 모양. 선택 = MOQ가 총수량과 같음(src/lib/moq.ts)
// 총수량이 없거나 0이면 비활성
export function MoqWholeLotChip({ active, disabled, onClick }: { active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        data-moq-whole
        className="rounded-full font-bold disabled:opacity-50"
        style={{
          fontSize: rem(13),
          padding: "4px 10px",
          background: active ? "#E9ECEF" : "#fff",
          border: active ? "1.5px solid #6B7480" : "1px solid #E4E7EB",
          color: active ? "#1A1F26" : "#4B5563",
        }}
      >
        {active ? "✓ " : ""}전량 일괄
      </button>
    </div>
  );
}

// 보관 조건 — 상온/냉장/냉동 (다시 누르면 선택 해제) [6]
export function StorageTypeButtons({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StorageType | "";
  onChange: (v: StorageType | "") => void;
}) {
  return (
    <div id={id} className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="보관 조건">
      {STORAGE_TYPES.map((t) => {
        const picked = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={picked}
            onClick={() => onChange(picked ? "" : t)}
            className="rounded-xl font-bold min-w-0 whitespace-nowrap"
            style={{
              fontSize: DEAL_CHIP_FONT_SIZE,
              padding: "11px 0",
              background: picked ? "#E9ECEF" : "#fff",
              border: picked ? "2px solid #6B7480" : "1.5px solid #E4E7EB",
              color: "#1A1F26",
            }}
          >
            {picked ? "✓ " : `${STORAGE_ICONS[t]} `}
            {t}
          </button>
        );
      })}
    </div>
  );
}
