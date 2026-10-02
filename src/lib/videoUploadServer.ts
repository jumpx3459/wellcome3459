import type { SupabaseClient } from "@supabase/supabase-js";
import { DEAL_MEDIA_BUCKET, dealVideoPathFromUrl } from "@/lib/videoUpload";

// 서버 전용 (2026-10-02 PR-A): 매물·판매 신청에 저장할 video_url 검사.
// 영상은 브라우저가 Storage에 직접 올리므로, 저장 API가 받은 URL이 우리 버킷의 영상 경로인지·실제로 있는지 확인한다.
//   비어 있음(영상 없음) → 통과 / unchanged(기존 매물에 이미 저장된 값)와 같으면 → 그대로 통과
export async function checkDealVideoUrl(
  db: SupabaseClient,
  videoUrl: unknown,
  opts: { unchanged?: string | null } = {},
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (videoUrl == null || videoUrl === "") return { ok: true };
  if (typeof videoUrl !== "string") return { ok: false, status: 400, error: "영상 주소가 올바르지 않아요." };
  if (opts.unchanged && videoUrl === opts.unchanged) return { ok: true };

  const path = dealVideoPathFromUrl(videoUrl, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!path) return { ok: false, status: 400, error: "영상 주소가 올바르지 않아요. 영상을 다시 올려주세요." };

  try {
    const { data, error } = await db.storage.from(DEAL_MEDIA_BUCKET).exists(path);
    if (data === true) return { ok: true };
    if (data === false) return { ok: false, status: 400, error: "올린 영상을 찾을 수 없어요. 영상을 다시 올려주세요." };
    console.error("[checkDealVideoUrl] exists_error", error);
  } catch (e) {
    console.error("[checkDealVideoUrl] exists_error", e);
  }
  return { ok: false, status: 500, error: "영상을 확인하지 못했어요. 잠시 후 다시 시도해주세요." };
}
