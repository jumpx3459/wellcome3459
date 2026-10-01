"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { authFetch } from "@/lib/authFetch";
import { refreshPushSubscriptionIfStale } from "@/lib/pushClient";

// 회원 방문 기록 (2026-09-30, 커밋 K) — 로그인 세션이 있으면 한국 날짜 기준 하루 1번 /api/active-day 호출.
// 같은 기기에서 같은 날 반복 호출하지 않도록 localStorage에 "날짜:회원id"를 남김(막혀 있으면 서버 upsert가 중복을 무시).
const KEY = "dj_active_day";
const KST_MS = 9 * 3600e3;

export default function ActiveDayPing() {
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (cancelled || !userId) return;
      // 2026-10-01: 앱 열 때 1회 — 구독이 예전 VAPID 키로 묶여 있으면 지금 키로 다시 구독(조용히)
      refreshPushSubscriptionIfStale().catch(() => {});
      const stamp = `${new Date(Date.now() + KST_MS).toISOString().slice(0, 10)}:${userId}`;
      try {
        if (window.localStorage.getItem(KEY) === stamp) return;
      } catch {}
      authFetch("/api/active-day", { json: {} })
        .then((res) => res.json())
        .then((d) => {
          if (d?.ok) {
            try {
              window.localStorage.setItem(KEY, stamp);
            } catch {}
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
