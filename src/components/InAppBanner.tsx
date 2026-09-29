"use client";

import { useEffect, useState } from "react";
import { isInAppBrowser, isKakaoInApp, isStandalone } from "@/lib/browserEnv";
import { openExternal, copyCurrentUrl, externalTarget, type ExternalTarget } from "@/lib/openExternal";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 2026-09-28: 카카오 채널 링크 등으로 인앱 브라우저에서 홈·/deals·매물 상세에 들어오면 안내.
// 인앱에선 웹푸시가 안 되므로 크롬/사파리로 유도. 매물 내용은 막지 않는다.
//   1) 세션 첫 진입: 하단 시트(딤 배경) 1회 — "그냥 볼게요"를 누르면 닫히고 상단 띠로 전환
//   2) 상단 띠: 화면 상단 고정 + 같은 높이 여백. ×로 닫으면 그 세션 동안 숨김
// 회원 홈처럼 자체 고정 헤더가 있는 화면은 --inapp-banner-h만큼 헤더를 내린다(AlertInboxHome).
// 2026-09-29: 실기기 피드백("작고 눈에 안 띈다") — 시트 추가, 띠를 52px·주황·16px로 키우고
// "외부 브라우저" 대신 "크롬으로/사파리로 열기"로.
export const INAPP_BANNER_HEIGHT = 52;
const BAND_DISMISS_KEY = "dj_inapp_banner_dismissed";
const SHEET_SHOWN_KEY = "dj_inapp_sheet_shown";

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
  const [mode, setMode] = useState<"none" | "sheet" | "band">("none");
  const [target, setTarget] = useState<ExternalTarget>(null);
  const [kakao, setKakao] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isInAppBrowser() || isStandalone()) return;
    setTarget(externalTarget());
    setKakao(isKakaoInApp());
    if (!readFlag(SHEET_SHOWN_KEY)) {
      writeFlag(SHEET_SHOWN_KEY);
      setMode("sheet");
    } else if (!readFlag(BAND_DISMISS_KEY)) {
      setMode("band");
    }
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
  const browser = target?.browser ?? "사파리";
  const appName = kakao ? "카톡" : "이 앱";

  if (mode === "sheet") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true" aria-label="알림 받는 방법 안내">
        <div className="w-full max-w-md bg-white rounded-t-3xl text-center" style={{ padding: "26px 20px calc(20px + env(safe-area-inset-bottom))" }}>
          <div aria-hidden style={{ fontSize: rem(40), lineHeight: 1 }}>🔔</div>
          <p className="font-black mt-3" style={{ fontSize: rem(20), color: "#0B2540" }}>
            {appName}에서는 새 매물 알림을 못 받아요
          </p>
          <p className="mt-1.5" style={{ fontSize: rem(16), color: "#495057" }}>
            {browser}에서 열면 관심 매물이 뜰 때 빠르게 알려드려요
          </p>
          {target ? (
            <button
              type="button"
              onClick={act}
              className={`w-full mt-5 ${BTN_CLASS}`}
              style={btnStyle("primary")}
            >
              {target.label}
            </button>
          ) : (
            <>
              <p className="mt-4 rounded-xl" style={{ fontSize: rem(16), color: "#1A1F26", background: "#FFF4E0", padding: "12px 14px" }}>
                화면 오른쪽 위 <b>···</b> 메뉴 → <b>사파리로 열기</b>
              </p>
              <button
                type="button"
                onClick={act}
                className={`w-full mt-3 ${BTN_CLASS}`}
                style={btnStyle("primary")}
              >
                {copied ? "링크 복사됨 ✓" : "링크 복사"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setMode(readFlag(BAND_DISMISS_KEY) ? "none" : "band")}
            className="mt-3 w-full"
            style={{ minHeight: 44, fontSize: rem(15), color: "#6B7480" }}
          >
            그냥 볼게요
          </button>
        </div>
      </div>
    );
  }

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
