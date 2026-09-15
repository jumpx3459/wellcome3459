import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 로그인한 회원이 관리자 계정(admin_users)과 같은 휴대폰번호를 쓰는지 확인합니다.
// 관리자 인증(비밀번호)과 회원 인증(휴대폰)이 서로 분리돼 있어서, 회원 access
// token으로 신원을 검증한 뒤 서버가 대신 admin_users를 phone 기준으로 조회합니다.
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ isAdmin: false });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });
  }

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("phone")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!member?.phone) {
    return NextResponse.json({ isAdmin: false });
  }

  // admin_users.phone은 SQL Editor에서 수동으로 입력되는 값이라 대시가 섞여
  // 들어갈 수 있는데, member.phone은 항상 숫자만 있는 형태라 exact match가
  // 안 될 수 있음 — 숫자만 남겨서 비교합니다.
  const memberPhoneDigits = member.phone.replace(/[^0-9]/g, "");
  const { data: admins } = await supabaseAdmin.from("admin_users").select("name, role, phone");
  const admin = admins?.find((a) => a.phone?.replace(/[^0-9]/g, "") === memberPhoneDigits);
  if (!admin) {
    return NextResponse.json({ isAdmin: false });
  }

  return NextResponse.json({ isAdmin: true, name: admin.name, role: admin.role });
}
