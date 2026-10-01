import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, requireRole } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { resolveSellerDisplay } from "@/lib/sellerDisplay";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

const DEAL_STATUSES: unknown[] = ["active", "closed"];

// 진행 중인 매물 목록 (관리자용 - 재고/마감시간 수정 대상)
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("deals")
    .select("*, categories(name), regions(name)")
    .eq("status", "active")
    .order("closes_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data });
}

// 재고 수량 수정, 마감시간 연장/단축, 조기 마감 처리
export async function PATCH(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, remainingQty, closesAt, status, images, videoUrl, sellerPublic, sellerCompanyName } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  // DB check 제약(deals_status_check)과 같은 값만 허용 — sold_out은 사용처가 없어 제외
  if (status !== undefined && !DEAL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "매물 상태 값이 올바르지 않아요.", field: "status" }, { status: 400 });
  }

  const supabaseAdmin = getAdminClient();
  const update: Record<string, unknown> = {};
  if (remainingQty !== undefined) update.remaining_qty = remainingQty;
  if (closesAt !== undefined) update.closes_at = closesAt;
  if (status !== undefined) update.status = status;
  if (images !== undefined) update.images = images;
  if (videoUrl !== undefined) update.video_url = videoUrl;
  // 2026-09-30: 판매자 표시 수정 — 공개면 상호, 아니면 "비공개 판매자" (sellerDisplay.ts)
  if (sellerPublic !== undefined) Object.assign(update, resolveSellerDisplay(sellerPublic === true, sellerCompanyName));

  const { error } = await supabaseAdmin.from("deals").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// 매물 삭제 — 되돌릴 수 없음. schema.sql상 interests/quick_leads/messages가
// deal_id에 on delete cascade라, 이 매물에 달린 관심표시·쪽지 기록도 함께 삭제됩니다.
export async function DELETE(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  // 2026-10-01: 영구 삭제는 최고관리자만
  const denied = requireRole(auth.admin, ["최고관리자"]);
  if (denied) return denied;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const supabaseAdmin = getAdminClient();
  const { data: before } = await supabaseAdmin.from("deals").select("title, status").eq("id", id).maybeSingle();
  const { error } = await supabaseAdmin.from("deals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabaseAdmin, req, {
    admin: auth.admin,
    action: "deal_delete",
    targetType: "deal",
    targetId: id,
    detail: { title: before?.title ?? null, status: before?.status ?? null },
  });

  return NextResponse.json({ ok: true });
}
