import type { SupabaseClient } from "@supabase/supabase-js";
import { getPhotoLimit } from "@/lib/photoLimit";

// 서버 전용: 요청한 회원의 사진 한도를 access token으로 다시 계산 (클라이언트가 보낸 한도·memberId는 믿지 않음).
// 토큰이 없거나 무효면(비회원 매물 등록 등) 기본 한도.
export async function getPhotoLimitForToken(supabaseAdmin: SupabaseClient, accessToken: unknown): Promise<number> {
  if (typeof accessToken !== "string" || !accessToken) return getPhotoLimit(null);
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return getPhotoLimit(null);
  const { data: member } = await supabaseAdmin
    .from("members")
    .select("bonus_photo_slots")
    .eq("id", data.user.id)
    .maybeSingle();
  return getPhotoLimit(member);
}
