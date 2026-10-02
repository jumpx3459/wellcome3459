import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidContactPhone } from "@/lib/auth";
import { sanitizeManifest, sanitizePid } from "@/lib/parseCsv";
import { isStockType } from "@/lib/stockType";
import { isDealPriceUnit, isLumpSum } from "@/lib/priceUnit";
import { getPhotoLimit, photoLimitError } from "@/lib/photoLimit";
import { getMemberFromToken } from "@/lib/photoLimitServer";
import { checkDealVideoUrl } from "@/lib/videoUploadServer";
import { isReservedSellerName } from "@/lib/sellerDisplay";
import { TERMS_VERSION } from "@/lib/consent";
import { normalizeTitle, checkTitle, checkDescription, DUPLICATE_TITLE_WARNING } from "@/lib/titleGuard";
import { isStorageType, isValidExpiryDate, storageSummary, priceWarnings, isMissingNewColumn, EXPIRY_REQUIRED_MESSAGE } from "@/lib/dealFields";

const LOGIN_REQUIRED = "판매 신청은 회원만 할 수 있어요. 로그인 후 다시 시도해주세요.";

export async function POST(req: NextRequest) {
  // 2026-09-30: 본문이 없거나 JSON이 아니면 토큰도 없는 것 — 예전엔 여기서 예외가 나 500이었음
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.accessToken !== "string" || !body.accessToken) {
    return NextResponse.json({ error: LOGIN_REQUIRED }, { status: 401 });
  }
  const {
    companyName,
    isAnonymous,
    // memberId는 받지 않음 (2026-09-29) — 판매자 회원 연결은 아래에서 access token으로만 결정
    contactName,
    contactPhone,
    category,
    region,
    productName,
    quantity,
    quantityUnit,
    minOrderQty,
    hopePrice,
    originalPrice, // 2026-10-01 PR-B: 정상 단가(선택) — 할인율 표시용, 승인 시 관리자 폼으로 이어받음
    hopeDurationHours,
    description,
    packageUnit,
    origin,
    spec,
    storageCondition, // 예전 폼 호환 — 새 폼은 storageType·expiryDate
    storageType, // 2026-10-01 PR-B: 상온·냉장·냉동
    expiryDate, // 2026-10-01 PR-B: 소비기한 "YYYY-MM-DD" — 재고 유형 "소비기한 임박"이면 필수
    pid,
    manifestItems,
    images,
    videoUrl,
    stockType,
    priceUnit,
    accessToken,
    sellerTermsAgreed,
    confirmWarnings, // 2026-10-01: 매물명·설명 경고를 확인하고 "그대로 저장"
  } = body;

  if (!contactPhone || !productName || !quantity) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }
  // 2026-10-01 PR-A [11]: 매물명 정리·검사(회원 — "[테스트]" 불가) — src/lib/titleGuard.ts
  const cleanName = normalizeTitle(productName);
  const nameCheck = checkTitle(cleanName);
  if (nameCheck.block) return NextResponse.json({ error: nameCheck.block, field: "title" }, { status: 400 });
  // 2026-09-30 (커밋 E): [필수] 판매자 확인 사항 (consent-texts 7-2) — 아래에서 member_consents(seller_terms)에 기록
  if (sellerTermsAgreed !== true) {
    return NextResponse.json({ error: "판매자 확인 사항에 동의해주세요.", field: "sellerTerms" }, { status: 400 });
  }
  // 사칭 방지 (약관 제12조 4항) — 회사·서비스 이름이 들어간 상호는 받지 않음 (관리자 입력은 예외)
  if (isReservedSellerName(companyName)) {
    return NextResponse.json({ error: "점프엑스·덤핑점핑으로 오인될 수 있는 업체명은 쓸 수 없어요.", field: "companyName" }, { status: 400 });
  }
  // 2026-10-01: 재고 위치(지역) 필수 — 알림 매칭 기준 (sell 폼과 같은 규칙). 없는 지역 이름은 아래 조회 뒤 다시 막음
  if (typeof region !== "string" || !region.trim()) {
    return NextResponse.json({ error: "재고 위치(지역)를 선택해주세요.", field: "region" }, { status: 400 });
  }
  // 2026-09-29: 희망 단가 필수 (sell 폼과 같은 규칙)
  if (typeof hopePrice !== "number" || !Number.isFinite(hopePrice) || hopePrice <= 0) {
    return NextResponse.json({ error: "판매 단가를 입력해주세요", field: "hopePrice" }, { status: 400 });
  }
  if (originalPrice != null && (typeof originalPrice !== "number" || !Number.isFinite(originalPrice) || originalPrice <= 0)) {
    return NextResponse.json({ error: "정상 단가는 0보다 커야 해요.", field: "originalPrice" }, { status: 400 });
  }
  // 단가 단위 — DB check와 같은 값만, 안 보내면 null(= 수량 단위 기준)
  if (priceUnit != null && !isDealPriceUnit(priceUnit)) {
    return NextResponse.json({ error: "단가 단위가 올바르지 않아요.", field: "priceUnit" }, { status: 400 });
  }
  const lumpSum = isLumpSum(priceUnit);
  // 2026-09-29: 사무실 번호도 허용 (휴대폰 전용 검증은 로그인 OTP에만)
  if (!isValidContactPhone(contactPhone)) {
    return NextResponse.json({ error: "휴대폰 또는 사무실 번호를 정확히 입력해주세요", field: "contactPhone" }, { status: 400 });
  }
  // 2026-09-29: 재고 유형 — 10개 값만 (DB check와 같음), 안 보내면 general
  if (stockType != null && !isStockType(stockType)) {
    return NextResponse.json({ error: "재고 유형이 올바르지 않아요.", field: "stockType" }, { status: 400 });
  }
  // 2026-09-28: 수량보다 큰 MOQ(예: 수량 100kg, MOQ 1000kg)가 그대로 저장된 사례 — 폼(sell)과 같은 규칙
  if (!lumpSum && minOrderQty != null && minOrderQty !== "" && Number(minOrderQty) > Number(quantity)) {
    return NextResponse.json({ error: "최소주문량은 재고 총수량보다 클 수 없어요.", field: "minOrderQty" }, { status: 400 });
  }
  // 2026-10-01 PR-B: 보관 조건·소비기한 (src/lib/dealFields.ts)
  if (storageType != null && storageType !== "" && !isStorageType(storageType)) {
    return NextResponse.json({ error: "보관 조건이 올바르지 않아요.", field: "storageType" }, { status: 400 });
  }
  if (expiryDate != null && expiryDate !== "" && !isValidExpiryDate(expiryDate)) {
    return NextResponse.json({ error: "소비기한 날짜가 올바르지 않아요.", field: "expiryDate" }, { status: 400 });
  }
  if (stockType === "near_expiry" && !expiryDate) {
    return NextResponse.json({ error: EXPIRY_REQUIRED_MESSAGE, field: "expiryDate" }, { status: 400 });
  }
  const storage_type = isStorageType(storageType) ? storageType : null;
  const expiry_date = isValidExpiryDate(expiryDate) ? expiryDate : null;

  if (images != null && !Array.isArray(images)) {
    return NextResponse.json({ error: "사진 목록이 올바르지 않아요.", field: "images" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Supabase 미설정(로컬 데모) — 저장 없이 성공 처리만 (사진 장수는 기본 한도로 검사)
    if ((images?.length ?? 0) > getPhotoLimit(null)) {
      return NextResponse.json({ error: photoLimitError(getPhotoLimit(null)), field: "images" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // 2026-09-29: 요청한 회원은 access token으로만 확인 — 예전엔 body의 memberId를 그대로 seller_member_id로
  // 저장해서 다른 회원 id를 넣을 수 있었음.
  // 2026-09-30: 판매 신청은 회원 전용 — 토큰 없음·무효·회원 행 없음이면 401 (비회원 신청 경로 폐지)
  const member = await getMemberFromToken(supabaseAdmin, accessToken);
  if (!member) {
    return NextResponse.json({ error: LOGIN_REQUIRED }, { status: 401 });
  }
  // 확인 후 저장 경고 — 이 회원의 같은 이름 진행 중 매물 포함
  if (confirmWarnings !== true) {
    const { count: dupCount } = await supabaseAdmin
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("seller_member_id", member.id)
      .eq("title", cleanName);
    const titleWarnings = [...nameCheck.warnings, ...((dupCount ?? 0) > 0 ? [DUPLICATE_TITLE_WARNING] : [])];
    const descriptionWarnings = checkDescription(description);
    const priceWarns = priceWarnings(originalPrice, hopePrice); // 할인율 80% 이상
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
  // 매물 한 건의 사진 총 장수 — 같은 회원 기준 한도
  const photoLimit = getPhotoLimit(member);
  if ((images?.length ?? 0) > photoLimit) {
    return NextResponse.json({ error: photoLimitError(photoLimit), field: "images" }, { status: 400 });
  }
  // 2026-10-02 PR-A: 영상은 브라우저가 Storage에 직접 올림 — 우리 버킷의 video-{uuid}.{ext}이고 실제로 있는지 확인(외부 URL 차단)
  const videoCheck = await checkDealVideoUrl(supabaseAdmin, videoUrl);
  if (!videoCheck.ok) return NextResponse.json({ error: videoCheck.error, field: "video" }, { status: videoCheck.status });

  const catRow = category
    ? (await supabaseAdmin.from("categories").select("id").eq("name", category).maybeSingle()).data
    : null;
  const regRow = region
    ? (await supabaseAdmin.from("regions").select("id").eq("name", region).maybeSingle()).data
    : null;
  if (!regRow) {
    return NextResponse.json({ error: "없는 지역이에요. 다시 선택해주세요.", field: "region" }, { status: 400 });
  }

  // 판매자 확인 사항 동의 기록 — 신청보다 먼저 남김(기록 없이 신청만 들어가지 않게).
  // source 'sell'은 member_consents.source check에 추가하는 SQL(schema.sql 커밋 E 블록)이 실행돼 있어야 함.
  const { error: consentError } = await supabaseAdmin.from("member_consents").insert({
    member_id: member.id,
    consent_type: "seller_terms",
    agreed: true,
    terms_version: TERMS_VERSION,
    source: "sell",
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500) || null,
  });
  if (consentError) {
    console.error("[seller-requests] seller_terms 동의 기록 실패", consentError.code, consentError.message);
    return NextResponse.json({ error: "신청 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  const row = {
    company_name: companyName || null,
    // 2026-09-30: 업체명 공개 설정 기본 비공개 — 명시적으로 공개(false)를 고른 경우만 공개
    is_anonymous: isAnonymous !== false,
    seller_member_id: member.id,
    stock_type: stockType ?? "general",
    contact_name: contactName || null,
    contact_phone: contactPhone,
    category_id: catRow?.id ?? null,
    region_id: regRow?.id ?? null,
    product_name: cleanName,
    quantity,
    quantity_unit: quantityUnit || "개",
    min_order_qty: lumpSum ? null : minOrderQty || null, // 일괄 판매면 최소주문 없음
    price_unit: priceUnit ?? null,
    hope_price: hopePrice,
    original_price: originalPrice ?? null,
    hope_duration_hours: hopeDurationHours ?? null,
    description,
    package_unit: packageUnit || null,
    origin: origin || null,
    spec: spec || null,
    // 새 칸 내용을 예전 칸에도 남김(SQL 전 배포·예전 화면 대비)
    storage_condition: storageSummary({ storage_type, expiry_date }) || (typeof storageCondition === "string" ? storageCondition.trim() : "") || null,
    storage_type,
    expiry_date,
    pid: sanitizePid(pid),
    manifest_items: sanitizeManifest(manifestItems),
    images: images ?? [],
    video_url: videoUrl ?? null,
  };
  let { error } = await supabaseAdmin.from("seller_requests").insert(row);
  if (error && isMissingNewColumn(error)) {
    // SQL(20261001_deal_form_fields) 전 — 새 컬럼만 빼고 다시 저장(보관·소비기한은 storage_condition에 남음, 정상 단가는 설명 끝에)
    const { storage_type: _st, expiry_date: _ed, original_price: _op, ...legacy } = row;
    void _st;
    void _ed;
    const desc = _op ? [legacy.description, `정상 단가 ${_op.toLocaleString()}원`].filter(Boolean).join("\n") : legacy.description;
    ({ error } = await supabaseAdmin.from("seller_requests").insert({ ...legacy, description: desc }));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
