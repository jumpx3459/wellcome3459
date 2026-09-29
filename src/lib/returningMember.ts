// 재방문 회원 판별 (2026-09-29) — 로그아웃 상태로 온 기존 회원에게 가입 온보딩 대신 "다시 오셨네요" 화면.
// 신호: 이 기기에서 로그인한 적 있음(dj_was_member) · 로그인 방식 기억값(dj_login_method, /login) · 푸시 구독.
// 플래그는 로그인 세션이 확인될 때마다 저장(AppShell), 지우는 건 명시적 로그아웃·탈퇴 때만
// (세션 만료·갱신 실패로 풀린 경우는 그대로 둬야 재방문 화면이 뜬다).

export const WAS_MEMBER_KEY = "dj_was_member";
export const LOGIN_METHOD_KEY = "dj_login_method"; // login/page.tsx와 같은 키

export type LoginMethod = "otp" | "password";

export function markReturningMember(): void {
  try {
    localStorage.setItem(WAS_MEMBER_KEY, "1");
  } catch {}
}

// 명시적 로그아웃·탈퇴 전용
export function clearReturningMember(): void {
  try {
    localStorage.removeItem(WAS_MEMBER_KEY);
    localStorage.removeItem(LOGIN_METHOD_KEY);
  } catch {}
}

export function getRememberedLoginMethod(): LoginMethod | null {
  try {
    const v = localStorage.getItem(LOGIN_METHOD_KEY);
    return v === "otp" || v === "password" ? v : null;
  } catch {
    return null;
  }
}

export function hasLoginHistory(): boolean {
  try {
    return localStorage.getItem(WAS_MEMBER_KEY) === "1" || getRememberedLoginMethod() !== null;
  } catch {
    return false;
  }
}

// 이 브라우저에 푸시 구독이 살아 있는지 (권한 허용 + 구독 있음). 서버 호출 없음, 최대 1.5초.
export async function hasActivePushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  const check = (async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  })().catch(() => false);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500));
  return Promise.race([check, timeout]);
}
