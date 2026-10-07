"use client";

import { useEffect, useState } from "react";
import { fetchPushStatus, getPushState } from "@/lib/pushClient";
import { CONSENT_CHANGED_EVENT, fetchMyConsents } from "@/lib/consentClient";

// "알림 켜짐" 판정 공용 (2026-10-06) — 마이페이지 PushStatusCard("알림 받는 중" 배지)와 회원 홈 AlertInboxHome("✓ 알림 켜짐" 줄).
// 기준: 이 기기 푸시 구독 + 매물 알림(deal_alert_ad) 최신 동의(현재 버전)가 모두 있을 때만.

/** 매물 알림 최신 동의 — null = 모름(조회 전·실패). 동의가 바뀌면(CONSENT_CHANGED_EVENT) 다시 읽음 */
export function useDealAlertConsent(): boolean | null {
  const [dealConsent, setDealConsent] = useState<boolean | null>(null);
  useEffect(() => {
    const load = () =>
      fetchMyConsents().then((c) => {
        if (c) setDealConsent(Boolean(c.deal_alert_ad?.agreed));
      });
    load();
    window.addEventListener(CONSENT_CHANGED_EVENT, load);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, load);
  }, []);
  return dealConsent;
}

export const isAlertsOn = (deviceSubscribed: boolean, dealConsent: boolean | null) => deviceSubscribed && dealConsent === true;

/** 회원 홈용 읽기 전용 판정 — 저장·권한 요청 없이, 브라우저 구독이 있고 서버에도 이 기기가 저장돼 있으며 "알림 끔"이 아닐 때만 구독으로 봄.
 * 화면이 다시 보일 때 다시 확인(다른 화면에서 켜고/끄고 돌아온 경우). */
export function useAlertsOn(): boolean {
  const dealConsent = useDealAlertConsent();
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const s = await getPushState();
      if (s.status !== "subscribed") {
        if (!cancelled) setDeviceSubscribed(false);
        return;
      }
      const st = await fetchPushStatus(s.subscription.endpoint ?? null);
      if (!cancelled) setDeviceSubscribed(Boolean(st && st.thisDeviceSaved && !st.optedOut));
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return isAlertsOn(deviceSubscribed, dealConsent);
}

/** 매물 알림 동의는 true인데 이 기기엔 구독이 없는 이유 (2026-10-07). null = 구독 있음·조회 전 */
export type AlertGapKind = "inapp" | "ios_needs_install" | "denied" | "off" | "unsupported" | "noncanonical";

/** 회원 홈 "알림 받기 동의는 저장됐어요" 카드용 읽기 전용 판정 — 권한 요청·저장 없음. 화면이 다시 보일 때 다시 확인 */
export function useAlertGap(): { consent: boolean | null; kind: AlertGapKind | null } {
  const consent = useDealAlertConsent();
  const [kind, setKind] = useState<AlertGapKind | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const s = await getPushState();
      if (!cancelled) setKind(s.status === "subscribed" ? null : s.status);
    };
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return { consent, kind };
}
