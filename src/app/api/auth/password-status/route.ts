import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 내 계정에 비밀번호가 있는지 (2026-09-29) — 로그인 화면 "비밀번호를 만들어 두세요" 시트 판단용.
// 본인 access token으로만 조회, 비밀번호 관련 정보는 불리언 하나만 돌려줌.
// 기준: app_metadata.has_password (서버만 쓸 수 있음 — /api/auth/mark-password가 기록).
// 이전 배포(b936f0e)에서 user_metadata에 남긴 값도 과도기로 인정.
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ hasPassword: false, demo: true });
  if (!accessToken) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });

  const u = data.user;
  const hasPassword = u.app_metadata?.has_password === true || u.user_metadata?.has_password === true;
  return NextResponse.json({ hasPassword });
}
