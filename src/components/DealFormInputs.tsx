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
                background: picked ? "#FFF1E7" : "#fff",
                border: picked ? "1.5px solid var(--color-brandOrange)" : "1px solid #E4E7EB",
                color: picked ? "#C2410C" : "#4B5563",
              }}
            >
              {e}
            </button>
          );
        })}
      </div>
    </>
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
              background: picked ? "#FFF1E7" : "#fff",
              border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
              color: "#1A1F26",
            }}
          >
            {STORAGE_ICONS[t]} {t}
          </button>
        );
      })}
    </div>
  );
}
