import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminPush } from "@/lib/sendPush";
import { clientIp } from "@/lib/adminAuth";
import { getMemberFromToken } from "@/lib/photoLimitServer";

// 회원 "관심있어요" → 운영자 푸시 (관리자 인증 없이 회원 화면이 부름).
// 2026-10-01: 입력 검증 + 호출 횟수 제한 — 예전엔 아무 dealId로 무제한 호출해 운영자에게 푸시를 쏟을 수 있었음.
//   · dealId는 uuid 형식 + 실제 매물만
//   · IP 기준 10분에 10회, 회원 기준 10분에 5회·같은 매물은 10분에 1회 (서버 인스턴스 메모리)
//   · 토큰이 오면 그 회원의 관심 표시(interests)가 실제로 있을 때만 알림 (예전 화면은 토큰 없이 와도 IP 제한만으로 유지)
const WINDOW_MS = 10 * 60 * 1000;
const IP_LIMIT = 10;
const MEMBER_LIMIT = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hits = new Map<string, number[]>();

function overLimit(key: string, limit: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export async function POST(req: NextRequest) {
  const { dealId, accessToken } = await req.json().catch(() => ({}));
  if (typeof dealId !== "string" || !UUID_RE.test(dealId)) return NextResponse.json({ ok: false }, { status: 400 });

  if (overLimit(`ip:${clientIp(req)}`, IP_LIMIT)) return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해주세요." }, { status: 429 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: true, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  if (typeof accessToken === "string" && accessToken) {
    const member = await getMemberFromToken(supabaseAdmin, accessToken);
    if (!member) return NextResponse.json({ ok: false }, { status: 401 });
    if (overLimit(`m:${member.id}`, MEMBER_LIMIT) || overLimit(`m:${member.id}:${dealId}`, 1)) {
      return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }
    const { data: interest } = await supabaseAdmin
      .from("interests")
      .select("id")
      .eq("deal_id", dealId)
      .eq("member_id", member.id)
      .maybeSingle();
    if (!interest) return NextResponse.json({ ok: false, skipped: "no_interest" });
  }

  const { data: deal } = await supabaseAdmin.from("deals").select("title").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ ok: false }, { status: 404 });

  await sendAdminPush(
    "🙋 새 관심 리드",
    deal.title ? `${deal.title} · 관심있어요` : "매물에 관심 표시가 들어왔어요",
    "/admin"
  );

  return NextResponse.json({ ok: true });
}
