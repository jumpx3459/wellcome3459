"use client";

import type { CSSProperties } from "react";
import { CUSTOM_UNIT_LABEL, CUSTOM_UNIT_MAX, checkCustomUnit, pickUnit, typeUnit, unitSelectValue, type UnitState } from "@/lib/units";

// 판매 등록·매물 수정 폼의 단위 선택 (2026-11-02 feat/unit-custom) — 목록 끝에 "기타(직접 입력)".
// UnitSelect = 선택 상자(기타 포함), CustomUnitInput = "기타"일 때만 보이는 글 입력칸(목록 단어를 치면 목록 값으로 자동 전환).
// 상태 규칙은 src/lib/units.ts(UnitState·pickUnit·typeUnit). 두 칸은 같은 state·같은 options를 받는다.

export function UnitSelect({
  state,
  options,
  onChange,
  labelOf,
  id,
  ariaLabel,
  className,
  style,
  testId,
}: {
  state: UnitState;
  options: readonly string[];
  onChange: (next: UnitState) => void;
  /** 목록 값의 보이는 글자(예: 일괄 → "일괄(전체)") */
  labelOf?: (unit: string) => string;
  id?: string;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  // 가장 긴 선택지("기타(직접 입력)") 때문에 상자가 넓어져 단가·수량 입력칸이 좁아지지 않게 폭을 고정 — 기타를 고르면 조금 더 넓힘(입력칸이 아래에 나타나 뜻은 분명)
  const width = state.other ? "6.75rem" : (style?.width ?? "6rem");
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      className={className}
      style={{ ...style, width, minWidth: 0 }}
      data-testid={testId}
      value={unitSelectValue(state)}
      onChange={(e) => onChange(pickUnit(e.target.value, state))}
    >
      {options.map((u) => (
        <option key={u} value={u}>
          {labelOf ? labelOf(u) : u}
        </option>
      ))}
      <option value={CUSTOM_UNIT_LABEL}>{CUSTOM_UNIT_LABEL}</option>
    </select>
  );
}

export function CustomUnitInput({
  state,
  options,
  onChange,
  ariaLabel,
  fontSize,
  errorColor = "#B42318",
  noun = "단위",
  testId,
  forbidLumpSum = false,
  error: outerError,
}: {
  state: UnitState;
  options: readonly string[];
  onChange: (next: UnitState) => void;
  ariaLabel: string;
  fontSize: string | number;
  errorColor?: string;
  noun?: string;
  testId?: string;
  /** 총수량 단위: "일괄"은 쓸 수 없음 — 입력 즉시 안내 */
  forbidLumpSum?: boolean;
  /** 저장 누를 때 나온 검사 문구(빈 칸 등) — 입력 중 즉시 안내보다 우선 */
  error?: string | null;
}) {
  if (!state.other) return null;
  const typed = state.unit.trim();
  const check = checkCustomUnit(state.unit);
  const lump = forbidLumpSum && typed === "일괄";
  const error = outerError || (typed ? (lump ? "수량 단위로는 \"일괄\"을 쓸 수 없어요." : check.ok ? null : check.error) : null);
  return (
    <div className="mt-1.5 min-w-0" data-custom-unit={testId ?? "custom-unit"}>
      <input
        type="text"
        aria-label={ariaLabel}
        data-testid={testId ?? "custom-unit-input"}
        className="w-full min-w-0 rounded-xl outline-none bg-white"
        style={{ border: `1.5px solid ${error ? errorColor : "#E4E7EB"}`, padding: "9px 12px", fontSize, color: "#1A1F26" }}
        value={state.unit}
        onChange={(e) => onChange(typeUnit(e.target.value, options))}
        placeholder={`${noun} 직접 입력 (예: 봉지)`}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {error ? (
        <p className="font-medium mt-1" role="alert" style={{ fontSize: "0.875rem", color: errorColor }} data-custom-unit-error>
          {error}
        </p>
      ) : (
        <p className="mt-1" style={{ fontSize: "0.8125rem", color: "#6B7280" }}>
          1~{CUSTOM_UNIT_MAX}자 · 글자를 넣어 적어주세요
        </p>
      )}
    </div>
  );
}
