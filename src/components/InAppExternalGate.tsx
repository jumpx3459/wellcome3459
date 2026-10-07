"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isInAppBrowser, isKakaoInApp, isStandalone } from "@/lib/browserEnv";
import { copyCurrentUrl, externalTarget, openExternal } from "@/lib/openExternal";
import { withSavedRef } from "@/lib/refStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 2026-10-07: 카톡 등 인앱 브라우저로 /signup·/login에 들어오면, 폼 대신 "크롬/사파리에서 열어 주세요" 전체 화면 안내.
// 인앱 웹뷰는 웹푸시를 받을 수 없고, 카톡·크롬(사파리)은 로그인 저장소가 달라 가입 도중(인증 뒤)에 바깥 브라우저로 나가면
// 로그인이 끊김 → 인증 전(진입 시점)에 한 번만 바깥으로 보낸다.
// 보이는 조건: 인앱 && 홈 화면 앱(standalone) 아님 && 비로그인 && 이 세션에서 "여기서 계속하기"를 안 누름.
// 이미 로그인된 채 들어와 리다이렉트되는 경우엔 안 보임. 버튼은 현재 주소째(returnTo·ref 유지) 넘기고,
// 주소에 ref가 없고 이 기기에 저장된 ref가 있으면 붙여서 넘긴다(src/lib/refStore.ts).
// 하단 탭은 그대로 둠(화면 아래 --nav-bottom 위까지만 덮음). "크롬으로 열기"(InAppBanner·PushBlockerNotice)와 별개 화면.
export const INAPP_GATE_SKIP_KEY = "dj_inapp_gate_skip";

type Info = { browser: "크롬" | "사파리"; manual: boolean; reason: string };

export default function InAppExternalGate() {
  const pathname = usePathname();
  const verb = pathname === "/login" ? "로그인" : "가입";
  const [mode, setMode] = useState<"hidden" | "checking" | "show">("hidden");
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isInAppBrowser() || isStandalone()) return;
    try {
      if (sessionStorage.getItem(INAPP_GATE_SKIP_KEY) === "1") return;
    } catch {}
    const target = externalTarget();
    setInfo({
      browser: target?.browser ?? "사파리",
      manual: !target,
      reason: isKakaoInApp() ? "카카오톡 안에서는 알림을 받을 수 없어요" : "이 앱 안에서는 알림을 받을 수 없어요",
    });
    setMode("checking"); // 세션 확인 동안은 아래 화면이 깜빡이지 않게 흰 화면만
    let cancelled = false;
    (async () => {
      let loggedIn = false;
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          loggedIn = Boolean(data.session?.user);
        } catch {}
      }
      if (!cancelled) setMode(loggedIn ? "hidden" : "show");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "hidden" || !info) return null;

  const keepHere = () => {
    try {
      sessionStorage.setItem(INAPP_GATE_SKIP_KEY, "1");
    } catch {}
    setMode("hidden");
  };

  return (
    <div
      data-testid="inapp-gate"
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-white overflow-y-auto"
      style={{ top: 0, bottom: "var(--nav-bottom)" }}
    >
      {mode === "show" && (
        <>
          <div
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
              backgroundSize: "16px 16px, cover",
              padding: "calc(20px + var(--sat)) 22px 22px",
            }}
          >
            <div className="flex items-center gap-3">
              <Link href="/" aria-label="홈으로" style={{ color: "rgba(255,255,255,0.8)", fontSize: rem(20), lineHeight: 1 }}>
                ←
              </Link>
              <span className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
                <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto" />
              </span>
            </div>
          </div>
          <div className="text-center" style={{ padding: "34px 24px 24px" }}>
            <div className="rounded-full flex items-center justify-center mx-auto" style={{ width: 76, height: 76, background: "#FDEEE8", fontSize: rem(34) }}>
              🔔
            </div>
            <h1 className="font-display mt-4.5" style={{ fontSize: rem(23), color: "#0B2540", letterSpacing: "-0.02em", lineHeight: 1.35 }}>
              알림을 받으려면 {info.browser}에서 {verb}해 주세요
            </h1>
            <p className="mt-2.5" style={{ fontSize: rem(15), color: "#6B7480", lineHeight: 1.6 }}>
              {info.reason}
            </p>
            <div className="text-left">
              {info.manual ? (
                <>
                  <p className="mt-4" style={{ fontSize: rem(15), color: "#495057", lineHeight: 1.55 }}>
                    화면 오른쪽 위 <b>···</b> 메뉴 → <b>사파리로 열기</b>를 눌러 주세요.
                  </p>
                  <button
                    type="button"
                    onClick={async () => setCopied(await copyCurrentUrl(withSavedRef(window.location.href)))}
                    className={`mt-3 w-full ${BTN_CLASS}`}
                    style={btnStyle("secondary")}
                  >
                    {copied ? "링크 복사됨 ✓" : "링크 복사"}
                  </button>
                  {copied === false && (
                    <p className="mt-2 break-all" style={{ fontSize: rem(13), color: "#495057" }}>
                      {withSavedRef(window.location.href)}
                    </p>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openExternal(withSavedRef(window.location.href))}
                  className={`mt-5 w-full ${BTN_CLASS}`}
                  style={btnStyle("primary")}
                >
                  {info.browser}에서 {verb}하기
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={keepHere}
              className="mt-2"
              style={{ background: "none", border: "none", color: "#6B7480", fontSize: rem(14), fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 4, padding: 10 }}
            >
              여기서 계속하기 (알림은 나중에 켤 수 있어요)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
