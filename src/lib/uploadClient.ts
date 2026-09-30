import { authFetch } from "@/lib/authFetch";

// /api/upload 호출 공용 (2026-09-30) — 업로드는 로그인 회원 또는 관리자만.
// 관리자 화면은 x-admin-key(관리자 세션 토큰), 회원 화면은 authFetch(토큰 갱신·401 재시도 포함).
export function uploadFormData(formData: FormData, adminKey?: string): Promise<Response> {
  if (adminKey) {
    return fetch("/api/upload", { method: "POST", headers: { "x-admin-key": adminKey }, body: formData });
  }
  return authFetch("/api/upload", { formData });
}
