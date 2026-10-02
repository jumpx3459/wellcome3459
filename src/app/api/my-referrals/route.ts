import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { maskPhone } from "@/lib/phone";

// 내가 추천해서 가입한 회원 목록 — 본인 access token으로 신원을 검증한 뒤 반환합니다.
// 2026-10-02: 전화번호는 서버에서 가운데를 가린 값(maskPhone "010-****-5678")만 내려줌 — 추천인에게 다른 회원의
// 전체 번호가 가지 않게(예전엔 가입 확인용으로 전체 번호를 그대로 줬음). 전체 번호는 관리자 화면·관리자 API에서만.
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ count: 0, items: [], demo: true });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, member_no, is_business, created_at, phone, company_name, business_verified")
    .eq("referred_by", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 컨택 메모는 members가 아니라 별도 referral_notes 테이블(service_role 전용)에서 조회 —
  // members_self_select 정책상 회원 본인이 자기 행의 메모를 직접 읽을 수 없게 하기 위함.
  const memberIds = (data ?? []).map((m) => m.id);
  const notesById: Record<string, string | null> = {};
  if (memberIds.length > 0) {
    const { data: noteRows } = await supabaseAdmin
      .from("referral_notes")
      .select("member_id, note")
      .eq("referrer_id", userData.user.id)
      .in("member_id", memberIds);
    for (const r of noteRows ?? []) notesById[r.member_id] = r.note;
  }

  const items = (data ?? []).map((m) => ({
    id: m.id,
    member_no: m.member_no,
    is_business: m.is_business,
    created_at: m.created_at,
    phone: maskPhone(m.phone),
    company_name: m.company_name,
    business_verified: m.business_verified,
    referral_note: notesById[m.id] ?? null,
  }));

  return NextResponse.json({ count: items.length, items });
}

// 2026-09-27: 점핑파트너 "내 추천 회원" 대시보드 — 추천인이 자신이 추천한 회원에 대해
// 남기는 컨택 메모(연락 여부 등)만 갱신합니다. 대상 회원의 referred_by가 요청자 본인과
// 일치하는지 서버에서 직접 확인한 뒤에만 service_role로 referral_notes에 upsert —
// members 테이블은 건드리지 않고, 다른 회원 정보(전화번호, 사업자 인증 등)도 이 라우트로
// 수정할 수 없습니다.
export async function PATCH(req: NextRequest) {
  const { accessToken, memberId, note } = await req.json();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });
  if (!accessToken) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!memberId || typeof note !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (note.length > 500) {
    return NextResponse.json({ error: "메모는 500자 이내로 입력해주세요." }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from("members")
    .select("id, referred_by")
    .eq("id", memberId)
    .maybeSingle();
  if (targetError || !target || target.referred_by !== userData.user.id) {
    return NextResponse.json({ error: "내가 추천한 회원만 메모를 남길 수 있어요." }, { status: 403 });
  }

  const { error: upsertError } = await supabaseAdmin
    .from("referral_notes")
    .upsert(
      { referrer_id: userData.user.id, member_id: memberId, note: note || null, updated_at: new Date().toISOString() },
      { onConflict: "referrer_id,member_id" }
    );
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
