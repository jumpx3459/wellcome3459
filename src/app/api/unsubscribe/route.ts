import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MASKED_PHONE = "010-****-****";

// "+82 10-1234-5678" / "821012345678" / "010-1234-5678" → "01012345678"
function normalizePhone(p: string | null | undefined): string {
  const digits = (p ?? "").replace(/[^0-9]/g, "");
  return digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
}

// 번호가 같은 비회원 리드·구매 요청은 마스킹, OTP 발송 로그는 삭제. 실패하면 true.
async function maskByPhone(db: SupabaseClient, phone: string): Promise<boolean> {
  const tail = `%${phone.slice(-4)}`;
  const targets = [
    { table: "buy_requests", column: "contact_phone", mode: "mask" },
    { table: "quick_leads", column: "phone", mode: "mask" },
    { table: "otp_request_log", column: "phone", mode: "delete" },
  ] as const;

  for (const t of targets) {
    const { data, error } = await db.from(t.table).select(`id, ${t.column}`).like(t.column, tail);
    if (error) return true;
    const ids = ((data ?? []) as unknown as Record<string, string>[])
      .filter((r) => normalizePhone(r[t.column]) === phone)
      .map((r) => r.id);
    if (ids.length === 0) continue;
    const { error: writeError } =
      t.mode === "mask"
        ? await db.from(t.table).update({ [t.column]: MASKED_PHONE }).in("id", ids)
        : await db.from(t.table).delete().in("id", ids);
    if (writeError) return true;
  }
  return false;
}

// 알림 끄기 / 회원 탈퇴. 2026-09-28 보안 수정: 예전엔 로그인 없이 전화번호만 받아서
// 그 번호의 회원을 통째로 삭제했음(남의 번호만 알면 탈퇴시킬 수 있었음). 이제는
// access token으로 본인을 확인하고 토큰의 회원 id만 처리한다.
//   action "push_off" — push_subscriptions만 삭제 (회원 정보·알림 조건은 유지)
//   action "withdraw" — confirm: true일 때만 회원 행까지 삭제
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { accessToken, action, confirm } = body as {
    accessToken?: string;
    action?: string;
    confirm?: boolean;
    phone?: string;
  };

  // 예전 방식(전화번호로 대상 지정)은 명시적으로 거부
  if ("phone" in body) {
    return NextResponse.json({ error: "로그인 후 이용해주세요." }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (action !== "push_off" && action !== "withdraw") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (action === "withdraw" && confirm !== true) {
    return NextResponse.json({ error: "탈퇴 확인이 필요합니다." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "로그인이 만료됐어요. 다시 로그인해주세요." }, { status: 401 });
  }
  const memberId = userData.user.id;

  if (action === "push_off") {
    // 플래그를 먼저 세워야, 다른 기기에 남은 브라우저 구독이 마이페이지에서 조용히
    // 재저장되는 걸 막을 수 있다(/api/push/subscribe가 이 값을 본다).
    const { error: optError } = await supabaseAdmin.from("members").update({ push_opt_out: true }).eq("id", memberId);
    if (optError) {
      return NextResponse.json({ error: "알림 해지 중 오류가 발생했어요." }, { status: 500 });
    }
  }

  const { error: pushError } = await supabaseAdmin.from("push_subscriptions").delete().eq("member_id", memberId);
  if (pushError) {
    return NextResponse.json({ error: "알림 해지 중 오류가 발생했어요." }, { status: 500 });
  }
  if (action === "push_off") {
    return NextResponse.json({ ok: true });
  }

  // 탈퇴 시 개인정보 마스킹 — 거래·문의 기록(매물명/가격/회사명 등)은 남기되 연락처로 개인을
  // 식별할 수 없게 한다. 번호는 테이블마다 저장 형식이 달라서("010…", "010-…", "+8210…")
  // 끝 4자리로 후보를 좁힌 뒤 숫자만 정규화해서 비교한다.
  const { data: memberRow, error: memberRowError } = await supabaseAdmin
    .from("members")
    .select("phone")
    .eq("id", memberId)
    .maybeSingle();
  if (memberRowError) {
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요." }, { status: 500 });
  }
  const myPhones = new Set(
    [memberRow?.phone, userData.user.phone].map((p) => normalizePhone(p)).filter((p) => p.length >= 10)
  );
  for (const phone of myPhones) {
    const failed = await maskByPhone(supabaseAdmin, phone);
    if (failed) {
      return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요." }, { status: 500 });
    }
  }

  // cascade가 없는 참조(내가 추천한 회원의 referred_by, 내가 올린 판매 신청/매물의
  // seller_member_id)를 먼저 비워야 members 삭제가 FK 에러 없이 된다. 예전 코드는 이 에러를
  // 확인하지 않아서, 추천/판매 이력이 있는 회원은 삭제가 실패해도 "탈퇴됨"으로 보였음.
  // 판매 신청은 연결을 끊는 같은 update에서 연락처도 마스킹 — 따로 하면 중간 실패 후 재시도 때
  // seller_member_id로 더는 찾을 수 없다.
  // 나머지(카테고리·지역·관심·쪽지·메모 등)는 on delete cascade로 같이 지워진다.
  const detach = await Promise.all([
    supabaseAdmin.from("members").update({ referred_by: null }).eq("referred_by", memberId),
    supabaseAdmin
      .from("seller_requests")
      .update({ seller_member_id: null, contact_phone: MASKED_PHONE, contact_name: "탈퇴회원" })
      .eq("seller_member_id", memberId),
    supabaseAdmin.from("deals").update({ seller_member_id: null }).eq("seller_member_id", memberId),
    // 구매 요청: 연락처를 다른 번호로 등록했어도 member_id로 연결된 건은 마스킹 (연결은 FK on delete set null)
    supabaseAdmin.from("buy_requests").update({ contact_phone: MASKED_PHONE }).eq("member_id", memberId),
  ]);
  if (detach.some((r) => r.error)) {
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요." }, { status: 500 });
  }

  const { error: memberError } = await supabaseAdmin.from("members").delete().eq("id", memberId);
  if (memberError) {
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요." }, { status: 500 });
  }

  // 로그인 계정(auth.users, 전화번호 포함)까지 삭제해야 개인정보 파기가 완료된다.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(memberId);
  if (authError) {
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요. 고객센터로 문의해주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
