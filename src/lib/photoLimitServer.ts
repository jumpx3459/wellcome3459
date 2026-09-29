import type { SupabaseClient } from "@supabase/supabase-js";
import { getPhotoLimit } from "@/lib/photoLimit";

// 서버 전용: access token으로 요청한 회원을 확인 (클라이언트가 보낸 memberId·한도는 믿지 않음).
// 토큰이 없거나 무효면, 또는 members 행이 없으면 null (비회원 매물 등록 등).
export async function getMemberFromToken(
  supabaseAdmin: SupabaseClient,
  accessToken: unknown,
): Promise<{ id: string; bonus_photo_slots: number | null } | null> {
  if (typeof accessToken !== "string" || !accessToken) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, bonus_photo_slots")
    .eq("id", data.user.id)
    .maybeSingle();
  // 인증은 됐지만 회원 행이 없으면(가입 전) 비회원으로 — seller_member_id FK가 members.id라서
  if (!member) return null;
  return { id: member.id, bonus_photo_slots: member.bonus_photo_slots ?? null };
}

// 요청한 회원의 사진 한도 — 토큰 없음·무효면 기본 한도
export async function getPhotoLimitForToken(supabaseAdmin: SupabaseClient, accessToken: unknown): Promise<number> {
  return getPhotoLimit(await getMemberFromToken(supabaseAdmin, accessToken));
}
