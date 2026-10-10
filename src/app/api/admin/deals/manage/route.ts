import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { resolveSellerDisplay } from "@/lib/sellerDisplay";
import { checkDealVideoUrl } from "@/lib/videoUploadServer";
import { normalizeTitle, DUPLICATE_TITLE_WARNING } from "@/lib/titleGuard";
import { isLumpSum } from "@/lib/priceUnit";
import { storageSummary } from "@/lib/dealFields";
import { DEAL_EDIT_KEYS, validateDealEdit, dealEditWarnings, effectivePriceMode, type DealEditInput } from "@/lib/dealEdit";

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
  const denied = requirePerm(auth.admin, "dealEdit"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

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
// 2026-10-03 feat/admin-deal-edit: 매물명·판매가·정상가·MOQ·소비기한·추가 설명·마감 일시도 수정 — 검증은 src/lib/dealEdit.ts
// (등록과 같은 규칙·문구, 마감 ≤ 소비기한 23:59). 수정·연장은 알림을 다시 보내지 않음(sendDealPush 호출 없음).
export async function PATCH(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "dealEdit"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;

  const body = await req.json();
  const { id, remainingQty, status, images, videoUrl, sellerPublic, sellerCompanyName, confirmWarnings } = body;
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  // DB check 제약(deals_status_check)과 같은 값만 허용 — sold_out은 사용처가 없어 제외
  if (status !== undefined && !DEAL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "매물 상태 값이 올바르지 않아요.", field: "status" }, { status: 400 });
  }

  const supabaseAdmin = getAdminClient();
  // 2026-10-01: 마감(status closed)은 감사 로그용으로 바꾸기 전 상태를 읽어 둠
  const before =
    status === "closed" ? (await supabaseAdmin.from("deals").select("title, status").eq("id", id).maybeSingle()).data : null;
  // 2026-10-02 PR-A: 영상 URL 검사 — 이미 저장된 값과 같으면(기존 매물 수정) 그대로 통과, 비우기(null)도 허용
  if (videoUrl !== undefined && videoUrl !== null && videoUrl !== "") {
    const { data: current } = await supabaseAdmin.from("deals").select("video_url").eq("id", id).maybeSingle();
    const videoCheck = await checkDealVideoUrl(supabaseAdmin, videoUrl, { unchanged: current?.video_url ?? null });
    if (!videoCheck.ok) return NextResponse.json({ error: videoCheck.error, field: "video" }, { status: videoCheck.status });
  }
  const update: Record<string, unknown> = {};
  const edit: DealEditInput = {};
  for (const k of DEAL_EDIT_KEYS) if (body[k] !== undefined) (edit as Record<string, unknown>)[k] = body[k];
  if (Object.keys(edit).length > 0) {
    const { data: current } = await supabaseAdmin
      .from("deals")
      .select("title, deal_price, original_price, price_mode, min_order_qty, total_qty, price_unit, stock_type, storage_type, expiry_date, storage_condition, description, closes_at, seller_member_id")
      .eq("id", id)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: "매물을 찾을 수 없어요." }, { status: 404 });
    const invalid = validateDealEdit(edit, current);
    if (invalid) return NextResponse.json(invalid, { status: 400 });
    const cleanTitle = edit.title !== undefined ? normalizeTitle(edit.title, { admin: true }) : undefined;
    if (confirmWarnings !== true) {
      const w = dealEditWarnings(edit, current);
      // 같은 판매자의 같은 이름 진행 중 매물(자기 자신 제외) — 등록과 같은 경고
      if (cleanTitle !== undefined && cleanTitle !== current.title) {
        let dup = supabaseAdmin.from("deals").select("id", { count: "exact", head: true }).eq("status", "active").eq("title", cleanTitle).neq("id", id);
        dup = current.seller_member_id ? dup.eq("seller_member_id", current.seller_member_id) : dup.is("seller_member_id", null);
        const { count } = await dup;
        if ((count ?? 0) > 0) w.title.push(DUPLICATE_TITLE_WARNING);
      }
      if (w.title.length || w.description.length || w.price.length) {
        return NextResponse.json(
          { needsConfirm: true, field: w.title.length ? "title" : w.price.length ? "originalPrice" : "description", warnings: w },
          { status: 422 }
        );
      }
    }
    if (cleanTitle !== undefined) update.title = cleanTitle;
    // 2026-10-04 가격 협의: 방식 전환은 한 UPDATE에서 가격 칸·price_mode를 같이 바꿈(DB CHECK deals_price_by_mode_check는 문장 끝에서 검사).
    // negotiable이면 두 가격 null, negotiable→fixed는 판매가(필수, 검증 통과분) + 정상가(없으면 판매가와 같은 값). 정상가=판매가 자동 맞춤은 fixed에서만.
    const mode = effectivePriceMode(edit, current);
    const wasNegotiable = current.price_mode === "negotiable";
    if (mode === "negotiable") {
      if (!wasNegotiable) {
        update.price_mode = "negotiable";
        update.deal_price = null;
        update.original_price = null;
      }
    } else if (wasNegotiable) {
      update.price_mode = "fixed";
      update.deal_price = edit.dealPrice;
      update.original_price = edit.originalPrice || edit.dealPrice;
    } else {
      const dealPrice = edit.dealPrice ?? current.deal_price;
      if (edit.dealPrice !== undefined) update.deal_price = edit.dealPrice;
      // 정상가 없음 = 판매가와 같은 값(등록과 같음). 판매가만 바뀌고 예전에도 정상가가 없었으면 같이 맞춤
      if (edit.originalPrice !== undefined) update.original_price = edit.originalPrice || dealPrice;
      else if (edit.dealPrice !== undefined && current.original_price === current.deal_price) update.original_price = dealPrice;
    }
    if (edit.minOrderQty !== undefined) update.min_order_qty = isLumpSum(current.price_unit) ? null : edit.minOrderQty || null;
    if (edit.expiryDate !== undefined) {
      const expiry_date = edit.expiryDate || null;
      update.expiry_date = expiry_date;
      // 예전 칸(storage_condition)도 등록처럼 새 칸 요약으로 — 새 칸이 다 비면 예전 자유 입력 값은 그대로
      const hadNewFields = !!(current.storage_type || current.expiry_date);
      update.storage_condition =
        storageSummary({ storage_type: current.storage_type, expiry_date }) || (hadNewFields ? null : current.storage_condition ?? null);
    }
    if (edit.description !== undefined) update.description = edit.description || null;
    if (edit.closesAt !== undefined) update.closes_at = edit.closesAt;
  }
  if (remainingQty !== undefined) update.remaining_qty = remainingQty;
  if (status !== undefined) update.status = status;
  if (images !== undefined) update.images = images;
  if (videoUrl !== undefined) update.video_url = videoUrl;
  // 2026-09-30: 판매자 표시 수정 — 공개면 상호, 아니면 "비공개 판매자" (sellerDisplay.ts)
  if (sellerPublic !== undefined) Object.assign(update, resolveSellerDisplay(sellerPublic === true, sellerCompanyName));

  const { error } = await supabaseAdmin.from("deals").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 2026-10-10: 매물 수정 감사 — 바뀐 칸 이름만(값은 넣지 않음). 마감만 한 경우는 아래 deal_close 하나
  const changedKeys = Object.keys(update).filter((k) => k !== "status");
  if (changedKeys.length > 0) {
    await writeAudit(supabaseAdmin, req, { admin: auth.admin, action: "deal_update", targetType: "deal", targetId: id, detail: { changed: changedKeys } });
  }
  if (status === "closed" && before && before.status !== "closed") {
    await writeAudit(supabaseAdmin, req, {
      admin: auth.admin,
      action: "deal_close",
      targetType: "deal",
      targetId: id,
      detail: { title: before.title ?? null, from: before.status ?? null },
    });
  }

  return NextResponse.json({ ok: true });
}

// 매물 삭제 — 되돌릴 수 없음. schema.sql상 interests/quick_leads/messages가
// deal_id에 on delete cascade라, 이 매물에 달린 관심표시·쪽지 기록도 함께 삭제됩니다.
export async function DELETE(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  // 2026-10-01: 영구 삭제는 최고관리자만
  const denied = requirePerm(auth.admin, "dealDelete");
  if (denied) return denied;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const supabaseAdmin = getAdminClient();
  const { data: before } = await supabaseAdmin.from("deals").select("title, status").eq("id", id).maybeSingle();
  const { error } = await supabaseAdmin.from("deals").delete().eq("id", id);
  // 2026-10-01 F-2: deal_connections.deal_id가 on delete restrict — 거래 연결 기록이 있는 매물은 삭제 대신 마감
  if (error?.code === "23503") {
    return NextResponse.json({ error: "거래 연결 기록이 있는 매물은 삭제할 수 없어요. 마감 처리해 주세요." }, { status: 409 });
  }
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
