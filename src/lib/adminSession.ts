// 관리자 세션 만료 대응 (2026-10-26, fix/admin-session-expiry) — 브라우저 공용(서버 import 없음).
// 관리자 화면의 요청이 401(세션 만료)을 받으면 "한 곳"에서 알려서, 화면이 대시보드·입력을 그대로 둔 채 그 자리에 로그인 창을 띄운다.
//   · 토큰 발급 경로는 기존 /api/admin/login 하나뿐 — 연장·갱신 API 없음. [연장] = 비밀번호 다시 입력.
//   · 이벤트에는 "401을 받은 토큰"을 실어, 이미 새 토큰으로 바뀐 뒤 늦게 도착한 옛 요청의 401이 로그인 창을 다시 띄우지 못하게 한다.

export const ADMIN_AUTH_EXPIRED_EVENT = "dj-admin-auth-expired";
export const ADMIN_AUTH_RESTORED_EVENT = "dj-admin-auth-restored";

/** 사진 업로드가 401일 때 칸 아래 문구 — 로그인하면 실패한 사진이 자동으로 다시 올라감 */
export const ADMIN_PHOTO_AUTH_MESSAGE = "관리자 로그인이 끝났어요. 다시 로그인하면 이어서 올라가요";
/** 영상은 자동 재시도가 없어 [다시 시도] 안내 */
export const ADMIN_VIDEO_AUTH_MESSAGE = "관리자 로그인이 끝났어요. 다시 로그인한 뒤 [다시 시도]를 눌러주세요";
/** 폼 저장이 401일 때 — 자동 재제출은 하지 않음(중복 등록·알림 발송 방지) */
export const adminSaveAuthMessage = (button: string) => `관리자 로그인이 끝났어요. 다시 로그인한 뒤 [${button}]을 눌러주세요. 입력한 내용은 그대로예요`;

/** 이 토큰으로 보낸 요청이 401을 받았다고 알림 */
export function notifyAdminAuthExpired(key: string | undefined | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EXPIRED_EVENT, { detail: { key: key ?? null } }));
}

/** 새 토큰으로 다시 로그인했다고 알림 — 실패한 사진 업로드가 이 신호로 한 번 다시 시도함 */
export function notifyAdminAuthRestored() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_AUTH_RESTORED_EVENT));
}

/** 응답이 401이면 알리고 응답은 그대로 돌려줌(429·403 등은 만료가 아님) */
export function noteAdminResponse(res: Response, key: string | undefined | null): Response {
  if (res.status === 401) notifyAdminAuthExpired(key);
  return res;
}

/** 관리자 API 호출 — x-admin-key를 붙이고 401을 한 곳에서 알림. init.headers는 합쳐서 씀 */
export async function adminFetch(input: string, adminKey: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), "x-admin-key": adminKey } });
  return noteAdminResponse(res, adminKey);
}

/** 남은 시간 경고 기준 — 10분 이하면 상단에 "곧 로그아웃돼요" */
export const ADMIN_SESSION_WARN_MS = 10 * 60 * 1000;
