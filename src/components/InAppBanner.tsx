"use client";

import { useEffect, useState } from "react";
import { isInAppBrowser, isStandalone } from "@/lib/browserEnv";
import { openExternal, copyCurrentUrl, externalTarget, type ExternalTarget } from "@/lib/openExternal";
import { rem } from "@/lib/rem";

// 2026-09-28: 카카오 채널 링크 등으로 인앱 브라우저에서 홈·/deals·매물 상세에 들어오면 안내.
// 인앱에선 웹푸시가 안 되므로 크롬/사파리로 유도. 매물 내용은 막지 않는다.
//   상단 띠: 화면 상단 고정 + 같은 높이 여백. ×로 닫으면 그 세션 동안 숨김
// 2026-10-03: 첫 방문 하단 딤 시트 제거 — 첫 화면에서 외부 브라우저 전환을 요구하지 않는다(띠는 막지 않는 안내).
//   알림을 켜는 단계(가입 화면·MY 알림 카드)에서는 PushBlockerNotice가 그대로 안내.
// 회원 홈처럼 자체 고정 헤더가 있는 화면은 --inapp-banner-h만큼 헤더를 내린다(AlertInboxHome).
// 2026-09-29: 실기기 피드백("작고 눈에 안 띈다") — 시트 추가, 띠를 52px·주황·16px로 키우고
// "외부 브라우저" 대신 "크롬으로/사파리로 열기"로.
export const INAPP_BANNER_HEIGHT = 52;
const BAND_DISMISS_KEY = "dj_inapp_banner_dismissed";

const readFlag = (key: string) => {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (key: string) => {
  try {
    sessionStorage.setItem(key, "1");
  } catch {}
};

export default function InAppBanner() {
  const [mode, setMode] = useState<"none" | "band">("none");
  const [target, setTarget] = useState<ExternalTarget>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isInAppBrowser() || isStandalone()) return;
    setTarget(externalTarget());
    if (!readFlag(BAND_DISMISS_KEY)) setMode("band");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "band") root.style.setProperty("--inapp-banner-h", `${INAPP_BANNER_HEIGHT}px`);
    else root.style.removeProperty("--inapp-banner-h");
    return () => {
      root.style.removeProperty("--inapp-banner-h");
    };
  }, [mode]);

  if (mode === "none") return null;

  // 자동으로 열 수 없는 경우(iPhone 기타 인앱)는 링크 복사 + 메뉴 안내
  const act = async () => {
    if (target && openExternal()) return;
    setCopied(await copyCurrentUrl());
  };

  const dismissBand = () => {
    setMode("none");
    writeFlag(BAND_DISMISS_KEY);
  };

  return (
    <>
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-md z-30 flex items-center gap-2"
        style={{ top: "var(--sat)", height: INAPP_BANNER_HEIGHT, padding: "0 6px 0 14px", background: "var(--color-brandOrangeDeep)", color: "#fff" }}
        role="region"
        aria-label="알림 받는 방법 안내"
      >
        <span className="flex-1 min-w-0 truncate font-bold" style={{ fontSize: rem(16) }}>
          {target ? "🔔 알림 받으려면" : copied ? "🔔 ··· → 사파리로 열기" : "🔔 ··· 메뉴 → 사파리로"}
        </span>
        <button
          type="button"
          onClick={act}
          className="flex-shrink-0 font-black rounded-full"
          style={{ background: "#fff", color: "var(--color-brandOrangeDeep)", padding: "8px 14px", fontSize: rem(15) }}
        >
          {target ? target.label : copied ? "복사됨 ✓" : "링크 복사"}
        </button>
        <button type="button" onClick={dismissBand} aria-label="닫기" className="flex-shrink-0" style={{ width: 36, height: 36, fontSize: rem(22), color: "rgba(255,255,255,.9)" }}>
          ×
        </button>
      </div>
      <div style={{ height: INAPP_BANNER_HEIGHT }} aria-hidden />
    </>
  );
}
