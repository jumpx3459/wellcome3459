import { authFetch } from "@/lib/authFetch";
import { VIDEO_TOO_LARGE_MESSAGE, VIDEO_TYPE_MESSAGE } from "@/lib/videoUpload";

// 2026-10-02: 응답이 JSON이 아니면(Vercel 413 "Request Entity Too Large" 페이지 등) res.json()이 예외를 내서
// 원인이 묻혔음 — 같은 상태 코드의 JSON { error } 응답으로 바꿔서 돌려줌(호출부는 그대로 res.json() 사용).
function statusMessage(status: number): string {
  if (status === 413) return "파일이 너무 커서 올리지 못했어요.";
  if (status === 401) return "로그인이 필요합니다.";
  if (status >= 500) return "서버 문제로 올리지 못했어요. 잠시 후 다시 시도해주세요.";
  return "업로드에 실패했어요. 다시 시도해주세요.";
}

async function asJsonResponse(res: Response): Promise<Response> {
  if ((res.headers.get("content-type") ?? "").includes("application/json")) return res;
  return new Response(JSON.stringify({ error: statusMessage(res.status) }), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

// /api/upload 호출 공용 (2026-09-30) — 업로드는 로그인 회원 또는 관리자만.
// 관리자 화면은 x-admin-key(관리자 세션 토큰), 회원 화면은 authFetch(토큰 갱신·401 재시도 포함).
export async function uploadFormData(formData: FormData, adminKey?: string): Promise<Response> {
  const res = adminKey
    ? await fetch("/api/upload", { method: "POST", headers: { "x-admin-key": adminKey }, body: formData })
    : await authFetch("/api/upload", { formData });
  return asJsonResponse(res);
}

// 2026-10-02 PR-A: 영상 직접 업로드 — /api/upload/video-url에서 서명 업로드 URL을 받는다(인증은 /api/upload와 같음).
export async function requestVideoUploadUrl(
  input: { contentType: string; size: number; ext: string },
  adminKey?: string,
): Promise<Response> {
  const res = adminKey
    ? await fetch("/api/upload/video-url", {
        method: "POST",
        headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    : await authFetch("/api/upload/video-url", { json: input });
  return asJsonResponse(res);
}

// 서명 URL로 Storage에 직접 PUT — supabase-js 2.110.8 storage-js uploadToSignedUrl(Blob 본문)과 같은 요청:
//   PUT {signedUrl}(= {SUPABASE_URL}/storage/v1/object/upload/sign/{bucket}/{path}?token=…)
//   헤더: apikey · Authorization: Bearer {anon key}(세션 없는 클라이언트와 같음) · x-upsert: false
//   본문: multipart FormData — "cacheControl"="3600", ""=파일(파트 Content-Type = 파일 형식)
// fetch로는 업로드 진행률을 못 받아 XHR(upload.onprogress)로 보낸다. 파일 형식은 기본형으로 다시 감싸서 보냄
// ("video/webm;codecs=…" 그대로면 버킷 allowed_mime_types와 안 맞을 수 있음).
export function uploadToSignedUrlWithProgress(
  signedUrl: string,
  file: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", new Blob([file], { type: contentType }));

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
    }
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ ok: true });
        return;
      }
      // Storage 오류 본문: { statusCode, error, message } — 버킷 크기·형식 제한은 413 / 415(또는 400 + mime 문구)
      let message = "";
      try {
        const parsed = JSON.parse(xhr.responseText);
        message = `${parsed?.error ?? ""} ${parsed?.message ?? ""} ${parsed?.statusCode ?? ""}`.toLowerCase();
      } catch {}
      if (xhr.status === 413 || message.includes("413") || message.includes("maximum allowed size")) {
        resolve({ ok: false, error: VIDEO_TOO_LARGE_MESSAGE });
      } else if (xhr.status === 415 || message.includes("mime")) {
        resolve({ ok: false, error: VIDEO_TYPE_MESSAGE });
      } else {
        resolve({ ok: false, error: "영상 업로드에 실패했어요. 잠시 후 다시 시도해주세요." });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "네트워크 문제로 영상을 올리지 못했어요. 연결을 확인하고 다시 시도해주세요." });
    xhr.send(body);
  });
}
