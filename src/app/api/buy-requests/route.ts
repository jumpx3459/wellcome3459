import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidKoreanPhone } from "@/lib/auth";
import { sendAdminPush } from "@/lib/sendPush";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { productName, category, region, quantity, hopePrice, contactPhone, description } = body;

  if (!productName || !contactPhone) {
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
    contact_phone: contactPhone,
    description: description || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sendAdminPush("🔍 새 구매 희망 등록", `${productName} 찾는 회원`, "/admin");

  return NextResponse.json({ ok: true });
}
