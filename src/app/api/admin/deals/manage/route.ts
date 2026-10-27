import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { resolveSellerDisplay } from "@/lib/sellerDisplay";
import { checkDealVideoUrl } from "@/lib/videoUploadServer";
import { normalizeTitle, DUPLICATE_TITLE_WARNING } from "@/lib/titleGuard";
import { isLumpSum } from "@/lib/priceUnit";
import { storageSummary, isStorageType } from "@/lib/dealFields";
import { sanitizeManifest, sanitizePid } from "@/lib/parseCsv";
import { DEAL_EDIT_KEYS, validateDealEdit, dealEditWarnings, effectivePriceMode, type DealEditInput } from "@/lib/dealEdit";
import { ADMIN_PHOTO_LIMIT, ADMIN_PHOTO_LIMIT_ERROR } from "@/lib/photoLimit";
import {
  BP_MESSAGES, ADMIN_PREVIEW_TTL_SECONDS, cleanBrandName, brandNameInText, brandNameWarning, checkBrandProtectedRules, isBrandRuleViolation,
  isProtectedRef, removeProtectedObjects, resolvePhotos, signProtectedPaths, type PhotoSplit,
} from "@/lib/brandProtected";

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
    .order("created_at", { ascending: false }); // 2026-10-24 최신 등록순(마감임박·마감 지남 필터는 화면에서 마감 시각 순으로 다시 정렬)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2026-10-27 브랜드 보호: 보호 사진은 경로만 저장돼 있어 관리자 화면 표시용 서명 URL(1시간)을 같은 순서로 붙임(protected_preview_urls)
  const rows = (data ?? []) as Array<Record<string, unknown> & { protected_images?: string[] | null }>;
  const allPaths = rows.flatMap((d) => d.protected_images ?? []);
  if (allPaths.length > 0) {
    const signed = await signProtectedPaths(supabaseAdmin, allPaths, ADMIN_PREVIEW_TTL_SECONDS);
    const byPath = new Map(allPaths.map((pth, i) => [pth, signed[i]] as const));
    for (const d of rows) d.protected_preview_urls = (d.protected_images ?? []).map((pth) => byPath.get(pth) ?? null);
  }
  return NextResponse.json({ items: rows });
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
  const { id, status, images, videoUrl, sellerPublic, sellerCompanyName, confirmWarnings, brandProtected, brandName: brandNameIn, protectedImages } = body;
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  // DB check 제약(deals_status_check)과 같은 값만 허용 — sold_out은 사용처가 없어 제외
  if (status !== undefined && !DEAL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "매물 상태 값이 올바르지 않아요.", field: "status" }, { status: 400 });
  }
  // 2026-10-12: 사진 장수(관리자 25장, src/lib/photoLimit.ts)
  if (Array.isArray(images) && images.length > ADMIN_PHOTO_LIMIT) {
    return NextResponse.json({ error: ADMIN_PHOTO_LIMIT_ERROR, field: "images" }, { status: 400 });
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
  // 2026-10-27 브랜드 보호: 최종 상태(저장 뒤 값) 기준으로 규칙 검사 — 켜기는 공개 사진 ≤ 1장·영상 없음일 때만, 끄기는 보호 사진이 없을 때만(서버 400)
  //   사진 목록은 images(공개 URL 또는 "protected:<경로>")·protectedImages(경로 또는 공개 URL)로 오고, 공개↔보호로 옮길 사진은 새 버킷에 먼저 복사 → DB 저장 → 성공 뒤 옛 원본 삭제
  const touchesBp =
    brandProtected !== undefined || brandNameIn !== undefined || protectedImages !== undefined || images !== undefined || videoUrl !== undefined;
  let photos: PhotoSplit | null = null;
  let bpCtx: { finalBp: boolean; finalName: string; curTitle: string; curDescription: string | null; update: Record<string, unknown>; oldProtected: string[] } | null = null;
  if (touchesBp) {
    const { data: cur, error: curErr } = await supabaseAdmin
      .from("deals")
      .select("title, description, brand_protected, brand_name, images, protected_images, video_url")
      .eq("id", id)
      .maybeSingle();
    if (curErr) return NextResponse.json({ error: "매물을 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
    if (!cur) return NextResponse.json({ error: "매물을 찾을 수 없어요." }, { status: 404 });
    const curBp = cur.brand_protected === true;
    const curPaths: string[] = cur.protected_images ?? [];
    const finalBp = brandProtected === undefined ? curBp : brandProtected === true;
    const finalName = brandNameIn !== undefined ? cleanBrandName(brandNameIn) : cleanBrandName(cur.brand_name);
    const finalVideo: string | null = videoUrl !== undefined ? (typeof videoUrl === "string" && videoUrl ? videoUrl : null) : cur.video_url ?? null;
    const photosGiven = images !== undefined || protectedImages !== undefined;
    const involvesProtected =
      finalBp || curPaths.length > 0 || (Array.isArray(protectedImages) && protectedImages.length > 0) ||
      (Array.isArray(images) && images.some((v: unknown) => isProtectedRef(v)));
    if (photosGiven && involvesProtected) {
      const r = await resolvePhotos(supabaseAdmin, process.env.NEXT_PUBLIC_SUPABASE_URL as string, {
        images: images !== undefined ? images : cur.images ?? [],
        protectedImages: protectedImages !== undefined ? protectedImages : curPaths,
      });
      if (!r.ok) return NextResponse.json({ error: r.error, field: r.field }, { status: r.status });
      photos = r.split;
    }
    const finalImages: string[] = photos ? photos.images : images !== undefined ? images : cur.images ?? [];
    const finalProtected: string[] = photos ? photos.protectedPaths : curPaths;
    const rule = checkBrandProtectedRules({
      brandProtected: finalBp,
      brandName: finalName,
      publicImageCount: Array.isArray(finalImages) ? finalImages.length : 0,
      videoUrl: finalVideo,
      protectedCount: finalProtected.length,
      turningOn: !curBp && finalBp,
    });
    if (rule) {
      await photos?.discard();
      return NextResponse.json(rule, { status: 400 });
    }
    // 기존 매물(보호 아님)·보호와 무관한 수정은 아래 update에 아무것도 더하지 않음(응답·동작 변화 0)
    const bpUpdate: Record<string, unknown> = {};
    if (finalBp !== curBp) bpUpdate.brand_protected = finalBp;
    const nameAfter = finalBp ? finalName : null;
    if (nameAfter !== (cur.brand_name ?? null) && (finalBp || cur.brand_name != null)) bpUpdate.brand_name = nameAfter;
    if (photos) {
      bpUpdate.images = photos.images;
      if (JSON.stringify(photos.protectedPaths) !== JSON.stringify(curPaths)) bpUpdate.protected_images = photos.protectedPaths;
    }
    bpCtx = { finalBp, finalName, curTitle: cur.title, curDescription: cur.description ?? null, update: bpUpdate, oldProtected: curPaths };
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
    // 2026-10-23 카테고리·지역 — 등록과 같이 이름으로 받아 id로 바꿈(없는 이름이면 400). 알림은 보내지 않음(이 PATCH는 sendDealPush를 부르지 않는다)
    if (edit.category !== undefined) {
      const { data: cat } = await supabaseAdmin.from("categories").select("id").eq("name", edit.category).single();
      if (!cat) return NextResponse.json({ error: "없는 카테고리예요.", field: "category" }, { status: 400 });
      update.category_id = cat.id;
    }
    if (edit.region !== undefined) {
      const { data: reg } = await supabaseAdmin.from("regions").select("id").eq("name", edit.region).single();
      if (!reg) return NextResponse.json({ error: "없는 지역이에요.", field: "region" }, { status: 400 });
      update.region_id = reg.id;
    }
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
      // 2026-10-27 브랜드 보호: 매물명·설명에 브랜드명이 들어 있으면 경고(비회원에게 보이고 푸시에도 나감)
      if (bpCtx?.finalBp) {
        const t = cleanTitle !== undefined ? cleanTitle : current.title;
        const d = edit.description !== undefined ? edit.description : current.description;
        if (brandNameInText(bpCtx.finalName, t)) w.title.push(brandNameWarning(bpCtx.finalName, "title"));
        if (brandNameInText(bpCtx.finalName, d)) w.description.push(brandNameWarning(bpCtx.finalName, "description"));
      }
      if (w.title.length || w.description.length || w.price.length) {
        await photos?.discard();
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
    // 단가 단위(일괄 여부)는 바뀐 값 기준 — 일괄이면 최소 주문량 없음(등록과 같음)
    const lumpAfter = isLumpSum(edit.priceUnit !== undefined ? edit.priceUnit : current.price_unit);
    if (edit.priceUnit !== undefined) update.price_unit = edit.priceUnit ?? null;
    if (edit.minOrderQty !== undefined) update.min_order_qty = lumpAfter ? null : edit.minOrderQty || null;
    else if (edit.priceUnit !== undefined && lumpAfter) update.min_order_qty = null;
    if (edit.totalQty !== undefined) update.total_qty = edit.totalQty;
    if (edit.quantityUnit !== undefined) update.quantity_unit = (typeof edit.quantityUnit === "string" && edit.quantityUnit.trim()) || "개";
    if (edit.location !== undefined) update.location = edit.location ?? null;
    if (edit.stockType !== undefined) update.stock_type = edit.stockType;
    if (edit.packageUnit !== undefined) update.package_unit = edit.packageUnit || null;
    if (edit.origin !== undefined) update.origin = edit.origin || null;
    if (edit.spec !== undefined) update.spec = edit.spec || null;
    if (edit.pid !== undefined) update.pid = sanitizePid(edit.pid);
    if (edit.manifestItems !== undefined) update.manifest_items = sanitizeManifest(edit.manifestItems);
    if (edit.expiryDate !== undefined || edit.storageType !== undefined) {
      const expiry_date = edit.expiryDate !== undefined ? edit.expiryDate || null : current.expiry_date ?? null;
      const storage_type = edit.storageType !== undefined ? (isStorageType(edit.storageType) ? edit.storageType : null) : current.storage_type ?? null;
      if (edit.expiryDate !== undefined) update.expiry_date = expiry_date;
      if (edit.storageType !== undefined) update.storage_type = storage_type;
      // 예전 칸(storage_condition)도 등록처럼 새 칸 요약으로 — 새 칸이 다 비면 예전 자유 입력 값은 그대로
      const hadNewFields = !!(current.storage_type || current.expiry_date);
      update.storage_condition = storageSummary({ storage_type, expiry_date }) || (hadNewFields ? null : current.storage_condition ?? null);
    }
    if (edit.description !== undefined) update.description = edit.description || null;
    if (edit.closesAt !== undefined) update.closes_at = edit.closesAt;
  }
  if (Object.keys(edit).length === 0 && bpCtx?.finalBp && confirmWarnings !== true && (brandProtected !== undefined || brandNameIn !== undefined)) {
    const wt = brandNameInText(bpCtx.finalName, bpCtx.curTitle) ? [brandNameWarning(bpCtx.finalName, "title")] : [];
    const wd = brandNameInText(bpCtx.finalName, bpCtx.curDescription) ? [brandNameWarning(bpCtx.finalName, "description")] : [];
    if (wt.length || wd.length) {
      await photos?.discard();
      return NextResponse.json({ needsConfirm: true, field: wt.length ? "title" : "description", warnings: { title: wt, description: wd, price: [] } }, { status: 422 });
    }
  }
  if (edit.remainingQty !== undefined) update.remaining_qty = edit.remainingQty;
  if (status !== undefined) update.status = status;
  if (images !== undefined && !photos) update.images = images;
  if (bpCtx) Object.assign(update, bpCtx.update);
  if (videoUrl !== undefined) update.video_url = videoUrl;
  // 2026-09-30: 판매자 표시 수정 — 공개면 상호, 아니면 "비공개 판매자" (sellerDisplay.ts)
  if (sellerPublic !== undefined) Object.assign(update, resolveSellerDisplay(sellerPublic === true, sellerCompanyName));

  const { error } = await supabaseAdmin.from("deals").update(update).eq("id", id);
  if (error) {
    await photos?.discard();
    if (isBrandRuleViolation(error)) return NextResponse.json({ error: BP_MESSAGES.ruleViolation }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // 2026-10-27: 저장이 확정됐으니 옮긴 사진의 옛 원본을 지우고, 폼에서 지운 보호 사진 객체도 정리
  if (photos) {
    await photos.finalize();
    const gone = (bpCtx?.oldProtected ?? []).filter((pth) => !photos!.protectedPaths.includes(pth));
    await removeProtectedObjects(supabaseAdmin, gone);
  }
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
  const { data: before } = await supabaseAdmin.from("deals").select("title, status, protected_images").eq("id", id).maybeSingle();
  const { error } = await supabaseAdmin.from("deals").delete().eq("id", id);
  // 2026-10-01 F-2: deal_connections.deal_id가 on delete restrict — 거래 연결 기록이 있는 매물은 삭제 대신 마감
  if (error?.code === "23503") {
    return NextResponse.json({ error: "거래 연결 기록이 있는 매물은 삭제할 수 없어요. 마감 처리해 주세요." }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 2026-10-27 브랜드 보호: 삭제된 매물의 보호 사진 객체 정리(비공개 버킷)
  await removeProtectedObjects(supabaseAdmin, (before?.protected_images as string[] | null | undefined) ?? []);
  await writeAudit(supabaseAdmin, req, {
    admin: auth.admin,
    action: "deal_delete",
    targetType: "deal",
    targetId: id,
    detail: { title: before?.title ?? null, status: before?.status ?? null },
  });

  return NextResponse.json({ ok: true });
}
