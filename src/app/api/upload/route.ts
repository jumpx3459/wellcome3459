import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "deal-images";
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 15초 영상은 대체로 이 안에 들어옵니다

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const video = formData.get("video") as File | null;

  if (!files.length && !video) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  if (!supabaseUrl || !serviceKey) {
    // 데모 모드: 실제 저장 없이 빈 값 반환 (화면에서는 로컬 미리보기만 보임)
    return NextResponse.json({ urls: [], videoUrl: null, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const urls: string[] = [];

  // 2026-09-28: 기본 6장(+추천 리워드로 회원별 bonus_photo_slots만큼 추가, 무제한 아님)
  // — 실제 업로드 개수 제한은 클라이언트(ImageUploader max prop)가 맥락별로 정확히
  // 계산해서 넘겨주므로, 여기 서버 쪽은 정확한 숫자를 다시 계산하지 않고 클라이언트가
  // 우회(개발자도구로 폼에 파일을 더 붙여 보내는 등)해도 과도하게 커지지 않도록 막는
  // 넉넉한 안전판(sanity ceiling) 역할만 함.
  for (const file of files.slice(0, 20)) {
    const ext = file.name.split(".").pop() || "jpg";
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
  if (video && video.size <= MAX_VIDEO_BYTES) {
    const ext = video.name.split(".").pop() || "webm";
    const path = `video-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await video.arrayBuffer();

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: video.type || "video/webm", upsert: false });

    if (!error) {
      const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      videoUrl = data.publicUrl;
    }
  }

  return NextResponse.json({ urls, videoUrl });
}
