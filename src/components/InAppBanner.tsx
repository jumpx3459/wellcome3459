"use client";

import { useEffect, useState } from "react";
import { isInAppBrowser } from "@/lib/browserEnv";
import { openExternal, copyCurrentUrl } from "@/lib/openExternal";
import { rem } from "@/lib/rem";

// 2026-09-28: 카카오 채널 링크 등으로 인앱 브라우저에서 홈·/deals·매물 상세에 들어오면 상단 얇은 배너.
// 인앱에선 웹푸시가 안 되므로 외부 브라우저로 유도. 닫으면 그 세션 동안 숨김.
// 화면 상단에 고정(fixed)하고 같은 높이의 여백을 흐름에 넣는다. 회원 홈처럼 자체 고정 헤더가 있는
// 화면은 --inapp-banner-h 만큼 헤더를 내린다(AlertInboxHome).
export const INAPP_BANNER_HEIGHT = 44;
const DISMISS_KEY = "dj_inapp_banner_dismissed";

export default function InAppBanner() {
  const [show, setShow] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!isInAppBrowser()) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (!dismissed) setShow(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (show) root.style.setProperty("--inapp-banner-h", `${INAPP_BANNER_HEIGHT}px`);
    else root.style.removeProperty("--inapp-banner-h");
    return () => {
      root.style.removeProperty("--inapp-banner-h");
    };
  }, [show]);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const open = async () => {
    if (openExternal()) return;
    // iOS 인앱(카톡 외)은 자동으로 못 엶 — 링크를 복사해두고 메뉴 안내
    await copyCurrentUrl();
    setManual(true);
  };

  return (
    <>
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 flex items-center gap-2"
        style={{ height: INAPP_BANNER_HEIGHT, padding: "0 8px 0 14px", background: "#0B2540", color: "#fff", fontSize: rem(13) }}
        role="region"
        aria-label="외부 브라우저 안내"
      >
        <span className="flex-1 min-w-0 truncate">
          {manual ? "링크 복사됨 · ··· 메뉴 → Safari로 열기" : "알림을 받으려면 외부 브라우저로 여세요"}
        </span>
        {!manual && (
          <button
            type="button"
            onClick={open}
            className="flex-shrink-0 font-bold rounded-full"
            style={{ background: "#FF6F0F", color: "#fff", padding: "5px 12px", fontSize: rem(13) }}
          >
            열기
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label="닫기" className="flex-shrink-0" style={{ width: 32, height: 32, fontSize: rem(18), color: "rgba(255,255,255,.7)" }}>
          ×
        </button>
      </div>
      <div style={{ height: INAPP_BANNER_HEIGHT }} aria-hidden />
    </>
  );
}
