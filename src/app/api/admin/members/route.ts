import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { can } from "@/lib/adminPerms";
import { maskPhone } from "@/lib/phone";
import { writeAudit } from "@/lib/adminAudit";
import { loadAdminMembers } from "@/lib/adminLists";

// 최근 가입 회원 목록 (관리자용 - 신규 가입 현황 파악)
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "members"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const result = await loadAdminMembers(supabaseAdmin);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  // 2026-10-01: 회원 연락처가 담긴 목록 조회 — 호출 단위로 감사 로그
  // 2026-10-10 권한표: 전체 번호는 최고관리자만. 관리자(일반)는 가운데를 가린 번호(010-****-1234) + [번호 보기](members/[id]/phone, 감사 기록)
  const full = can(auth.admin.role, "memberPhoneFull");
  const items = full
    ? result.items
    : result.items.map((m) => ({ ...m, phone: maskPhone(m.phone), referrer_phone: m.referrer_phone ? maskPhone(m.referrer_phone) : null, phone_masked: true }));
  await writeAudit(supabaseAdmin, req, { admin: auth.admin, action: "members_list_view", targetType: "members", detail: { count: result.items.length, masked: !full } });

  return NextResponse.json({ items });
}
