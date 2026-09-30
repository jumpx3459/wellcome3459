import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidContactPhone } from "@/lib/auth";
import { sendAdminPush } from "@/lib/sendPush";
import { PRICE_UNITS } from "@/lib/format";
import { TERMS_VERSION } from "@/lib/consent";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { productName, category, region, quantity, hopePrice, hopePriceUnit, contactPhone, description, accessToken, privacyConsent } = body;
  // 희망 단가 기준 단위(2026-09-29) — 정해진 값만 저장
  const priceUnit = typeof hopePriceUnit === "string" && (PRICE_UNITS as readonly string[]).includes(hopePriceUnit) ? hopePriceUnit : null;

  if (!productName || !contactPhone) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }
  // 2026-09-30: [필수] 개인정보 수집·이용 동의 (화면 GuestPrivacyConsent). 동의 시각 저장은 consented_at 컬럼 SQL 실행 후
  if (privacyConsent !== true) {
    return NextResponse.json({ error: "개인정보 수집·이용에 동의해주세요.", field: "privacyConsent" }, { status: 400 });
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

  // 로그인 회원이면 access token에서 회원 id를 꺼내 연결 (body의 memberId 같은 값은 받지 않음).
  // 토큰이 없거나 만료됐으면 비회원 요청으로 저장 — 등록 자체는 막지 않는다.
  let memberId: string | null = null;
  if (typeof accessToken === "string" && accessToken) {
    const { data: userData } = await supabaseAdmin.auth.getUser(accessToken);
    memberId = userData.user?.id ?? null;
  }

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
    member_id: memberId,
    contact_phone: contactPhone,
    description: description || null,
    // 2026-09-30: [필수] 개인정보 수집·이용 동의 시각·문구 버전 (비회원은 member_consents에 못 남겨 행에 기록)
    privacy_consented_at: new Date().toISOString(),
    privacy_consent_version: TERMS_VERSION,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sendAdminPush("🔍 새 구매 희망 등록", `${productName} 찾는 회원`, "/admin");

  return NextResponse.json({ ok: true });
}
