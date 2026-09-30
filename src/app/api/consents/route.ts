import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TERMS_VERSION, isConsentSource, isConsentType } from "@/lib/consent";

// 동의 기록 (2026-09-30) — member_consents에 한 줄씩 추가만 한다(수정·삭제 없음, 최신 행이 현재 상태).
// body: { accessToken, source, consents: [{ type, agreed }] }. 회원 id는 토큰에서, 약관 버전은 서버 상수로.
export async function POST(req: NextRequest) {
  const { accessToken, source, consents } = await req.json().catch(() => ({}));
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isConsentSource(source)) return NextResponse.json({ error: "잘못된 요청입니다.", field: "source" }, { status: 400 });
  if (
    !Array.isArray(consents) ||
    consents.length === 0 ||
    consents.length > 10 ||
    !consents.every((c) => c && isConsentType(c.type) && typeof c.agreed === "boolean")
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다.", field: "consents" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });
    return NextResponse.json({ ok: true, recordedAt: new Date().toISOString(), demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });

  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 500) || null;
  const rows = consents.map((c: { type: string; agreed: boolean }) => ({
    member_id: userData.user.id,
    consent_type: c.type,
    agreed: c.agreed,
    terms_version: TERMS_VERSION,
    source,
    user_agent: userAgent,
  }));

  const { data, error } = await supabaseAdmin.from("member_consents").insert(rows).select("created_at");
  if (error) {
    // 23503: 회원 행(members)이 아직 없음 — 가입 완료 전
    console.error("[consents] insert 실패", error.code, error.message);
    return NextResponse.json({ error: "동의 저장에 실패했어요." }, { status: error.code === "23503" ? 409 : 500 });
  }

  return NextResponse.json({ ok: true, recordedAt: data?.[0]?.created_at ?? new Date().toISOString() });
}
