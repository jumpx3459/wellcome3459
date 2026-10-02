import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getMemberFromToken } from "@/lib/photoLimitServer";
import { checkAdminAuth } from "@/lib/adminAuth";
import {
  DEAL_MEDIA_BUCKET, MAX_VIDEO_BYTES, VIDEO_EXT, VIDEO_TOO_LARGE_MESSAGE, VIDEO_TYPE_MESSAGE, baseMimeType,
} from "@/lib/videoUpload";

// 2026-10-02 PR-A: 영상 직접 업로드용 Storage 서명 업로드 URL 발급.
// 영상 파일은 이 함수로 오지 않고(4.5MB 요청 한도), 브라우저가 받은 URL로 Storage에 바로 PUT한다.
// 인증은 /api/upload와 같음 — 관리자(x-admin-key) 또는 로그인 회원(body accessToken), 아니면 401.
// 입력 { contentType, size, ext } — contentType은 기본형으로 정규화해 영상 4종만, size ≤ 50MB(버킷 file_size_limit과 같음).
// 경로는 기존 규칙 video-{uuid}.{ext}(버킷 루트). 확장자는 형식에서 정함(ext가 다르면 400).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // 데모 모드: 실제 저장 없음 — 화면은 로컬 미리보기로 대신함 (/api/upload와 같음)
    return NextResponse.json({ demo: true });
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  if (!(await checkAdminAuth(req)).ok) {
    const member = await getMemberFromToken(supabaseAdmin, body?.accessToken);
    if (!member) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const contentType = baseMimeType(typeof body?.contentType === "string" ? body.contentType : "");
  const ext = VIDEO_EXT[contentType];
  if (!ext || (body?.ext != null && String(body.ext).toLowerCase() !== ext)) {
    return NextResponse.json({ error: VIDEO_TYPE_MESSAGE, field: "video" }, { status: 400 });
  }
  const size = body?.size;
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "영상 크기를 확인하지 못했어요.", field: "video" }, { status: 400 });
  }
  if (size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: VIDEO_TOO_LARGE_MESSAGE, field: "video" }, { status: 400 });
  }

  const path = `video-${crypto.randomUUID()}.${ext}`;
  const bucket = supabaseAdmin.storage.from(DEAL_MEDIA_BUCKET);
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[video-url] sign_error", error);
    return NextResponse.json({ error: "업로드를 준비하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    contentType,
    publicUrl: bucket.getPublicUrl(path).data.publicUrl,
  });
}
