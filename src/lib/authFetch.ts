import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// 로그인 토큰이 필요한 우리 API 호출 공용 (2026-09-29).
// 버그: 앱(PWA)을 하루 넘게 켜 두면 처음 받아 state에 저장해 둔 access token이 만료돼
// /api/push/subscribe 등이 401 — 표시·재저장이 조용히 실패했음. 이제 토큰을 저장해 두지 말고
// 호출할 때마다 여기서 최신 토큰을 받는다.
//   1) 호출 직전 getSession() — 만료(임박)면 refreshSession()
//   2) 401이면 refreshSession() 후 1회 재시도
//   3) 그래도 401이면 "dj:auth-expired" 이벤트 → AuthExpiredNotice가 "다시 로그인해주세요" 표시
// 우리 API는 토큰을 body의 accessToken으로 받으므로(JSON 또는 FormData) 거기에 넣어 보낸다.
//
// 2026-10-03 fix/offline-auth-misjudge: 오프라인에서 토큰 갱신이 실패하면 예전엔 null → 가짜 401 "로그인이 필요합니다."
// (사진 업로드 재시도 없음·/sell 비회원 화면). 이제 네트워크 실패(auth-js AuthRetryableFetchError·navigator.onLine false·
// fetch 실패)는 AuthNetworkError로 던진다 — 세션 없음·refresh token 무효(AuthApiError 등)만 지금처럼 null → 401.
// 오프라인에서도 auth-js는 세션을 지우지 않음(2.110.8 _callRefreshToken: 재시도 가능 오류면 _removeSession 안 함).

export const AUTH_EXPIRED_EVENT = "dj:auth-expired";
const REFRESH_MARGIN_S = 60; // 만료 60초 전부터는 미리 갱신

/** 인터넷 연결 문제로 토큰을 못 받았거나 요청을 못 보냄 — 로그인 만료가 아님. 호출처는 isAuthNetworkError로 구분 */
export class AuthNetworkError extends Error {
  constructor(cause?: unknown) {
    super("인터넷 연결이 끊겼어요.", { cause });
    this.name = "AuthNetworkError";
  }
}

export function isAuthNetworkError(error: unknown): error is AuthNetworkError {
  return error instanceof Error && error.name === "AuthNetworkError";
}

// onLine === true는 연결을 보장하지 않지만 false는 확실히 끊긴 상태 — 갱신 시도(auth-js 재시도로 최대 ~25초) 전에 바로 실패
function throwIfOffline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new AuthNetworkError();
}

export async function getFreshAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  throwIfOffline();
  const { data, error } = await supabase.auth.getSession();
  // 만료(임박)된 세션을 getSession이 안에서 갱신하다 네트워크로 실패 — auth-js는 토큰이 아직 유효하면 세션을 그대로 주므로
  // 여기 오는 건 토큰이 실제로 만료된 경우
  if (!data.session && isAuthRetryableFetchError(error)) throw new AuthNetworkError(error);
  const session = data.session;
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt && expiresAt - Date.now() / 1000 < REFRESH_MARGIN_S) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (isAuthRetryableFetchError(refreshError)) {
      if (expiresAt * 1000 > Date.now()) return session.access_token; // 갱신은 실패했지만 지금 토큰은 아직 유효
      throw new AuthNetworkError(refreshError);
    }
    return refreshed.session?.access_token ?? null;
  }
  return session.access_token;
}

type AuthFetchInit = {
  method?: string;
  json?: Record<string, unknown>;
  formData?: FormData;
};

function buildInit(init: AuthFetchInit, token: string): RequestInit {
  if (init.formData) {
    const fd = new FormData();
    init.formData.forEach((v, k) => {
      if (k !== "accessToken") fd.append(k, v);
    });
    fd.append("accessToken", token);
    return { method: init.method ?? "POST", body: fd };
  }
  return {
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(init.json ?? {}), accessToken: token }),
  };
}

const unauthorized = () =>
  new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401, headers: { "Content-Type": "application/json" } });

async function send(url: string, init: AuthFetchInit, token: string): Promise<Response> {
  try {
    return await fetch(url, buildInit(init, token));
  } catch (e) {
    throw new AuthNetworkError(e); // 요청 자체가 못 나감(오프라인 등)
  }
}

export async function authFetch(url: string, init: AuthFetchInit = {}): Promise<Response> {
  const token = await getFreshAccessToken(); // 네트워크 문제면 AuthNetworkError
  if (!token) return unauthorized(); // 애초에 로그인 안 한 상태 — 만료 안내는 띄우지 않음

  const res = await send(url, init, token);
  if (res.status !== 401 || !supabase) return res;

  // 서버가 거부 → 한 번 갱신해서 재시도
  throwIfOffline();
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (isAuthRetryableFetchError(refreshError)) throw new AuthNetworkError(refreshError); // 만료 안내 대신 연결 문제
  const newToken = refreshed.session?.access_token;
  if (newToken) {
    const retry = await send(url, init, newToken);
    if (retry.status !== 401) return retry;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  return res;
}
