import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDealPush } from "@/lib/sendPush";
import { sanitizeManifest, sanitizePid } from "@/lib/parseCsv";
import { checkAdminAuth } from "@/lib/adminAuth";
import { isStockType } from "@/lib/stockType";
import { isDealPriceUnit, isLumpSum } from "@/lib/priceUnit";
import { resolveSellerDisplay } from "@/lib/sellerDisplay";

export async function POST(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const {
    title,
    category,
    region,
    originalPrice,
    dealPrice,
    totalQty,
    remainingQty,
    quantityUnit,
    minOrderQty,
    location,
    closesAt,
    requestId, // 판매자 신청에서 승인해서 넘어온 경우
    images,
    videoUrl,
    description,
    packageUnit,
    origin,
    spec,
    storageCondition,
    pid,
    manifestItems,
    stockType,
    priceUnit,
    sellerPublic, // 2026-09-30: 판매자 표시 — true면 상호 공개(sellerCompanyName), 아니면 "비공개 판매자"
    sellerCompanyName,
  } = body;

  // 2026-09-28: 관리자 폼(DealForm)과 같은 필수 규칙 — field로 어느 칸인지 알려준다.
  const bad = (error: string, field: string) => NextResponse.json({ error, field }, { status: 400 });
  const isPositive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (typeof title !== "string" || !title.trim()) return bad("매물명을 입력해주세요.", "title");
  if (!category) return bad("카테고리를 선택해주세요.", "category");
  if (!region) return bad("지역을 선택해주세요.", "region");
  if (dealPrice == null || dealPrice === "") return bad("판매가를 입력해주세요.", "dealPrice");
  if (!isPositive(dealPrice)) return bad("판매가는 0보다 커야 해요.", "dealPrice");
  if (originalPrice != null && !isPositive(originalPrice)) return bad("정상가는 0보다 커야 해요.", "originalPrice");
  if (totalQty == null || totalQty === "") return bad("수량을 입력해주세요.", "totalQty");
  if (!isPositive(totalQty)) return bad("수량은 0보다 커야 해요.", "totalQty");
  // 2026-09-29: 단가 단위 — DB check와 같은 값만, 안 보내면 null(= 수량 단위 기준). 일괄이면 최소주문 없음
  if (priceUnit != null && !isDealPriceUnit(priceUnit)) return bad("단가 단위가 올바르지 않아요.", "priceUnit");
  const lumpSum = isLumpSum(priceUnit);
  if (!lumpSum && minOrderQty != null && !isPositive(minOrderQty)) return bad("최소 주문량은 0보다 커야 해요.", "minOrderQty");
  if (!lumpSum && minOrderQty != null && minOrderQty > totalQty) return bad("최소주문량은 총수량보다 클 수 없어요.", "minOrderQty");
  if (!closesAt || Number.isNaN(Date.parse(closesAt))) return bad("마감 시간이 올바르지 않아요.", "closesAt");
  // 2026-09-29: 재고 유형 — 10개 값만 (DB check와 같음), 안 보내면 general
  if (stockType != null && !isStockType(stockType)) return bad("재고 유형이 올바르지 않아요.", "stockType");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true, demo: true, id: "demo-deal" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: catRow } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("name", category)
    .single();
  const { data: regRow } = await supabaseAdmin
    .from("regions")
    .select("id")
    .eq("name", region)
    .single();
  // 이름이 DB에 없으면 예전엔 category_id/region_id가 비어서 알림 매칭이 안 되는 매물이 조용히 생겼음
  if (!catRow) return bad("없는 카테고리예요.", "category");
  if (!regRow) return bad("없는 지역이에요.", "region");

  // 2026-09-30: 판매자 표시는 관리자 폼의 "판매자 표시" 선택이 기준(모두 대리 게시 = 중개).
  // 예전 폼처럼 값이 안 오면 판매 신청의 공개 설정·업체명을 따름. 임의 이름("… 판매자 #NNNN")은 폐지.
  let sellerMemberId: string | null = null;
  let seller = resolveSellerDisplay(sellerPublic === true, sellerCompanyName);
  if (requestId) {
    const { data: sr } = await supabaseAdmin
      .from("seller_requests")
      .select("company_name, is_anonymous, seller_member_id")
      .eq("id", requestId)
      .maybeSingle();
    if (sr) {
      sellerMemberId = sr.seller_member_id ?? null;
      if (typeof sellerPublic !== "boolean") seller = resolveSellerDisplay(sr.is_anonymous === false, sr.company_name);
    }
  }

  const { data: deal, error } = await supabaseAdmin
    .from("deals")
    .insert({
      title,
      category_id: catRow?.id,
      region_id: regRow?.id,
      original_price: originalPrice || dealPrice,
      deal_price: dealPrice,
      total_qty: totalQty,
      remaining_qty: remainingQty ?? totalQty,
      quantity_unit: quantityUnit || "개",
      min_order_qty: lumpSum ? null : minOrderQty || null,
      price_unit: priceUnit ?? null,
      location,
      closes_at: closesAt,
      status: "active",
      images: images ?? [],
      video_url: videoUrl ?? null,
      description: description || null,
      package_unit: packageUnit || null,
      origin: origin || null,
      spec: spec || null,
      storage_condition: storageCondition || null,
      pid: sanitizePid(pid),
      manifest_items: sanitizeManifest(manifestItems),
      stock_type: stockType ?? "general",
      seller_member_id: sellerMemberId,
      is_anonymous: seller.is_anonymous,
      seller_display_name: seller.seller_display_name,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (requestId) {
    await supabaseAdmin
      .from("seller_requests")
      .update({ status: "approved", linked_deal_id: deal.id })
      .eq("id", requestId);
  }

  // 매물 등록이 확정되는 즉시, 해당 카테고리·지역 구독자에게 자동으로 알림을 보냅니다.
  const pushResult = await sendDealPush(deal.id);

  return NextResponse.json({ ok: true, id: deal.id, push: pushResult });
}
