import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMemberFromToken } from "@/lib/photoLimitServer";

// "JUMP X에서 입찰 참여하기" 클릭 카운트 — 거래 플랫폼이 준비될 때까지는 실제
// 브릿지로 보내지 않고 "준비중" 안내만 하지만, 수요 신호는 계속 쌓아둔다.
// 2026-09-29: 클릭 출처 — 화이트리스트만 저장, 그 외·미지정은 null(= 예전 JUMP X 입찰 브릿지 버튼)
const ALLOWED_SOURCES = new Set(["preview"]); // preview = 매물 상세 "점프엑스 둘러보기"

export async function POST(req: NextRequest) {
  // 2026-09-29: 회원은 본문 memberId가 아니라 access token으로만 확인 (본문 memberId는 보내도 무시).
  // 토큰 유효 + 회원 행 있음 → 그 회원 / 그 외 → null(비회원 클릭)
  const { dealId, accessToken, source } = await req.json().catch(() => ({}));
  const safeSource = typeof source === "string" && ALLOWED_SOURCES.has(source) ? source : null;
  if (!dealId) return NextResponse.json({ ok: false }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const member = await getMemberFromToken(supabaseAdmin, accessToken);
  await supabaseAdmin.from("bridge_interests").insert({ deal_id: dealId, member_id: member?.id ?? null, source: safeSource });

  return NextResponse.json({ ok: true });
}
