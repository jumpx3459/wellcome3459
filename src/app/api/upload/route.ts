import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPhotoLimit, photoLimitError, MAX_PHOTO_SLOTS } from "@/lib/photoLimit";
import { getMemberFromToken } from "@/lib/photoLimitServer";
import { checkAdminAuth } from "@/lib/adminAuth";
import { VIDEO_EXT, baseMimeType } from "@/lib/videoUpload";

const BUCKET = "deal-images";
// 2026-10-02 PR-A: 화면(VideoUploader)은 이제 /api/upload/video-url로 Storage에 직접 올림 — 아래 영상 분기는 예전 클라이언트 호환용으로 남김
// (이 함수를 거치면 Vercel 요청 한도 4.5MB가 먼저 걸림)
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 15초 영상은 대체로 이 안에 들어옵니다
// 2026-09-30: 형식·크기 검사 — 사진은 화면에서 JPEG로 줄여 보내지만(resizeImage) 직접 호출도 막기 위해 서버에서 다시 확인.
// SVG는 스크립트를 담을 수 있어 제외. 확장자는 파일 이름이 아니라 형식에서 정함. 크기는 마이페이지 사진 한도(20MB) 기준.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 2026-09-30: 본문이 없거나 multipart가 아니면 예전엔 여기서 예외 → 500. 관리자면 400, 아니면(토큰도 없음) 401
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return (await checkAdminAuth(req)).ok
      ? NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
      : NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const files = formData.getAll("files") as File[];
  const video = formData.get("video") as File | null;

  if (!files.length && !video) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  // 2026-09-30: 로그인 회원(토큰) 또는 관리자(x-admin-key)만 업로드 — 판매 신청이 회원 전용이 되면서
  // 비회원 업로드 경로가 없어짐. 회원 사진 한도(6 + 추천 보너스, 최대 16)는 토큰의 회원 기준으로 서버에서 다시 계산,
  // 관리자는 최대치. ImageUploader는 장당 1요청이라 매물 한 건의 총 장수는 /api/seller-requests에서 한 번 더 막는다.
  if (!supabaseUrl || !serviceKey) {
    // 데모 모드: 실제 저장 없이 빈 값 반환 (화면에서는 로컬 미리보기만 보임)
    return NextResponse.json({ urls: [], videoUrl: null, demo: true });
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  let photoLimit = MAX_PHOTO_SLOTS;
  if (!(await checkAdminAuth(req)).ok) {
    const member = await getMemberFromToken(supabaseAdmin, formData.get("accessToken"));
    if (!member) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    photoLimit = getPhotoLimit(member);
  }

  for (const file of files) {
    if (typeof file === "string" || !IMAGE_EXT[file.type]) {
      return NextResponse.json({ error: "JPG·PNG·WEBP·GIF 사진만 올릴 수 있어요.", field: "images" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "20MB 이하 사진만 올릴 수 있어요.", field: "images" }, { status: 400 });
    }
  }
  if (video) {
    // MediaRecorder로 자른 영상은 "video/webm;codecs=…"처럼 올 수 있어 기본형으로 비교(videoUpload.ts baseMimeType)
    const videoType = typeof video === "string" ? "" : baseMimeType(video.type);
    if (!VIDEO_EXT[videoType]) {
      return NextResponse.json({ error: "MP4·MOV·WEBM 영상만 올릴 수 있어요.", field: "video" }, { status: 400 });
    }
    if (video.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "25MB 이하 영상만 올릴 수 있어요.", field: "video" }, { status: 400 });
    }
  }

  if (files.length > photoLimit) {
    return NextResponse.json({ error: photoLimitError(photoLimit), field: "images" }, { status: 400 });
  }

  const urls: string[] = [];

  // 2026-09-28: 기본 6장(+추천 리워드로 회원별 bonus_photo_slots만큼 추가, 무제한 아님)
  // — 실제 업로드 개수 제한은 클라이언트(ImageUploader max prop)가 맥락별로 정확히
  // 계산해서 넘겨주므로, 여기 서버 쪽은 정확한 숫자를 다시 계산하지 않고 클라이언트가
  // 우회(개발자도구로 폼에 파일을 더 붙여 보내는 등)해도 과도하게 커지지 않도록 막는
  // 넉넉한 안전판(sanity ceiling) 역할만 함. (2026-09-29: 위에서 회원 한도도 검사, 20장 상한은 그대로 유지)
  for (const file of files.slice(0, 20)) {
    const ext = IMAGE_EXT[file.type];
    const path = `${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (!error) {
      const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      urls.push(data.publicUrl);
    }
  }

  let videoUrl: string | null = null;
  if (video) {
    const videoType = baseMimeType(video.type);
    const ext = VIDEO_EXT[videoType];
    const path = `video-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await video.arrayBuffer();

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: videoType, upsert: false });

    if (!error) {
      const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      videoUrl = data.publicUrl;
    }
  }

  return NextResponse.json({ urls, videoUrl });
}
