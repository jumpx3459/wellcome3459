import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidKoreanPhone } from "@/lib/auth";
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
  if (!isValidKoreanPhone(contactPhone)) {
    return NextResponse.json({ error: "올바른 휴대폰 번호를 입력해주세요." }, { status: 400 });
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
