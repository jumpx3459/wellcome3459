import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTestBuyerLookup } from "@/lib/kpiExclusion";
import { normalizePhone } from "@/lib/phone";
import { hasContactOrLink } from "@/lib/titleGuard";
import { BUY_NOTICE_DAYS, summarizeBuyRows, type BuySummary } from "@/lib/buyNotice";

// /deals "찾습니다" 알림판용 공개 요약 (2026-10-13) — buy_requests는 anon 조회 정책이 없어(RLS) service_role로 읽고
// { count, names } 두 칸만 내려준다(public-stats와 같은 방식). 연락처·희망가·설명·회원 id·지역·글 id는 응답에 절대 넣지 않음.
//   대상: outcome='pending' · 최근 30일 · 시험 계정 제외(kpiExclusion: 회원 is_test·관리자 번호·제외 번호 표)
//   이름 규칙은 src/lib/buyNotice.ts (contacted=true 글만 · 최신 2개 · 연락처·링크 섞인 이름 제외 · 7자 + "…")
// member_id·contact_phone은 시험 계정 판별에만 읽고 버린다. 오류는 500 — 화면이 0건 문구로 대신 표시.
export const dynamic = "force-dynamic";

const CACHE = { "Cache-Control": "public, s-maxage=60" };
const ROW_LIMIT = 1000;

type Row = { product_name: string | null; contacted: boolean | null; created_at: string; member_id: string | null; contact_phone: string | null };

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Supabase 미설정(로컬 데모) — 글 없음
    return NextResponse.json({ count: 0, names: [] } satisfies BuySummary, { headers: CACHE });
  }

  const db = createClient(supabaseUrl, serviceKey);
  const since = new Date(Date.now() - BUY_NOTICE_DAYS * 24 * 3600e3).toISOString();
  const { data, error } = await db
    .from("buy_requests")
    .select("product_name, contacted, created_at, member_id, contact_phone")
    .eq("outcome", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT);
  if (error) {
    console.error("buy-requests summary", error.message);
    return NextResponse.json({ error: "요약을 불러오지 못했어요." }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const memberIds = rows.map((r) => r.member_id).filter((v): v is string => !!v);
  const test = await getTestBuyerLookup(db, memberIds);
  const isTest = (r: Row) =>
    (r.member_id != null && test.memberIds.has(r.member_id)) || (!!r.contact_phone && test.phones.has(normalizePhone(r.contact_phone)));

  const { count, names } = summarizeBuyRows(rows, isTest, hasContactOrLink);
  return NextResponse.json({ count, names } satisfies BuySummary, { headers: CACHE });
}
