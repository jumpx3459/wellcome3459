// 브라우저에서 알림 권한을 요청하고, 서비스워커에 푸시 구독을 등록합니다.
// 알라미 앱이 OS 알림을 쓰는 것처럼, 이 웹앱은 Web Push API로
// 카카오톡 같은 중간 채널 없이 기기에 직접 알림을 보냅니다.

import { isCanonicalHost } from "./siteUrl";
import { getPushBlocker } from "./browserEnv";
import { authFetch } from "./authFetch";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type SubscribeResult =
  | { status: "inapp" }
  | { status: "ios_needs_install" }
  | { status: "unsupported" }
  | { status: "noncanonical" }
  | { status: "denied" }
  | { status: "subscribed"; subscription: PushSubscriptionJSON };

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (typeof window === "undefined") return { status: "unsupported" };
  // 인앱 브라우저·iPhone 미설치는 권한 요청 자체가 실패하므로 먼저 걸러냄 (src/lib/browserEnv.ts)
  const blocker = getPushBlocker();
  if (blocker) return { status: blocker };

  // 비정식 주소(xxx.vercel.app 등)에서 구독하면 알림이 계속 그 주소로 열리므로
  // 권한 요청 자체를 하지 않는다 (src/lib/siteUrl.ts 참고).
  if (!isCanonicalHost(window.location.hostname)) {
    return { status: "noncanonical" };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { status: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { status: "denied" };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    // VAPID 키 미설정(로컬 데모) — 권한만 받아둔 상태로 처리
    return { status: "subscribed", subscription: {} as PushSubscriptionJSON };
  }

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  return { status: "subscribed", subscription: subscription.toJSON() };
}

// 권한 요청 없이 현재 상태만 조회합니다 (마이페이지 알림 카드 초기 표시용).
// "subscribed"면 이 기기에 구독이 살아있다는 뜻 — 서버 저장 여부는 따로 확인 필요.
// 판별 순서: inapp → ios_needs_install → noncanonical → unsupported → denied → off/subscribed
export type PushState =
  | { status: "inapp" }
  | { status: "ios_needs_install" }
  | { status: "unsupported" }
  | { status: "noncanonical" }
  | { status: "denied" }
  | { status: "off" }
  | { status: "subscribed"; subscription: PushSubscriptionJSON };

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return { status: "unsupported" };
  const blocker = getPushBlocker();
  if (blocker) return { status: blocker };
  if (!isCanonicalHost(window.location.hostname)) return { status: "noncanonical" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { status: "unsupported" };
  }
  if (Notification.permission === "denied") return { status: "denied" };
  if (Notification.permission !== "granted") return { status: "off" };

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? { status: "subscribed", subscription: subscription.toJSON() } : { status: "off" };
  } catch {
    return { status: "off" };
  }
}

// 구독 정보를 서버에 저장합니다. 결과를 호출부에서 반드시 확인할 것
// (예전엔 결과를 안 봐서 저장이 실패해도 "알림 켜짐"처럼 보였음).
// explicit=true는 사용자가 직접 알림을 켠 경우 — 서버의 "알림 끔"(push_opt_out)을 해제한다.
// explicit 없이 부르면(조용한 재저장) 알림을 끈 회원은 저장되지 않고 "opted_out"이 온다.
export type SaveResult = "saved" | "opted_out" | "failed";

export async function savePushSubscription(
  subscription: PushSubscriptionJSON,
  options: { explicit?: boolean } = {}
): Promise<SaveResult> {
  try {
    // 토큰은 호출할 때마다 authFetch가 최신으로 받음 (만료 시 갱신·1회 재시도)
    const res = await authFetch("/api/push/subscribe", {
      json: { subscription, explicit: options.explicit === true ? true : undefined },
    });
    if (!res.ok) return "failed";
    const data = await res.json().catch(() => ({}));
    return data.skipped === "opted_out" ? "opted_out" : "saved";
  } catch {
    return "failed";
  }
}

// 내 구독 현황 — 다른 기기에서 받는 중인지 표시용. 실패하면 null.
export async function fetchPushStatus(
  endpoint?: string | null
): Promise<{ count: number; thisDeviceSaved: boolean; optedOut: boolean } | null> {
  try {
    const res = await authFetch("/api/push/status", { json: { endpoint: endpoint ?? undefined } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
