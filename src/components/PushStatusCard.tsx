"use client";

import { useEffect, useRef, useState } from "react";
import { getPushState, subscribeToPush, savePushSubscription, fetchPushStatus, refreshPushSubscriptionIfStale, unsubscribeThisDevice } from "@/lib/pushClient";
import { deviceLabel } from "@/lib/deviceLabel";
import { SITE_URL } from "@/lib/siteUrl";
import { rem } from "@/lib/rem";
import PushBlockerNotice from "@/components/PushBlockerNotice";
import IosInstallSteps from "@/components/IosInstallSteps";
import { copyCurrentUrl, externalTarget, openExternal } from "@/lib/openExternal";
import { isKakaoInApp } from "@/lib/browserEnv";
import { UI_CARD_TITLE, UI_DESC, UI_LINK, BTN_CLASS, btnStyle } from "@/lib/uiText";
import ConsentSheet from "@/components/ConsentSheet";
import { CONSENT_TEXT } from "@/lib/consent";
import { announceConsents, saveConsents } from "@/lib/consentClient";
import { isAlertsOn, useDealAlertConsent } from "@/lib/useAlertsOn";

// 2026-09-28: 마이페이지 알림 상태 카드. 예전엔 푸시 구독이 가입 화면에서만 가능해서
// 기존 회원이 알림을 다시 켤 곳이 없었음(구독자 0명). 권한 요청은 반드시 버튼 클릭
// 핸들러 안에서만 한다 — 마운트 시엔 getPushState()로 현재 상태만 조회.
// 2026-09-29: 토큰은 authFetch가 호출할 때마다 최신으로 받음(오래 켜 둔 PWA에서 만료 토큰 401 버그).
// 조용한 재저장 실패는 화면에 띄우지 않고(콘솔만), 실패 문구는 [알림 켜기]를 눌렀을 때만.
// 2026-09-30: 매물 알림 수신 동의(deal_alert_ad) 최신 값이 true가 아니면 [알림 켜기] 전에 동의 시트 →
// 동의 저장(source push_enable)과 구독을 같은 클릭에서 시작(권한 요청이 클릭 안에 있어야 해서 저장을 기다리지 않음).
// 2026-09-30: 기기는 구독 중인데 동의가 없으면 "동의 필요" 배지 + [동의하고 알림 받기](source mypage) —
// 초록 "알림 받는 중"은 구독 + 동의가 모두 있을 때만.
type CardState = "loading" | "inapp" | "ios_needs_install" | "unsupported" | "noncanonical" | "denied" | "off" | "on" | "optedOut" | "saveFailed";

export default function PushStatusCard() {
  const [state, setState] = useState<CardState>("loading");
  const [busy, setBusy] = useState(false);
  const [otherDevices, setOtherDevices] = useState(0); // 이 기기 말고 알림 받는 내 기기 수
  const resynced = useRef(false);
  const dealConsent = useDealAlertConsent(); // null = 모름(조회 전·실패) — 회원 홈 "알림 켜짐" 줄과 같은 판정(src/lib/useAlertsOn.ts)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  // 2026-10-01: 이 기기 이름·마지막 발송 성공 시각, [이 기기 알림 끄기]
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [linkCopied, setLinkCopied] = useState<boolean | null>(null); // 아이폰 기타 인앱 — 링크 복사 결과

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setThisDevice(deviceLabel(navigator.userAgent));
      // 예전 VAPID 키로 묶인 구독이면 지금 키로 다시 구독(조용히) — 그 뒤 상태를 읽음
      await refreshPushSubscriptionIfStale();
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
      setLastSuccessAt((st as { lastSuccessAt?: string | null }).lastSuccessAt ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () => {
    if (busy) return;
    setConsentError(null);
    if (dealConsent !== true) {
      setSheetOpen(true);
      return;
    }
    subscribe();
  };

  const agreeAndEnable = async () => {
    setConsentError(null);
    const consents = [{ type: "deal_alert_ad" as const, agreed: true }];
    const saving = saveConsents(consents, "push_enable");
    setSheetOpen(false);
    await subscribe();
    const r = await saving;
    if (r.ok) announceConsents(consents, r.recordedAt);
    else setConsentError("매물 알림 수신 동의 저장에 실패했어요. 다시 시도해주세요.");
  };

  // 구독은 이미 있음 — 동의만 저장
  const agreeOnly = async () => {
    if (busy) return;
    setConsentError(null);
    setBusy(true);
    const consents = [{ type: "deal_alert_ad" as const, agreed: true }];
    const r = await saveConsents(consents, "mypage");
    setBusy(false);
    setSheetOpen(false);
    if (r.ok) announceConsents(consents, r.recordedAt);
    else setConsentError("매물 알림 수신 동의 저장에 실패했어요. 다시 시도해주세요.");
  };

  const subscribe = async () => {
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

  const turnOffThisDevice = async () => {
    if (turningOff) return;
    setTurningOff(true);
    const r = await unsubscribeThisDevice();
    setTurningOff(false);
    if (r === "off") {
      setState("off");
      setLastSuccessAt(null);
    } else {
      setConsentError("알림을 끄지 못했어요. 다시 시도해주세요.");
    }
  };

  if (state === "loading") return null;
  const thisDeviceOff = state !== "on";
  const needsConsent = state === "on" && dealConsent === false;

  // 2026-10-07: 매물 알림 동의는 true인데 이 기기는 알림을 받을 수 없는 4가지(인앱 / 아이폰 미설치 / 권한 거부(팝업 닫기 포함) / 구독 저장 실패) —
  // "동의는 저장됐어요 · 이 기기는 아직 알림을 받을 수 없어요" 한 틀로 사실대로 표시(초록 "알림 받는 중"은 안 씀). 동의 저장 로직은 그대로.
  const gapState = dealConsent === true && (state === "inapp" || state === "ios_needs_install" || state === "denied" || state === "saveFailed");
  if (gapState) {
    const target = externalTarget();
    const hardDenied = typeof Notification !== "undefined" && Notification.permission === "denied";
    return (
      <div data-push-gap={state} className="rounded-2xl p-4" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
        <div className="flex items-center gap-3">
          <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: "#FDEEE8", fontSize: rem(17) }}>📲</span>
          <span className="flex items-center gap-1.5 flex-wrap">
            <span style={UI_CARD_TITLE}>이 기기 푸시 알림</span>
            <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: rem(14), padding: "2px 9px", background: "#FEF3C7", color: "#92400E" }}>
              받을 수 없음
            </span>
          </span>
        </div>
        <p className="mt-3 font-extrabold" style={{ fontSize: rem(15), color: "#1A1F26", lineHeight: 1.5 }}>동의는 저장됐어요 · 이 기기는 아직 알림을 받을 수 없어요</p>

        {state === "inapp" && (
          <>
            <p className="mt-1" style={{ fontSize: rem(15), color: "#4B5563", lineHeight: 1.55 }}>
              {isKakaoInApp() ? "카카오톡" : "이 앱"} 안에서는 알림을 받을 수 없어요. {target ? `${target.browser}에서 열어 알림을 켜 주세요.` : "사파리에서 열어 알림을 켜 주세요."}
            </p>
            {target ? (
              <button type="button" onClick={() => openExternal()} className={`mt-3 w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
                {target.browser}에서 열기
              </button>
            ) : (
              <>
                <p className="mt-2" style={{ fontSize: rem(14), color: "#495057" }}>화면 오른쪽 위 <b>···</b> 메뉴 → <b>사파리로 열기</b>를 눌러주세요.</p>
                <button
                  type="button"
                  onClick={async () => setLinkCopied(await copyCurrentUrl())}
                  className={`mt-3 w-full ${BTN_CLASS}`}
                  style={btnStyle("secondary")}
                >
                  {linkCopied ? "링크 복사됨 ✓" : "링크 복사"}
                </button>
              </>
            )}
          </>
        )}

        {state === "ios_needs_install" && (
          <>
            <p className="mt-1" style={{ fontSize: rem(15), color: "#4B5563", lineHeight: 1.55 }}>아이폰은 홈 화면에 추가해야 알림이 와요.</p>
            <div className="mt-3 rounded-lg" style={{ background: "#F5F6F8", padding: "12px 14px" }}>
              <IosInstallSteps />
            </div>
          </>
        )}

        {state === "denied" && (
          <>
            <p className="mt-1" style={{ fontSize: rem(15), color: "#4B5563", lineHeight: 1.55 }}>
              알림 권한이 꺼져 있어요. (권한 팝업을 닫은 경우도 같아요)
            </p>
            <button type="button" onClick={subscribe} disabled={busy} className={`mt-3 w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
              {busy ? "켜는 중…" : "다시 시도"}
            </button>
            <p className="mt-3 rounded-lg leading-relaxed" style={{ fontSize: rem(14), color: "#4B5563", background: "#F5F6F8", padding: "10px 12px" }}>
              {hardDenied ? "브라우저에서 알림을 막아 둔 상태예요. " : ""}계속 안 되면: 주소창 왼쪽 자물쇠(또는 ⋮ 메뉴 → 사이트 설정) → <b style={{ color: "#1A1F26" }}>알림 → 허용</b> 후 새로고침
            </p>
          </>
        )}

        {state === "saveFailed" && (
          <>
            <p className="mt-1" style={{ fontSize: rem(15), color: "#4B5563", lineHeight: 1.55 }}>알림 등록 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.</p>
            <button type="button" onClick={enable} disabled={busy} className={`mt-3 w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
              {busy ? "켜는 중…" : "다시 시도"}
            </button>
          </>
        )}

        {consentError && (
          <p className="mt-3 font-medium" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>{consentError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
      <div className="flex items-center gap-3">
        <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: "#FDEEE8", fontSize: rem(17) }}>📲</span>
        <span className="flex-1 min-w-0">
          {/* 2026-09-29: 배지를 제목 옆으로 — 오른쪽에 두면 설명이 3줄로 꺾였음. 설명은 최대 2줄 */}
          <span className="flex items-center gap-1.5 flex-wrap">
            <span style={UI_CARD_TITLE}>이 기기 푸시 알림</span>
            {isAlertsOn(state === "on", dealConsent) && (
              <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: rem(14), padding: "2px 9px", background: "#E8F8EC", color: "#1D8A44" }}>
                알림 받는 중
              </span>
            )}
            {needsConsent && (
              <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: rem(14), padding: "2px 9px", background: "#FDEEE8", color: "#E25100" }}>
                동의 필요
              </span>
            )}
          </span>
          <span className="block mt-0.5" style={{ ...UI_DESC, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {state === "on" && dealConsent !== false && "조건에 맞는 매물이 뜨면 빠르게 알려드려요"}
            {state === "on" && dealConsent === false && "매물 알림 수신에 동의하지 않아 알림이 가지 않아요"}
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

      {state === "on" && (
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span style={{ fontSize: rem(14), color: "#6B7480" }}>
            이 기기: {thisDevice ?? "이 브라우저"}
            {lastSuccessAt
              ? ` · 마지막 알림 ${new Date(lastSuccessAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </span>
          <button
            type="button"
            onClick={turnOffThisDevice}
            disabled={turningOff}
            className="rounded-full font-bold whitespace-nowrap disabled:opacity-60"
            style={{ fontSize: rem(14), padding: "6px 12px", border: "1px solid #E4E7EB", background: "#fff", color: "#4B5563" }}
          >
            {turningOff ? "끄는 중…" : "이 기기 알림 끄기"}
          </button>
        </div>
      )}

      {needsConsent && (
        <button
          type="button"
          onClick={() => {
            setConsentError(null);
            setSheetOpen(true);
          }}
          disabled={busy}
          className={`${BTN_CLASS} w-full mt-3`}
          style={btnStyle("primary")}
        >
          {busy ? "저장 중…" : "동의하고 알림 받기"}
        </button>
      )}

      {consentError && (
        <p className="mt-3 font-medium" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>{consentError}</p>
      )}

      {sheetOpen && (
        <ConsentSheet
          title={CONSENT_TEXT.deal_alert_ad.pushTitle}
          items={[{ type: "deal_alert_ad", required: true, tag: "선택", label: CONSENT_TEXT.deal_alert_ad.label, desc: CONSENT_TEXT.deal_alert_ad.pushDesc }]}
          primaryLabel={needsConsent ? "동의하고 알림 받기" : "동의하고 알림 켜기"}
          pendingLabel={needsConsent ? "알림을 받으려면 동의해주세요" : "알림을 켜려면 동의해주세요"}
          onSubmit={needsConsent ? agreeOnly : agreeAndEnable}
          busy={needsConsent && busy}
          onCancel={() => setSheetOpen(false)}
        />
      )}

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
