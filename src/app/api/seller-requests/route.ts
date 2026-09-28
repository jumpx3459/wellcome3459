import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidContactPhone } from "@/lib/auth";
import { sanitizeManifest, sanitizePid } from "@/lib/parseCsv";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    companyName,
    isAnonymous,
    memberId,
    contactName,
    contactPhone,
    category,
    region,
    productName,
    quantity,
    quantityUnit,
    minOrderQty,
    hopePrice,
    hopeDurationHours,
    description,
    packageUnit,
    origin,
    spec,
    storageCondition,
    pid,
    manifestItems,
    images,
    videoUrl,
  } = body;

  if (!contactPhone || !productName || !quantity) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }
  // 2026-09-29: 사무실 번호도 허용 (휴대폰 전용 검증은 로그인 OTP에만)
  if (!isValidContactPhone(contactPhone)) {
    return NextResponse.json({ error: "휴대폰 또는 사무실 번호를 정확히 입력해주세요", field: "contactPhone" }, { status: 400 });
  }
  // 2026-09-28: 수량보다 큰 MOQ(예: 수량 100kg, MOQ 1000kg)가 그대로 저장된 사례 — 폼(sell)과 같은 규칙
  if (minOrderQty != null && minOrderQty !== "" && Number(minOrderQty) > Number(quantity)) {
    return NextResponse.json({ error: "최소주문량은 총수량보다 클 수 없어요.", field: "minOrderQty" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Supabase 미설정(로컬 데모) — 저장 없이 성공 처리만
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const catRow = category
    ? (await supabaseAdmin.from("categories").select("id").eq("name", category).maybeSingle()).data
    : null;
  const regRow = region
    ? (await supabaseAdmin.from("regions").select("id").eq("name", region).maybeSingle()).data
    : null;

  const { error } = await supabaseAdmin.from("seller_requests").insert({
    company_name: companyName || null,
    is_anonymous: !!isAnonymous,
    seller_member_id: memberId || null,
    contact_name: contactName || null,
    contact_phone: contactPhone,
    category_id: catRow?.id ?? null,
    region_id: regRow?.id ?? null,
    product_name: productName,
    quantity,
    quantity_unit: quantityUnit || "개",
    min_order_qty: minOrderQty || null,
    hope_price: hopePrice,
    hope_duration_hours: hopeDurationHours ?? null,
    description,
    package_unit: packageUnit || null,
    origin: origin || null,
    spec: spec || null,
    storage_condition: storageCondition || null,
    pid: sanitizePid(pid),
    manifest_items: sanitizeManifest(manifestItems),
    images: images ?? [],
    video_url: videoUrl ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
