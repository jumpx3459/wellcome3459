import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidContactPhone } from "@/lib/auth";
import { sendAdminPush } from "@/lib/sendPush";
import { PRICE_UNITS } from "@/lib/format";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { productName, category, region, quantity, hopePrice, hopePriceUnit, contactPhone, description } = body;
  // 희망 단가 기준 단위(2026-09-29) — 정해진 값만 저장
  const priceUnit = typeof hopePriceUnit === "string" && (PRICE_UNITS as readonly string[]).includes(hopePriceUnit) ? hopePriceUnit : null;

  if (!productName || !contactPhone) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }
  // 2026-09-29: 사무실 번호도 허용 (휴대폰 전용 검증은 로그인 OTP에만)
  if (!isValidContactPhone(contactPhone)) {
    return NextResponse.json({ error: "휴대폰 또는 사무실 번호를 정확히 입력해주세요", field: "contactPhone" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Supabase 미설정(로컬 데모) — 저장 없이 성공 처리만
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: catRow } = category
    ? await supabaseAdmin.from("categories").select("id").eq("name", category).single()
    : { data: null };
  const { data: regRow } = region
    ? await supabaseAdmin.from("regions").select("id").eq("name", region).single()
    : { data: null };

  const { error } = await supabaseAdmin.from("buy_requests").insert({
    product_name: productName,
    category_id: catRow?.id ?? null,
    region_id: regRow?.id ?? null,
    quantity: quantity || null,
    hope_price: hopePrice || null,
    hope_price_unit: hopePrice ? priceUnit : null,
    contact_phone: contactPhone,
    description: description || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sendAdminPush("🔍 새 구매 희망 등록", `${productName} 찾는 회원`, "/admin");

  return NextResponse.json({ ok: true });
}
