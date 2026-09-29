"use client";

import { useEffect, useRef, useState } from "react";
import { getPushState, subscribeToPush, savePushSubscription, fetchPushStatus } from "@/lib/pushClient";
import { SITE_URL } from "@/lib/siteUrl";
import { rem } from "@/lib/rem";
import PushBlockerNotice from "@/components/PushBlockerNotice";
import { UI_CARD_TITLE, UI_DESC, UI_LINK } from "@/lib/uiText";

// 2026-09-28: 마이페이지 알림 상태 카드. 예전엔 푸시 구독이 가입 화면에서만 가능해서
// 기존 회원이 알림을 다시 켤 곳이 없었음(구독자 0명). 권한 요청은 반드시 버튼 클릭
// 핸들러 안에서만 한다 — 마운트 시엔 getPushState()로 현재 상태만 조회.
// 2026-09-29: 토큰은 authFetch가 호출할 때마다 최신으로 받음(오래 켜 둔 PWA에서 만료 토큰 401 버그).
// 조용한 재저장 실패는 화면에 띄우지 않고(콘솔만), 실패 문구는 [알림 켜기]를 눌렀을 때만.
type CardState = "loading" | "inapp" | "ios_needs_install" | "unsupported" | "noncanonical" | "denied" | "off" | "on" | "optedOut" | "saveFailed";

export default function PushStatusCard() {
  const [state, setState] = useState<CardState>("loading");
  const [busy, setBusy] = useState(false);
  const [otherDevices, setOtherDevices] = useState(0); // 이 기기 말고 알림 받는 내 기기 수
  const resynced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getPushState();
      if (cancelled) return;
      const endpoint = s.status === "subscribed" ? s.subscription.endpoint ?? null : null;

      if (s.status === "subscribed") {
        // 브라우저 구독이 살아 있으면 기본 표시는 "알림 받는 중"
        setState("on");
        // 기기엔 구독이 있는데 DB엔 없는 경우(가입 때 저장 실패 등) 복구용으로 조용히 1회 재저장.
        // API가 endpoint 기준 upsert라 이미 있으면 그대로 덮어쓸 뿐. "알림만 끄기"한 회원이면
        // 서버가 저장을 건너뛰고 opted_out → 그건 사용자가 끈 상태라 그대로 보여줌.
        if (!resynced.current) {
          resynced.current = true;
          const saved = await savePushSubscription(s.subscription);
          if (cancelled) return;
          if (saved === "opted_out") setState("optedOut");
          else if (saved === "failed") console.warn("[push] 조용한 재저장 실패 — 표시는 유지");
        }
      } else {
        setState(s.status);
      }

      const st = await fetchPushStatus(endpoint);
      if (cancelled || !st) return;
      setOtherDevices(Math.max(0, st.count - (st.thisDeviceSaved ? 1 : 0)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    if (busy) return;
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
      const saved = await savePushSubscription(r.subscription, { explicit: true });
      setState(saved === "failed" ? "saveFailed" : "on");
    } catch {
      setState("saveFailed");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;
  const thisDeviceOff = state !== "on";

  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
      <div className="flex items-center gap-3">
        <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: "#FDEEE8", fontSize: rem(17) }}>📲</span>
        <span className="flex-1 min-w-0">
          {/* 2026-09-29: 배지를 제목 옆으로 — 오른쪽에 두면 설명이 3줄로 꺾였음. 설명은 최대 2줄 */}
          <span className="flex items-center gap-1.5 flex-wrap">
            <span style={UI_CARD_TITLE}>이 기기 푸시 알림</span>
            {state === "on" && (
              <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: rem(14), padding: "2px 9px", background: "#E8F8EC", color: "#1D8A44" }}>
                알림 받는 중
              </span>
            )}
          </span>
          <span className="block mt-0.5" style={{ ...UI_DESC, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {state === "on" && "조건에 맞는 매물이 뜨면 빠르게 알려드려요"}
            {(state === "inapp" || state === "ios_needs_install") && "지금 이 화면에서는 알림을 켤 수 없어요"}
            {state === "off" && "지금은 꺼져 있어요 · 맞춤 특가 알림은 푸시로만 가요"}
            {state === "denied" && "브라우저에서 알림이 차단돼 있어요"}
            {state === "noncanonical" && "이 주소에서는 알림을 켤 수 없어요"}
            {state === "unsupported" && "이 브라우저는 기기 알림을 지원하지 않아요"}
            {state === "optedOut" && "알림을 끈 상태예요"}
            {state === "saveFailed" && "알림 등록에 실패했어요. 다시 시도해주세요"}
          </span>
        </span>
        {(state === "off" || state === "optedOut" || state === "saveFailed") && (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="flex-shrink-0 rounded-full text-white disabled:opacity-60 whitespace-nowrap"
            style={{ ...UI_LINK, padding: "8px 14px", background: "var(--color-brandOrangeDeep)" }}
          >
            {busy ? "켜는 중…" : state === "saveFailed" ? "다시 시도" : state === "optedOut" ? "다시 켜기" : "알림 켜기"}
          </button>
        )}
      </div>

      {/* 이 기기는 꺼져 있어도 다른 기기(폰·PC 등)로는 받고 있을 수 있음 */}
      {thisDeviceOff && state !== "optedOut" && otherDevices > 0 && (
        <p className="mt-3 rounded-lg" style={{ fontSize: rem(14), color: "#1D8A44", background: "#E8F8EC", padding: "8px 12px" }}>
          ✓ 다른 기기 {otherDevices}대에서 알림 받는 중이에요
        </p>
      )}

      {state === "denied" && (
        <p className="mt-3 rounded-lg leading-relaxed" style={{ fontSize: rem(14), color: "#4B5563", background: "#F5F6F8", padding: "10px 12px" }}>
          주소창 왼쪽 자물쇠(또는 ⋮ 메뉴 → 사이트 설정)에서 <b style={{ color: "#1A1F26" }}>알림 → 허용</b>으로 바꾼 뒤 이 페이지를 새로고침해주세요.
        </p>
      )}
      {state === "noncanonical" && (
        <p className="mt-3 rounded-lg leading-relaxed" style={{ fontSize: rem(14), color: "#4B5563", background: "#F5F6F8", padding: "10px 12px" }}>
          정식 주소에서 알림을 켜주세요 →{" "}
          <a href={`${SITE_URL}/mypage`} className="font-bold underline" style={{ color: "#E25100" }}>
            {SITE_URL.replace(/^https?:\/\//, "")}
          </a>
        </p>
      )}
      {/* 인앱 브라우저·iPhone 미설치 — [알림 켜기] 버튼 없이 안내만 (눌러도 실패) */}
      {(state === "inapp" || state === "ios_needs_install") && (
        <div className="mt-3">
          <PushBlockerNotice kind={state} />
        </div>
      )}
    </div>
  );
}
