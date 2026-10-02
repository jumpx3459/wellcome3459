// 매물 영상 업로드 공용 값 (2026-10-02 PR-A) — 서버·브라우저 공용, 다른 모듈 import 없음.
// 영상은 Vercel 함수 요청 한도(4.5MB) 때문에 /api/upload를 거치지 않고, /api/upload/video-url에서 받은
// Storage 서명 업로드 URL로 브라우저가 직접 올린다. 크기·형식은 deal-images 버킷 설정과 같아야 함:
//   file_size_limit 52428800(50MB) · allowed_mime_types에 아래 영상 4종(+사진 4종).

export const DEAL_MEDIA_BUCKET = "deal-images";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 52428800 — 버킷 file_size_limit과 같은 값
export const VIDEO_TOO_LARGE_MESSAGE = "영상은 50MB 이하만 올릴 수 있어요. 일반 화질로 짧게 찍어주세요";
export const VIDEO_TYPE_MESSAGE = "MP4·MOV·WEBM 영상만 올릴 수 있어요.";

// 형식(파라미터 뺀 기본형) → 저장 확장자
export const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};
const EXT_TO_VIDEO_TYPE: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", "3gp": "video/3gpp" };

/** "video/webm;codecs=vp9,opus" → "video/webm" (MediaRecorder가 codecs를 붙여 줌) */
export function baseMimeType(type: string | null | undefined): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

/** 업로드할 영상 형식(기본형). 브라우저가 형식을 비워 주면(일부 PC의 .mov 등) 파일 이름 확장자로 정함. 모르면 "". */
export function videoContentType(type: string | null | undefined, filename?: string | null): string {
  const base = baseMimeType(type);
  if (base) return VIDEO_EXT[base] ? base : "";
  const ext = (filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_VIDEO_TYPE[ext] ?? "";
}

// 저장 경로 규칙: 버킷 루트 video-{uuid}.{ext}. 2026-09-30 전에는 확장자를 파일 이름에서 따와("MOV"·"blob" 등)
// 기존 매물·신청의 영상 URL과 호환되게 확장자는 영문·숫자 1~16자까지 허용(새 업로드는 위 4종만 만듦).
const VIDEO_PATH_RE = /^video-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9]{1,16}$/i;

export function dealMediaPublicPrefix(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${DEAL_MEDIA_BUCKET}/`;
}

/** 공개 URL이 deal-images 버킷의 video-{uuid}.{ext}이면 그 경로, 아니면 null(외부 URL 등) */
export function dealVideoPathFromUrl(url: string, supabaseUrl: string): string | null {
  const prefix = dealMediaPublicPrefix(supabaseUrl);
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return VIDEO_PATH_RE.test(path) ? path : null;
}
