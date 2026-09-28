"use client";

import { useEffect, useRef, useState } from "react";
import { getPushState, subscribeToPush, savePushSubscription } from "@/lib/pushClient";
import { SITE_URL } from "@/lib/siteUrl";

// 2026-09-28: 마이페이지 알림 상태 카드. 예전엔 푸시 구독이 가입 화면에서만 가능해서
// 기존 회원이 알림을 다시 켤 곳이 없었음(구독자 0명). 권한 요청은 반드시 버튼 클릭
// 핸들러 안에서만 한다 — 마운트 시엔 getPushState()로 현재 상태만 조회.
type CardState = "loading" | "unsupported" | "noncanonical" | "denied" | "off" | "on" | "saveFailed";

export default function PushStatusCard({ accessToken }: { accessToken: string | null }) {
  const [state, setState] = useState<CardState>("loading");
  const [busy, setBusy] = useState(false);
  const resynced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getPushState().then(async (s) => {
      if (cancelled) return;
      if (s.status !== "subscribed") {
        setState(s.status);
        return;
      }
      // 기기엔 구독이 있는데 DB엔 없는 경우(가입 때 저장 실패 등) 복구용으로 조용히 1회 재저장.
      // API가 endpoint 기준 upsert라 이미 있으면 그대로 덮어쓸 뿐이다.
      if (!accessToken) {
        setState("on");
        return;
      }
      if (resynced.current) return;
      resynced.current = true;
      const ok = await savePushSubscription(s.subscription, accessToken);
      if (!cancelled) setState(ok ? "on" : "saveFailed");
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const enable = async () => {
    if (!accessToken || busy) return;
    setBusy(true);
    try {
      const r = await subscribeToPush();
      if (r.status !== "subscribed") {
        setState(r.status);
        return;
      }
      if (!r.subscription.endpoint) {
        // VAPID 키 미설정(로컬 데모) — 저장할 구독 없음
        setState("on");
        return;
      }
      const ok = await savePushSubscription(r.subscription, accessToken);
      setState(ok ? "on" : "saveFailed");
    } catch {
      setState("saveFailed");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;

  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);

  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
      <div className="flex items-center gap-3">
        <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: "#FDEEE8", fontSize: 17 }}>📲</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold" style={{ fontSize: 14, color: "#0B2540" }}>이 기기 푸시 알림</span>
          <span className="block mt-0.5" style={{ fontSize: 12.5, color: "#6B7480" }}>
            {state === "on" && "조건에 맞는 매물이 뜨면 바로 알려드려요"}
            {state === "off" && "지금은 꺼져 있어요 · 맞춤 특가 알림은 푸시로만 가요"}
            {state === "denied" && "브라우저에서 알림이 차단돼 있어요"}
            {state === "noncanonical" && "이 주소에서는 알림을 켤 수 없어요"}
            {state === "unsupported" && "이 브라우저는 기기 알림을 지원하지 않아요"}
            {state === "saveFailed" && "알림 등록에 실패했어요"}
          </span>
        </span>
        {state === "on" && (
          <span className="flex-shrink-0 rounded-full font-bold" style={{ fontSize: 12, padding: "4px 10px", background: "#E8F8EC", color: "#1D8A44" }}>
            알림 받는 중
          </span>
        )}
        {(state === "off" || state === "saveFailed") && (
          <button
            type="button"
            onClick={enable}
            disabled={busy || !accessToken}
            className="flex-shrink-0 rounded-full font-bold text-white disabled:opacity-60"
            style={{ fontSize: 13, padding: "8px 14px", background: "var(--color-brandOrange)" }}
          >
            {busy ? "켜는 중…" : state === "saveFailed" ? "다시 시도" : "알림 켜기"}
          </button>
        )}
      </div>

      {state === "denied" && (
        <p className="mt-3 rounded-lg leading-relaxed" style={{ fontSize: 12.5, color: "#6B7480", background: "#F5F6F8", padding: "10px 12px" }}>
          주소창 왼쪽 자물쇠(또는 ⋮ 메뉴 → 사이트 설정)에서 <b style={{ color: "#1A1F26" }}>알림 → 허용</b>으로 바꾼 뒤 이 페이지를 새로고침해주세요.
        </p>
      )}
      {state === "noncanonical" && (
        <p className="mt-3 rounded-lg leading-relaxed" style={{ fontSize: 12.5, color: "#6B7480", background: "#F5F6F8", padding: "10px 12px" }}>
          정식 주소에서 알림을 켜주세요 →{" "}
          <a href={`${SITE_URL}/mypage`} className="font-bold underline" style={{ color: "#E25100" }}>
            {SITE_URL.replace(/^https?:\/\//, "")}
          </a>
        </p>
      )}
      {state === "unsupported" && isIOS && (
        <p className="mt-3 rounded-lg leading-relaxed" style={{ fontSize: 12.5, color: "#6B7480", background: "#F5F6F8", padding: "10px 12px" }}>
          아이폰은 <b style={{ color: "#1A1F26" }}>공유 버튼 → &quot;홈 화면에 추가&quot;</b>로 앱을 설치한 뒤 거기서 열면 알림을 켤 수 있어요.
        </p>
      )}
    </div>
  );
}
