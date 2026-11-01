"use client";

import { useEffect, type RefObject } from "react";
import { sendMetric } from "@/lib/metrics";
import { firstInSession, impressionKey } from "@/lib/metricsCore";
import type { SlotId } from "@/lib/partnerSlots";

// 제휴 칸 노출 1회 기록 (2026-10-30 feat/stats-foundation) — 절반 이상(threshold 0.5)이 1초 연속 보이면 1번.
// 화면 밖으로 나가면 타이머 취소. 같은 칸·같은 제휴사는 세션당 1회(sessionStorage pm:imp:<slot>:<partnerId>).
// PR 2부터 칸 컴포넌트가 씀.
export const IMPRESSION_MS = 1000;

export function usePartnerImpression(ref: RefObject<Element | null>, slot: SlotId, partnerId: string): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (!e || done) return;
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (timer) return;
          timer = setTimeout(() => {
            timer = null;
            let storage: Storage | null = null;
            try {
              storage = window.sessionStorage;
            } catch {
              storage = null;
            }
            if (!firstInSession(storage, impressionKey(slot, partnerId))) {
              done = true;
              io.disconnect();
              return;
            }
            done = true;
            io.disconnect();
            sendMetric("/api/metrics/slot", { slot, partnerId, kind: "impression" });
          }, IMPRESSION_MS);
        } else {
          clear();
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    io.observe(el);
    return () => {
      clear();
      io.disconnect();
    };
  }, [ref, slot, partnerId]);
}
