import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

// 로그인된 관리자 본인 비밀번호 변경 — id는 클라이언트가 아니라 검증된 세션 토큰에서만 가져옴
export async function POST(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { oldPassword, newPassword } = await req.json();
  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "현재/새 비밀번호를 모두 입력해주세요." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "새 비밀번호는 8자 이상으로 입력해주세요." }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data, error } = await supabaseAdmin.rpc("update_admin_password", {
    p_id: auth.admin.id,
    p_old_password: oldPassword,
    p_new_password: newPassword,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });

  return NextResponse.json({ ok: true });
}
