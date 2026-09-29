import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 비밀번호를 설정했다는 표시를 app_metadata.has_password에 기록 (2026-09-29).
// 호출 시점: 마이페이지에서 비밀번호 설정 성공 직후, 또는 비밀번호로 로그인 성공 직후(이전에 만든 비밀번호 보정).
// 비밀번호 자체는 여기서 다루지 않음 — 설정은 기존처럼 클라이언트 updateUser(보안 비밀번호 변경 설정 유지).
// 잘못 표시돼도 권유 시트가 안 뜰 뿐이라 영향이 없음.
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });
  if (!accessToken) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });
  if (data.user.app_metadata?.has_password === true) return NextResponse.json({ ok: true });

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { ...data.user.app_metadata, has_password: true },
  });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
