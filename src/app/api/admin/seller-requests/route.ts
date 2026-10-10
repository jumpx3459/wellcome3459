import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerRequests"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("seller_requests")
    .select("*, categories(name), regions(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerRequests"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

  const { id, status, linkedDealId } = await req.json();
  if (!id || !status) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  // 2026-10-04 판매자 신원 확인: 승인은 매물 등록(POST /api/admin/deals — 사업자 조회 통과 검사)으로만.
  // 여기서 approved·매물 연결을 직접 넣으면 그 검사를 우회하므로 거부. 화면은 거절에만 씀
  if (status === "approved" || linkedDealId != null) {
    return NextResponse.json({ error: "승인은 [매물로 등록하기]로만 할 수 있어요." }, { status: 400 });
  }
  // 2026-10-10: 이 경로는 거절 전용(화면은 rejected만 보냄) — 다른 값은 400
  if (status !== "rejected") return NextResponse.json({ error: "거절만 할 수 있어요.", field: "status" }, { status: 400 });

  const supabaseAdmin = getAdminClient();
  // 대기 중인 신청만 — 이미 승인된 신청을 거절로 바꾸면 매물 연결과 어긋남
  const { data, error } = await supabaseAdmin
    .from("seller_requests")
    // 2026-10-10: 이름 글자(reviewed_by)는 그대로 두고 처리한 관리자 id·시각도 남김(매니저 실적)
    .update({ status, reviewed_by: auth.admin.name, reviewed_by_admin_id: auth.admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "이미 처리된 신청이에요" }, { status: 409 });
  await writeAudit(supabaseAdmin, req, {
    admin: auth.admin,
    action: "seller_request_reject",
    targetType: "seller_request",
    targetId: String(id),
    detail: { status },
  });

  return NextResponse.json({ ok: true });
}
