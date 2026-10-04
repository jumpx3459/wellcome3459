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
import { isPassingCheck, NOT_CHECKED_MESSAGE, ALREADY_HANDLED_MESSAGE } from "@/lib/businessCheck";
import { ntsStatus } from "@/lib/nts";
import { isPriceMode } from "@/lib/priceMode";
import { writeAudit, phoneTail } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import {
  parseSellerPrivateFields,
  saveSellerPrivate,
  sellerValueFromRequest,
  findLinkableCheck,
  linkDirectCheck,
  type SellerPrivateValue,
  type SellerPrivateField,
  type SellerPrivateVia,
} from "@/lib/sellerPrivate";

// 2026-10-04 feat/deal-seller-private: 직접 등록 폼의 "실제 판매자" 칸 → 서버가 받는 이름
const PRIVATE_FIELD_NAME: Record<SellerPrivateField, string> = {
  companyName: "sellerPrivateCompany",
  contactName: "sellerPrivateName",
  contactPhone: "sellerPrivatePhone",
  memo: "sellerPrivateName",
};

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const {
    title,
    category,
    region,
    priceMode, // 2026-10-04: 'fixed'(기본) | 'negotiable'(가격 협의 — 판매가·정상가 없음)
    originalPrice: originalPriceIn,
    dealPrice: dealPriceIn,
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
    sellerPrivateCompany, // 2026-10-04: 직접 등록(판매 신청 아님) — 실제 판매자 상호(필수)·담당자(선택)·연락처(필수), 구매자에게 보이지 않음
    sellerPrivateName,
    sellerPrivatePhone,
    businessCheckId, // 직접 등록(판매 신청 아님) — 연결할 통과한 사업자 조회 행 id(필수, 자동 선택 없음)
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
  // 2026-10-04 가격 협의: negotiable이면 가격 칸은 받지 않음(보내도 무시 — DB CHECK도 두 가격 null만 허용)
  if (priceMode != null && !isPriceMode(priceMode)) return bad("가격 방식이 올바르지 않아요.", "priceMode");
  const negotiable = priceMode === "negotiable";
  const dealPrice = negotiable ? null : dealPriceIn;
  const originalPrice = negotiable ? null : originalPriceIn;
  if (!negotiable) {
    if (dealPrice == null || dealPrice === "") return bad("판매가를 입력해주세요.", "dealPrice");
    if (!isPositive(dealPrice)) return bad("판매가는 0보다 커야 해요.", "dealPrice");
    if (originalPrice != null && !isPositive(originalPrice)) return bad("정상가는 0보다 커야 해요.", "originalPrice");
  }
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

  // 2026-10-04: 직접 등록(requestId 없음)은 실제 판매자 정보 + 통과한 사업자 조회 1건이 필수 — 판매 신청 승인은 신청 정보를 씀
  let directValue: SellerPrivateValue | null = null;
  if (!requestId) {
    const p = parseSellerPrivateFields(
      { companyName: sellerPrivateCompany, contactName: sellerPrivateName, contactPhone: sellerPrivatePhone },
      { requireCompany: true, requirePhone: true, withMemo: false }
    );
    if (!p.ok) return bad(p.error, PRIVATE_FIELD_NAME[p.field]);
    directValue = p.value;
    if (typeof businessCheckId !== "string" || !UUID_RE.test(businessCheckId)) return bad(NOT_CHECKED_MESSAGE, "businessCheckId");
  }

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
  // 2026-10-04 판매자 신원 확인: 판매 신청 승인은 ① 아직 대기 중이고 ② 그 신청의 최신 사업자 조회가 통과(진위 일치 또는 예외 확인)일 때만
  let passCheck: { id: string; b_no: string } | null = null;
  let requestSellerValue: SellerPrivateValue | null = null;
  if (requestId) {
    const { data: sr, error: srErr } = await supabaseAdmin
      .from("seller_requests")
      .select("company_name, contact_name, contact_phone, is_anonymous, seller_member_id, status, linked_deal_id")
      .eq("id", requestId)
      .maybeSingle();
    if (srErr) return NextResponse.json({ error: "판매 신청을 확인하지 못했어요." }, { status: 500 });
    if (!sr) return NextResponse.json({ error: "판매 신청을 찾을 수 없어요." }, { status: 404 });
    if (sr.status !== "pending" || sr.linked_deal_id) return NextResponse.json({ error: ALREADY_HANDLED_MESSAGE }, { status: 409 });
    const { data: latest, error: chkErr } = await supabaseAdmin
      .from("seller_business_checks")
      .select("id, b_no, kind, validate_result, exception_ok")
      .eq("seller_request_id", requestId)
      .eq("kind", "validate")
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (chkErr) return NextResponse.json({ error: "사업자 조회 기록을 확인하지 못했어요." }, { status: 500 });
    if (!isPassingCheck(latest)) return NextResponse.json({ error: NOT_CHECKED_MESSAGE }, { status: 409 });
    passCheck = { id: latest!.id as string, b_no: latest!.b_no as string };
    requestSellerValue = sellerValueFromRequest(sr as { company_name: string | null; contact_name: string | null; contact_phone: string | null });
    sellerMemberId = sr.seller_member_id ?? null;
    if (typeof sellerPublic !== "boolean") seller = resolveSellerDisplay(sr.is_anonymous === false, sr.company_name);
  }

  // 2026-10-04: 직접 등록 — 고른 사업자 조회 행이 아직 연결 가능한지(신청 없음·매물 미연결·validate·통과) 등록 전에 확인.
  // 등록 뒤 linkDirectCheck가 같은 조건으로 한 번 더 걸어 그 사이 바뀐 경우를 막음
  let directCheck: { id: string; b_no: string } | null = null;
  if (!requestId) {
    const c = await findLinkableCheck(supabaseAdmin, businessCheckId as string);
    if (c === "error") return NextResponse.json({ error: "사업자 조회 기록을 확인하지 못했어요." }, { status: 500 });
    if (!c) return NextResponse.json({ error: NOT_CHECKED_MESSAGE, field: "businessCheckId" }, { status: 409 });
    directCheck = c;
  }

  // 확인 후 저장 경고 — 같은 판매자(판매 신청 승인이면 그 회원, 직접 등록이면 판매자 없는 매물)의 같은 이름 진행 중 매물
  if (confirmWarnings !== true) {
    let dup = supabaseAdmin.from("deals").select("id", { count: "exact", head: true }).eq("status", "active").eq("title", cleanTitle);
    dup = sellerMemberId ? dup.eq("seller_member_id", sellerMemberId) : dup.is("seller_member_id", null);
    const { count: dupCount } = await dup;
    const titleWarnings = [...titleCheck.warnings, ...((dupCount ?? 0) > 0 ? [DUPLICATE_TITLE_WARNING] : [])];
    const descriptionWarnings = checkDescription(description);
    const priceWarns = negotiable ? [] : priceWarnings(originalPrice, dealPrice); // 할인율 80% 이상
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
    // 가격 협의: 두 가격 null + price_mode negotiable(DB CHECK deals_price_by_mode_check). fixed는 price_mode를 보내지 않아 칸이 없는 DB(SQL 전)에서도 등록됨(default fixed)
    original_price: negotiable ? null : originalPrice || dealPrice,
    deal_price: negotiable ? null : dealPrice,
    ...(negotiable ? { price_mode: "negotiable" } : {}),
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

  // 2026-10-04: 실제 판매자 정보 저장 — 알림 발송 전에, 실패하면 방금 만든 매물을 되돌림(deal_seller_private는 매물 삭제 시 함께 지워짐)
  const rollbackDeal = async (why: string) => {
    const { error: delErr } = await supabaseAdmin.from("deals").delete().eq("id", deal.id);
    if (delErr) console.error("[admin/deals] 판매자 정보 저장 실패 후 매물 되돌리기 실패", why, deal.id, delErr.code);
  };
  const via: SellerPrivateVia = requestId ? "seller_request_approve" : "deal_create";
  const privateValue = (requestId ? requestSellerValue : directValue) as SellerPrivateValue;
  const savedPrivate = await saveSellerPrivate(supabaseAdmin, deal.id, auth.admin.id, privateValue, requestId ? { sellerRequestId: requestId } : undefined);
  if (!savedPrivate.ok) {
    console.error("[admin/deals] 판매자 비공개 정보 저장 실패", savedPrivate.message);
    await rollbackDeal("save_private");
    return NextResponse.json({ error: "판매자 정보를 저장하지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }
  if (!requestId) {
    const linked = await linkDirectCheck(supabaseAdmin, directCheck!.id, deal.id);
    if (linked !== "ok") {
      await rollbackDeal("link_check");
      return linked === "not_eligible"
        ? NextResponse.json({ error: NOT_CHECKED_MESSAGE, field: "businessCheckId" }, { status: 409 })
        : NextResponse.json({ error: "사업자 조회 기록을 연결하지 못했어요. 다시 시도해주세요." }, { status: 500 });
    }
  }

  if (requestId) {
    // 2026-10-04: 대기 중이고 아직 연결 안 된 신청만 승인 — 동시에 두 번 눌러 0행이면(다른 요청이 먼저 승인)
    // 방금 만든 매물을 알림 발송(sendDealPush, 아래) 전에 지워 중복 매물·중복 알림을 막음
    const { data: approved, error: srUpdErr } = await supabaseAdmin
      .from("seller_requests")
      .update({ status: "approved", linked_deal_id: deal.id, reviewed_by: auth.admin.name })
      .eq("id", requestId)
      .eq("status", "pending")
      .is("linked_deal_id", null)
      .select("id");
    if (srUpdErr || !approved?.length) {
      const { error: delErr } = await supabaseAdmin.from("deals").delete().eq("id", deal.id);
      if (delErr) console.error("[admin/deals] 승인 실패 후 매물 되돌리기 실패", deal.id, delErr.code);
      return srUpdErr
        ? NextResponse.json({ error: "판매 신청 상태를 바꾸지 못했어요. 다시 시도해주세요." }, { status: 500 })
        : NextResponse.json({ error: ALREADY_HANDLED_MESSAGE }, { status: 409 });
    }
    const { error: linkErr } = await supabaseAdmin.from("seller_business_checks").update({ deal_id: deal.id }).eq("id", passCheck!.id);
    if (linkErr) console.error("[admin/deals] 조회 기록에 매물 연결 실패", linkErr.code);
  }

  // 감사 로그 — 값은 넣지 않음(채운 칸 이름·연락처 뒤 4자리·연결한 조회 행 id). 기록 실패는 등록을 막지 않음
  await writeAudit(supabaseAdmin, req, {
    admin: auth.admin,
    action: "seller_private_save",
    targetType: "deal",
    targetId: deal.id,
    detail: {
      via,
      created: savedPrivate.created,
      changed: (["company_name", "contact_name", "contact_phone"] as const).filter((k) => privateValue[k]),
      contact_phone: phoneTail(privateValue.contact_phone),
      ...(directCheck ? { linked_check_id: directCheck.id } : {}),
      ...(passCheck ? { linked_check_id: passCheck.id } : {}),
    },
  });

  // 매물 등록이 확정되는 즉시, 해당 카테고리 구독자에게 자동으로 알림을 보냅니다(지역은 조건이 아님).
  const pushResult = await sendDealPush(deal.id);

  // 2026-10-04: 승인 시점 사업자 상태 재조회 1회 — 기록만 하고 실패해도 승인은 그대로(알림 뒤라 발송을 늦추지 않음)
  const recheckOf = passCheck ?? directCheck;
  if (recheckOf) {
    const s = await ntsStatus(recheckOf.b_no);
    const { error: recheckErr } = await supabaseAdmin.from("seller_business_checks").insert({
      seller_request_id: requestId ?? null,
      deal_id: deal.id,
      kind: "status_recheck",
      b_no: recheckOf.b_no,
      status_code: s.result === "ok" ? s.status.code : null,
      status_text: s.result === "ok" ? s.status.text : null,
      tax_type: s.result === "ok" ? s.status.taxType : null,
      error_kind: s.result === "error" ? s.errorKind : null,
      checked_by_admin_id: auth.admin.id,
    });
    if (recheckErr) console.error("[admin/deals] 상태 재조회 기록 실패", recheckErr.code);
  }

  return NextResponse.json({ ok: true, id: deal.id, push: pushResult });
}
