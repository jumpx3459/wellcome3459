"use client";

import { useEffect, useState } from "react";

// 2026-10-02 PR-B: 마우스(pointer: fine)인지 — PC는 "클릭·끌어다 놓기" 문구와 끌어서 순서 변경, 터치 기기는 "탭" 문구와 ◀▶ 버튼.
// 서버 렌더·첫 화면은 터치 기준(false)으로 그리고, 마운트 뒤 실제 값으로 바꿈.
export function usePointerFine(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: fine)");
    if (!mq) return;
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}
