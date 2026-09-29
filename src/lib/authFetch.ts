import { supabase } from "@/lib/supabase";

// 로그인 토큰이 필요한 우리 API 호출 공용 (2026-09-29).
// 버그: 앱(PWA)을 하루 넘게 켜 두면 처음 받아 state에 저장해 둔 access token이 만료돼
// /api/push/subscribe 등이 401 — 표시·재저장이 조용히 실패했음. 이제 토큰을 저장해 두지 말고
// 호출할 때마다 여기서 최신 토큰을 받는다.
//   1) 호출 직전 getSession() — 만료(임박)면 refreshSession()
//   2) 401이면 refreshSession() 후 1회 재시도
//   3) 그래도 401이면 "dj:auth-expired" 이벤트 → AuthExpiredNotice가 "다시 로그인해주세요" 표시
// 우리 API는 토큰을 body의 accessToken으로 받으므로(JSON 또는 FormData) 거기에 넣어 보낸다.

export const AUTH_EXPIRED_EVENT = "dj:auth-expired";
const REFRESH_MARGIN_S = 60; // 만료 60초 전부터는 미리 갱신

export async function getFreshAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt && expiresAt - Date.now() / 1000 < REFRESH_MARGIN_S) {
    const { data: refreshed } = await supabase.auth.refreshSession();
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

export async function authFetch(url: string, init: AuthFetchInit = {}): Promise<Response> {
  const token = await getFreshAccessToken();
  if (!token) return unauthorized(); // 애초에 로그인 안 한 상태 — 만료 안내는 띄우지 않음

  const res = await fetch(url, buildInit(init, token));
  if (res.status !== 401 || !supabase) return res;

  // 서버가 거부 → 한 번 갱신해서 재시도
  const { data: refreshed } = await supabase.auth.refreshSession();
  const newToken = refreshed.session?.access_token;
  if (newToken) {
    const retry = await fetch(url, buildInit(init, newToken));
    if (retry.status !== 401) return retry;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  return res;
}
