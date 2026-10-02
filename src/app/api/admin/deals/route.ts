import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDealPush } from "@/lib/sendPush";
import { sanitizeManifest, sanitizePid } from "@/lib/parseCsv";
import { checkAdminAuth } from "@/lib/adminAuth";
import { isStockType } from "@/lib/stockType";
import { isDealPriceUnit, isLumpSum } from "@/lib/priceUnit";
import { resolveSellerDisplay } from "@/lib/sellerDisplay";
import { checkDealVideoUrl } from "@/lib/videoUploadServer";
import { normalizeTitle, checkTitle, checkDescription, DUPLICATE_TITLE_WARNING } from "@/lib/titleGuard";
import { isStorageType, isValidExpiryDate, storageSummary, priceWarnings, isMissingNewColumn, EXPIRY_REQUIRED_MESSAGE } from "@/lib/dealFields";

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
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
    storageCondition, // 예전 자유 입력(판매 신청 승인 시 신청서 값 그대로) — 새 칸(storageType·expiryDate)이 있으면 그걸로 만듦
    storageType, // 2026-10-01 PR-B: 상온·냉장·냉동
    expiryDate, // 2026-10-01 PR-B: 소비기한 "YYYY-MM-DD" — 재고 유형 "소비기한 임박"이면 필수
    pid,
    manifestItems,
    stockType,
    priceUnit,
    confirmWarnings, // 2026-10-01: 매물명·설명 경고를 확인하고 "그대로 저장"
    sellerPublic, // 2026-09-30: 판매자 표시 — true면 상호 공개(sellerCompanyName), 아니면 "비공개 판매자"
    sellerCompanyName,
  } = body;

  // 2026-09-28: 관리자 폼(DealForm)과 같은 필수 규칙 — field로 어느 칸인지 알려준다.
  const bad = (error: string, field: string) => NextResponse.json({ error, field }, { status: 400 });
  const isPositive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (typeof title !== "string" || !title.trim()) return bad("매물명을 입력해주세요.", "title");
  // 2026-10-01 PR-A [11]: 매물명 정리·검사(관리자 — "[테스트]" 허용) — src/lib/titleGuard.ts
  const cleanTitle = normalizeTitle(title, { admin: true });
  const titleCheck = checkTitle(cleanTitle, { admin: true });
  if (titleCheck.block) return bad(titleCheck.block, "title");
  if (!category) return bad("카테고리를 선택해주세요.", "category");
  if (!region) return bad("지역을 선택해주세요.", "region");
  if (dealPrice == null || dealPrice === "") return bad("판매가를 입력해주세요.", "dealPrice");
  if (!isPositive(dealPrice)) return bad("판매가는 0보다 커야 해요.", "dealPrice");
  if (originalPrice != null && !isPositive(originalPrice)) return bad("정상가는 0보다 커야 해요.", "originalPrice");
  if (totalQty == null || totalQty === "") return bad("재고 총수량을 입력해주세요.", "totalQty");
  if (!isPositive(totalQty)) return bad("재고 총수량은 0보다 커야 해요.", "totalQty");
  // 2026-09-29: 단가 단위 — DB check와 같은 값만, 안 보내면 null(= 수량 단위 기준). 일괄이면 최소주문 없음
  if (priceUnit != null && !isDealPriceUnit(priceUnit)) return bad("단가 단위가 올바르지 않아요.", "priceUnit");
  const lumpSum = isLumpSum(priceUnit);
  if (!lumpSum && minOrderQty != null && !isPositive(minOrderQty)) return bad("최소 주문량은 0보다 커야 해요.", "minOrderQty");
  if (!lumpSum && minOrderQty != null && minOrderQty > totalQty) return bad("최소주문량은 재고 총수량보다 클 수 없어요.", "minOrderQty");
  if (!closesAt || Number.isNaN(Date.parse(closesAt))) return bad("마감 시간이 올바르지 않아요.", "closesAt");
  // 2026-09-29: 재고 유형 — 10개 값만 (DB check와 같음), 안 보내면 general
  if (stockType != null && !isStockType(stockType)) return bad("재고 유형이 올바르지 않아요.", "stockType");
  // 2026-10-01 PR-B: 보관 조건·소비기한 (src/lib/dealFields.ts)
  if (storageType != null && storageType !== "" && !isStorageType(storageType)) return bad("보관 조건이 올바르지 않아요.", "storageType");
  if (expiryDate != null && expiryDate !== "" && !isValidExpiryDate(expiryDate)) return bad("소비기한 날짜가 올바르지 않아요.", "expiryDate");
  if (stockType === "near_expiry" && !expiryDate) return bad(EXPIRY_REQUIRED_MESSAGE, "expiryDate");
  const storage_type = isStorageType(storageType) ? storageType : null;
  const expiry_date = isValidExpiryDate(expiryDate) ? expiryDate : null;

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
  // 2026-10-02 PR-A: 영상 URL — 우리 버킷의 video-{uuid}.{ext}이고 실제로 있는지(판매 신청 승인으로 넘어온 기존 영상도 같은 검사)
  const videoCheck = await checkDealVideoUrl(supabaseAdmin, videoUrl);
  if (!videoCheck.ok) return NextResponse.json({ error: videoCheck.error, field: "video" }, { status: videoCheck.status });

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

  // 확인 후 저장 경고 — 같은 판매자(판매 신청 승인이면 그 회원, 직접 등록이면 판매자 없는 매물)의 같은 이름 진행 중 매물
  if (confirmWarnings !== true) {
    let dup = supabaseAdmin.from("deals").select("id", { count: "exact", head: true }).eq("status", "active").eq("title", cleanTitle);
    dup = sellerMemberId ? dup.eq("seller_member_id", sellerMemberId) : dup.is("seller_member_id", null);
    const { count: dupCount } = await dup;
    const titleWarnings = [...titleCheck.warnings, ...((dupCount ?? 0) > 0 ? [DUPLICATE_TITLE_WARNING] : [])];
    const descriptionWarnings = checkDescription(description);
    const priceWarns = priceWarnings(originalPrice, dealPrice); // 할인율 80% 이상
    if (titleWarnings.length || descriptionWarnings.length || priceWarns.length) {
      return NextResponse.json(
        {
          needsConfirm: true,
          field: titleWarnings.length ? "title" : priceWarns.length ? "originalPrice" : "description",
          warnings: { title: titleWarnings, description: descriptionWarnings, price: priceWarns },
        },
        { status: 422 }
      );
    }
  }

  const row = {
    title: cleanTitle,
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
    // 새 칸이 있으면 같은 내용을 예전 칸에도 남김(SQL 전 배포·예전 화면 대비), 없으면 신청서의 예전 값 그대로
    storage_condition: storageSummary({ storage_type, expiry_date }) || (typeof storageCondition === "string" ? storageCondition.trim() : "") || null,
    storage_type,
    expiry_date,
    pid: sanitizePid(pid),
    manifest_items: sanitizeManifest(manifestItems),
    stock_type: stockType ?? "general",
    seller_member_id: sellerMemberId,
    is_anonymous: seller.is_anonymous,
    seller_display_name: seller.seller_display_name,
  };
  const first = await supabaseAdmin.from("deals").insert(row).select().single();
  let deal = first.data;
  let error = first.error;
  if (error && isMissingNewColumn(error)) {
    // SQL(20261001_deal_form_fields) 전 — 새 컬럼만 빼고 다시 저장(내용은 storage_condition에 남음)
    const { storage_type: _st, expiry_date: _ed, ...legacy } = row;
    void _st;
    void _ed;
    const retry = await supabaseAdmin.from("deals").insert(legacy).select().single();
    deal = retry.data;
    error = retry.error;
  }

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
