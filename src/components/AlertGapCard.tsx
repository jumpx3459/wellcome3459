"use client";

import { useEffect, useState } from "react";
import TabLink from "@/components/TabLink";
import { useAlertGap, type AlertGapKind } from "@/lib/useAlertsOn";
import { rem } from "@/lib/rem";

// 2026-10-07: 회원 홈 맨 위 1회 카드 — 매물 알림 동의는 저장됐는데 이 기기는 알림을 받을 수 없을 때(가입 직후 포함) 사실대로 알림.
// ✕로 닫으면 이 기기에서 다시 안 뜸. 인앱 브라우저(kind "inapp")에서는 InAppBanner와 중복이라 숨김. 알림이 실제로 켜지면(구독 생김) 저절로 사라짐. 권한 요청·저장은 하지 않음(읽기 전용).
const DISMISS_KEY = "dj_alert_gap_dismissed";

function causeLine(kind: Exclude<AlertGapKind, "inapp">): { text: string; link?: string } {
  switch (kind) {
    case "ios_needs_install":
      return { text: "아이폰은 홈 화면에 추가해야 알림이 와요.", link: "방법 보기 ›" };
    case "denied":
      return { text: "이 기기의 알림 권한이 꺼져 있어요. MY에서 다시 시도해 주세요.", link: "MY에서 켜기 ›" };
    case "off":
      return { text: "이 기기에서 알림을 켜면 새 매물을 받을 수 있어요.", link: "알림 켜기 ›" };
    case "unsupported":
      return { text: "이 브라우저는 기기 알림을 지원하지 않아요." };
    case "noncanonical":
      return { text: "이 주소에서는 알림을 켤 수 없어요. 정식 주소에서 열어 주세요." };
  }
}

export default function AlertGapCard() {
  const { consent, kind } = useAlertGap();
  const [dismissed, setDismissed] = useState(true); // 확인 전엔 숨김(깜빡임 방지)
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // 인앱 브라우저에서는 숨김 — 홈 상단 띠(InAppBanner "🔔 알림 받으려면 [크롬으로 열기]")와 같은 안내라 중복
  // 2026-10-09 PR 4a: 권한 거부(denied)·이 기기 구독 없음(off)은 회원 홈 "🔕 알림이 꺼져 있어요"(배너 아래)가 맡아서 숨김 —
  //   이 카드는 알림이 안 되는 환경(아이폰 홈 화면 추가 전·미지원 브라우저·정식 주소 아님)만
  if (dismissed || consent !== true || kind === null || kind === "inapp" || kind === "denied" || kind === "off") return null;
  const c = causeLine(kind);
  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      data-alert-gap
      role="status"
      className="relative"
      style={{ margin: "12px 20px 0", background: "#FFF4E0", border: "1.5px solid #F5D9A8", borderRadius: 16, padding: "14px 44px 14px 14px" }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="닫기"
        className="absolute flex items-center justify-center"
        style={{ right: 2, top: 2, width: 44, height: 44, color: "#6B7280", fontSize: rem(16), background: "none", border: "none" }}
      >
        ✕
      </button>
      <div className="font-extrabold" style={{ fontSize: rem(17), color: "#0B2540", lineHeight: 1.35 }}>알림 받기 동의는 저장됐어요</div>
      <p className="mt-1" style={{ fontSize: rem(15), color: "#1A1F26", lineHeight: 1.5 }}>{c.text}</p>
      {c.link && (
        <TabLink href="/mypage#alerts" className="inline-block mt-1.5 font-bold underline" style={{ fontSize: rem(15), color: "#E25100", textUnderlineOffset: 4 }}>
          {c.link}
        </TabLink>
      )}
    </div>
  );
}
