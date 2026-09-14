import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { checkAdminAuth } from "@/lib/adminAuth";

const ROLES = ["최고관리자", "관리자"] as const;

// 임시 비밀번호 — 헷갈리기 쉬운 0/O, 1/I/l은 제외하고 crypto로 생성 (Math.random 아님)
const TEMP_PW_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
function generateTempPassword(length = 12) {
  let pw = "";
  for (let i = 0; i < length; i++) {
    pw += TEMP_PW_CHARS[crypto.randomInt(TEMP_PW_CHARS.length)];
  }
  return pw;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// 관리자 목록 조회 — 임명/해제 버튼은 최고관리자에게만 보이지만, 목록 자체는
// 아무 관리자나 봐도 문제없는 정보(비밀번호 해시 제외)라 별도 role 제한은 두지 않음
export async function GET(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, name, phone, role, last_login_at, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

// 회원을 관리자로 임명 — 최고관리자만 가능. 임시 비밀번호는 이 응답에 한 번만 담겨서
// 돌아오고 DB에는 해시만 저장되므로, 화면에서 놓치면 "비밀번호 변경"으로 다시 발급받아야 함.
export async function POST(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.admin.role !== "최고관리자") {
    return NextResponse.json({ error: "최고관리자만 관리자를 임명할 수 있습니다." }, { status: 403 });
  }

  const { memberId, name, role } = await req.json();
  if (!memberId || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "역할을 선택해주세요." }, { status: 400 });
  }

  const supabaseAdmin = getAdminClient();

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("phone")
    .eq("id", memberId)
    .single();
  if (memberError || !member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .eq("phone", member.phone)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "이미 관리자로 등록된 회원이에요." }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const { data, error } = await supabaseAdmin.rpc("create_admin_user", {
    p_name: name.trim(),
    p_phone: member.phone,
    p_role: role,
    p_password: tempPassword,
  });
  const created = Array.isArray(data) ? data[0] : null;
  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "임명에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    admin: { id: created.id, name: created.name, role: created.role, phone: member.phone },
    tempPassword,
  });
}

// 관리자 해제 — 최고관리자만 가능, 마지막 남은 최고관리자는 해제 불가
export async function DELETE(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.admin.role !== "최고관리자") {
    return NextResponse.json({ error: "최고관리자만 관리자를 해제할 수 있습니다." }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const supabaseAdmin = getAdminClient();

  const { data: target, error: targetError } = await supabaseAdmin
    .from("admin_users")
    .select("id, role")
    .eq("id", id)
    .single();
  if (targetError || !target) {
    return NextResponse.json({ error: "관리자를 찾을 수 없습니다." }, { status: 404 });
  }

  if (target.role === "최고관리자") {
    const { count } = await supabaseAdmin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "최고관리자");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "마지막 남은 최고관리자는 해제할 수 없습니다." }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin.from("admin_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
