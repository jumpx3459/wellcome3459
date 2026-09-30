import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMemberFromToken } from "@/lib/photoLimitServer";

// 회원 방문 기록 (2026-09-30, 커밋 K) — 앱을 연 회원을 한국 날짜 기준 하루 1줄 member_active_days에 남김.
// 회원 판별은 토큰으로만(가입 전·비회원은 기록 안 함). 같은 날 두 번째부터는 무시(upsert ignoreDuplicates).
// 테이블이 아직 없으면(SQL 실행 전) 조용히 { ok: false } — 화면 동작에는 영향 없음.
const KST_MS = 9 * 3600e3;

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));
  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const db = createClient(supabaseUrl, serviceKey);
  const member = await getMemberFromToken(db, accessToken);
  if (!member) return NextResponse.json({ ok: false, skipped: "not_member" });

  const activeDate = new Date(Date.now() + KST_MS).toISOString().slice(0, 10);
  const { error } = await db
    .from("member_active_days")
    .upsert({ member_id: member.id, active_date: activeDate }, { onConflict: "member_id,active_date", ignoreDuplicates: true });
  if (error) {
    console.warn("[active-day] 기록 실패", error.code, error.message);
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true, activeDate });
}
