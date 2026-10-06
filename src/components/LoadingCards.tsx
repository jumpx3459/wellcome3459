"use client";

import { useEffect, useState } from "react";
import { rem } from "@/lib/rem";

// 2026-10-07 테스터 피드백: 매물을 불러오는 3~10초 동안 목록이 빈 화면(또 예시 매물)으로 보였음.
// → 홈·/deals는 처음 불러오는 동안 카드 모양 회색 자리 표시를 보여 주고, 8초가 지나도 응답이 없거나 실패하면 "다시 시도" 안내.
export const LOAD_SLOW_MS = 8000;

// loading이 true인 채로 ms가 지나면 true. loading이 끝나거나 retryKey가 바뀌면 다시 0부터.
export function useSlowLoad(loading: boolean, retryKey: number, ms = LOAD_SLOW_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [loading, retryKey, ms]);
  return slow;
}

const BAR = { background: "#E5E7EB", borderRadius: 6 } as const;

// 홈 비회원 카드(사진 140px + 본문)와 같은 크기
export function HomeCardSkeleton() {
  return (
    <div
      aria-hidden
      className="skeleton-pulse flex items-center gap-3 rounded-2xl border border-gray200 px-3.5 py-3"
    >
      <div className="flex-shrink-0 rounded-token" style={{ ...BAR, width: 140, height: 140, borderRadius: 12 }} />
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <div style={{ ...BAR, height: 18, width: "88%" }} />
        <div style={{ ...BAR, height: 14, width: "60%" }} />
        <div style={{ ...BAR, height: 22, width: "70%" }} />
      </div>
    </div>
  );
}

// /deals 카드(DealListCard: 정사각 사진 + 본문)와 같은 모양
export function DealListCardSkeleton() {
  return (
    <div
      aria-hidden
      className="skeleton-pulse bg-white border border-gray200 rounded-2xl overflow-hidden flex flex-col w-full"
      style={{ borderLeft: "5px solid #E5E7EB" }}
    >
      <div style={{ ...BAR, borderRadius: 0, width: "100%", aspectRatio: "1/1" }} />
      <div className="px-4 py-3 flex flex-col gap-2.5">
        <div style={{ ...BAR, height: 20, width: "80%" }} />
        <div style={{ ...BAR, height: 22, width: "55%" }} />
        <div style={{ ...BAR, height: 14, width: "65%" }} />
      </div>
    </div>
  );
}

// 불러오기 실패·지연 안내 — 목록 자리에 들어감
export function LoadFailNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl text-center" style={{ background: "#F5F6F8", padding: "24px 16px" }}>
      <p className="font-bold" style={{ fontSize: rem(16), color: "#1A1F26", lineHeight: 1.5 }}>
        인터넷 연결 후 [다시 시도]를 눌러 주세요
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl font-bold text-white"
        style={{ minHeight: 48, padding: "0 28px", fontSize: rem(16), background: "linear-gradient(135deg,#E25100,#FF6F0F)" }}
      >
        다시 시도
      </button>
    </div>
  );
}
