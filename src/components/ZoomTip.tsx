"use client";

import { useEffect, useState } from "react";
import { rem } from "@/lib/rem";

// 매물 상세 첫 방문 1회 확대 안내 (2026-09-30). 본문 흐름 안(헤더 바로 밑)에 넣어 하단 탭·FloatingCTA에 가리지 않게.
// localStorage는 막혀 있을 수 있어(사생활 보호 모드 등) 읽기·쓰기 모두 try/catch — 실패하면 이번 화면에서만 닫힘.
const KEY = "dj_zoom_tip_seen";

export default function ZoomTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(KEY) === "1";
    } catch {}
    // 마운트 후에만 판단 — 서버 렌더와 어긋나지 않게
    if (!seen) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {}
  };

  return (
    <div className="px-5 pt-3" data-zoom-tip>
      <div className="flex items-center gap-3 rounded-2xl" style={{ background: "#F5F6F8", padding: "12px 14px" }}>
        <p className="flex-1 min-w-0 font-medium" style={{ fontSize: rem(15), color: "#1A1F26", lineHeight: 1.45 }}>
          🔍 두 손가락으로 벌리면 화면을 크게 볼 수 있어요
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="flex-shrink-0 rounded-full font-bold whitespace-nowrap"
          style={{ fontSize: rem(14), padding: "8px 14px", background: "#fff", color: "#1A1F26", border: "1px solid #E4E7EB" }}
        >
          알겠어요
        </button>
      </div>
    </div>
  );
}
