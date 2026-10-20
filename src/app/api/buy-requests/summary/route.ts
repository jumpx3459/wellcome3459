import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadVisibleBuyRequests } from "@/lib/buyPublic";
import { summarizeBuyRows, type BuySummary } from "@/lib/buyNotice";

// /deals "찾습니다" 알림판용 공개 요약 (2026-10-13) — buy_requests는 anon 조회 정책이 없어(RLS) service_role로 읽고
// { count, names } 두 칸만 내려준다(public-stats와 같은 방식). 연락처·희망가·설명·회원 id·지역·글 id는 응답에 절대 넣지 않음.
//   2026-10-20: 대상 글 = 목록(/buy)과 같은 판정(src/lib/buyExposure.ts) — 점핑매니저 연락(contacted=true) · 결과 진행중 · 최근 30일 ·
//   시험 계정 제외(관리자 글은 10/19 이후 노출 + 예외 id). 이름 규칙은 src/lib/buyNotice.ts (최신 2개 · 연락처·링크 섞인 이름 제외 · 7자 + "…")
// 오류는 500 — 화면이 0건 문구로 대신 표시.
export const dynamic = "force-dynamic";

const CACHE = { "Cache-Control": "public, s-maxage=60" };

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Supabase 미설정(로컬 데모) — 글 없음
    return NextResponse.json({ count: 0, names: [] } satisfies BuySummary, { headers: CACHE });
  }

  try {
    const db = createClient(supabaseUrl, serviceKey);
    const rows = await loadVisibleBuyRequests(db);
    // 이름이 숨겨진(연락처·링크 섞인) 글은 건수엔 넣고 이름만 뺌 — summarizeBuyRows가 product_name null을 건너뜀
    const { count, names } = summarizeBuyRows(
      rows.map((r) => ({ product_name: r.name, contacted: true, created_at: r.created_at })),
      () => false,
      () => false
    );
    return NextResponse.json({ count, names } satisfies BuySummary, { headers: CACHE });
  } catch (e) {
    console.error("buy-requests summary", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "요약을 불러오지 못했어요." }, { status: 500 });
  }
}
