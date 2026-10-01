"use client";

import { useEffect, useRef } from "react";

// 2026-10-01 PR-C: 시트·모달이 열리면 히스토리 1개 추가 → 안드로이드 뒤로가기(제스처·브라우저)는 모달만 닫음.
// 버튼·배경 클릭으로 닫으면 추가했던 기록을 스스로 되돌림(history.back) — 뒤로가기를 한 번 더 눌러야 하는 일 없게.
// Next 16은 window.history.pushState를 라우터와 같이 쓰는 걸 지원함(같은 주소, state에 표시만 추가).
// 열린 모달의 표시값 — 닫힌 모달이 남긴 기록(StrictMode 이중 실행·모달 전환)은 다음 모달이 replace로 재사용
const openMarkers = new Set<string>();

export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const marker = Math.random().toString(36).slice(2);
    const prev = window.history.state as { __djModal?: string } | null;
    const state = { ...(prev ?? {}), __djModal: marker };
    if (prev?.__djModal && !openMarkers.has(prev.__djModal)) window.history.replaceState(state, "");
    else window.history.pushState(state, "");
    openMarkers.add(marker);

    let closedByBack = false;
    const onPop = () => {
      if ((window.history.state as { __djModal?: string } | null)?.__djModal === marker) return;
      closedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      openMarkers.delete(marker);
      if (closedByBack) return;
      // 버튼으로 닫힘 — 다음 틱에도 이 모달 기록이 맨 위면(다른 모달·페이지 이동이 없으면) 되돌림
      setTimeout(() => {
        if ((window.history.state as { __djModal?: string } | null)?.__djModal === marker) window.history.back();
      }, 0);
    };
  }, [open]);
}
