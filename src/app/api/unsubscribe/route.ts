import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  // members.phone은 대시 없는 "010XXXXXXXX" 형태로 저장되는데, 이 페이지 입력
  // placeholder("010-0000-0000")대로 대시를 넣어 입력하면 매칭이 안 되던 문제 —
  // 숫자만 남겨서 비교합니다.
  const normalizedPhone = typeof phone === "string" ? phone.replace(/[^0-9]/g, "") : "";
  if (!normalizedPhone) {
    return NextResponse.json({ error: "휴대폰 번호를 입력해주세요." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // 데모 모드: 실제 저장이 없으므로 성공만 반환
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("phone", normalizedPhone)
    .single();

  if (!member) {
    return NextResponse.json({ error: "해당 번호로 가입된 회원을 찾을 수 없습니다." }, { status: 404 });
  }

  // 구독/관심/카테고리·지역 연결 정보를 모두 삭제하고 회원 정보도 파기합니다.
  await supabaseAdmin.from("push_subscriptions").delete().eq("member_id", member.id);
  await supabaseAdmin.from("member_categories").delete().eq("member_id", member.id);
  await supabaseAdmin.from("member_regions").delete().eq("member_id", member.id);
  await supabaseAdmin.from("interests").delete().eq("member_id", member.id);
  await supabaseAdmin.from("members").delete().eq("id", member.id);

  return NextResponse.json({ ok: true });
}
