// 웹푸시를 받을 수 없는 브라우저 환경 판별 (2026-09-28, 10/1 공개 전 필수).
// 카카오 채널 링크는 대부분 카톡 인앱 브라우저로 열리는데, 인앱 웹뷰는 웹푸시를 지원하지 않고
// iPhone은 "홈 화면에 추가"한 앱에서만 웹푸시가 된다(iOS 16.4+).

const INAPP_UA = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i;

export type PushBlocker = "inapp" | "ios_needs_install";

export function isInAppBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return INAPP_UA.test(ua);
}

export function isKakaoInApp(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /KAKAOTALK/i.test(ua);
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+는 데스크톱 Safari처럼 "MacIntel"로 보고됨 — 터치 지원으로 구분
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

// 2026-09-29: 홈 화면 설치 수동 안내를 브라우저별로 나누기 위한 판별 (삼성인터넷 실기기 확인)
export function isSamsungInternet(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /SamsungBrowser/i.test(ua);
}

// 안드로이드 Chrome — 크로미움 기반 다른 브라우저(엣지·오페라·웨일·삼성 등)와 웹뷰(; wv)는 제외
export function isAndroidChrome(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /Android/i.test(ua) && /Chrome\/\d+/.test(ua) && !/SamsungBrowser|EdgA|OPR|Whale|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser|DuckDuckGo|; wv\)/i.test(ua);
}

export type ManualInstallBrowser = "samsung" | "chrome" | "other";

export function getManualInstallBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): ManualInstallBrowser {
  if (isSamsungInternet(ua)) return "samsung";
  if (isAndroidChrome(ua)) return "chrome";
  return "other";
}

// 홈 화면에 추가된 앱(standalone)으로 실행 중인지
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

// 판별 순서: 인앱 → iOS 미설치 (둘 다 아니면 null — 이후 정식 주소/지원 여부/권한은 pushClient가 판단)
export function getPushBlocker(): PushBlocker | null {
  if (typeof window === "undefined") return null;
  if (isInAppBrowser()) return "inapp";
  if (isIOS() && !isStandalone()) return "ios_needs_install";
  return null;
}
