"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// 첫 방문(OnboardingIntro)·재방문(ReturningMemberIntro) 화면 공통 (2026-10-05):
// 캐릭터 = min(상한, 캐릭터 칸 높이 − 위 여백). 이 값이 CHAR_MIN보다 작아질 때만 단계별로 공간을 줄인다.
// 단계마다 다시 재서 CHAR_MIN 이상이 되면 멈춤. 3단계까지 줄여도 모자라면 3단계 그대로(캐릭터 숨김 없음).
//   0 기본 · 1 "진행 중 매물" 줄 숨김 · 2 남색 머리 여백 축소 · 3 흰 영역 간격 축소
// 글자 크기·주 버튼 높이·링크 누름 영역(44px)·문장·캐릭터 상한은 줄이지 않음.
export const CHAR_MIN = 120;
export const CHAR_TOP = (level: number) => (level >= 3 ? 8 : 16);
// 캐릭터 상한 — "진행 중 매물" 줄이 보이면 210, 아니면 240
export const charCap = (lineShown: boolean) => (lineShown ? 210 : 240);

// hasLine: 줄을 보여 줄 조건(10건 이상)인지 — 1단계부터는 숨김. hasLine이 바뀌면 0단계부터 다시
export function useIntroCompact(hasLine: boolean, active: boolean) {
  const [level, setLevel] = useState(0);
  const [gen, setGen] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);

  // 화면 크기·글자(웹폰트) 변화 → 기본(0단계)부터 다시. 단계 변경으로 바뀌는 건 칸 안쪽이라 화면 크기는 그대로(되먹임 없음)
  const restart = useCallback(() => {
    setLevel(0);
    setGen((g) => g + 1);
  }, []);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", restart);
    document.fonts?.ready.then(restart).catch(() => {});
    return () => window.removeEventListener("resize", restart);
  }, [active, restart]);

  useLayoutEffect(() => {
    restart();
  }, [hasLine, restart]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!active || !area) return;
    const charH = Math.min(charCap(hasLine && level < 1), area.clientHeight - CHAR_TOP(level));
    if (charH < CHAR_MIN && level < 3) setLevel(level + 1);
  }, [active, hasLine, level, gen]);

  return { level, areaRef, lineShown: hasLine && level < 1 };
}
