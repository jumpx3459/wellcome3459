import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMemberFromToken } from "@/lib/photoLimitServer";
import { overLimit, UUID_RE } from "@/lib/rateLimit";
import { clientIp } from "@/lib/adminAuth";
import { PROTECTED_SIGNED_TTL_SECONDS, signProtectedPaths } from "@/lib/brandProtected";

// 브랜드 보호 매물의 보호 사진·브랜드명 (2026-10-27, feat/brand-protected) — 로그인 회원만.
// 입력 { dealId, accessToken(authFetch가 붙임) } → 회원 확인(getMemberFromToken, 가격 공개와 같은 기준) 후
//   brand_name + 보호 사진 서명 URL(10분, PROTECTED_SIGNED_TTL_SECONDS)을 돌려줌. 비회원·토큰 무효는 401, 응답은 항상 private·no-store.
// 비공개 버킷(deal-images-protected)의 경로는 응답에 넣지 않고(서명 URL만) DB의 protected_images·brand_name은 이 서버(service role)만 읽는다.
const NO_STORE = { "Cache-Control": "private, no-store" };
const MEMBER_LIMIT = 60; // 회원당 10분 60회(상세 열 때 1회 + 만료·오류 재요청)
const IP_LIMIT = 200;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const dealId = body?.dealId;
  if (typeof dealId !== "string" || !UUID_RE.test(dealId)) return json({ error: "매물 번호가 올바르지 않아요." }, 400);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ demo: true, brandName: null, photos: [] });

  if (overLimit(`dp-ip:${clientIp(req)}`, IP_LIMIT)) return json({ error: "잠시 후 다시 시도해주세요." }, 429);
  const db = createClient(supabaseUrl, serviceKey);
  const member = await getMemberFromToken(db, body?.accessToken);
  if (!member) return json({ error: "로그인이 필요합니다." }, 401);
  if (overLimit(`dp-member:${member.id}`, MEMBER_LIMIT)) return json({ error: "잠시 후 다시 시도해주세요." }, 429);

  const { data: deal, error } = await db.from("deals").select("brand_protected, brand_name, protected_images").eq("id", dealId).maybeSingle();
  if (error) return json({ error: "불러오지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  if (!deal) return json({ error: "매물을 찾을 수 없어요." }, 404);
  if (deal.brand_protected !== true) return json({ brandName: null, photos: [], expiresInSeconds: PROTECTED_SIGNED_TTL_SECONDS });

  const paths: string[] = deal.protected_images ?? [];
  const urls = await signProtectedPaths(db, paths, PROTECTED_SIGNED_TTL_SECONDS);
  return json({
    brandName: deal.brand_name ?? null,
    photos: urls.filter((u): u is string => !!u).map((url) => ({ url })),
    expiresInSeconds: PROTECTED_SIGNED_TTL_SECONDS,
  });
}
