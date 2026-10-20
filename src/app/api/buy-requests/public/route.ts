import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadVisibleBuyRequests } from "@/lib/buyPublic";
import { UUID_RE, type PublicBuyItem } from "@/lib/buyExposure";

// /buy "찾습니다" 목록 + /sell?buyRef 조회용 공개 API (2026-10-20) — buy_requests는 anon 조회 정책이 없어(RLS) service_role로 읽는다.
// 노출 조건·시험 제외는 src/lib/buyExposure.ts(띠 요약과 같은 판정). 응답은 { items: [{ id, name, category, quantity, region, created_at }] } 만:
// 연락처·희망가·설명·회원 id·이름·상호 칸은 응답에 절대 넣지 않음. ?id=<uuid>이면 그 건만(노출 조건 통과 시).
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ items: [] }, { headers: HEADERS });

  const id = req.nextUrl.searchParams.get("id");
  if (id !== null && !UUID_RE.test(id)) return NextResponse.json({ items: [] }, { headers: HEADERS });

  try {
    const db = createClient(supabaseUrl, serviceKey);
    const rows = await loadVisibleBuyRequests(db, id ? { id } : {});
    // 허용 칸만 골라서 내려줌(여기서 한 번 더 — 내부 칸이 실수로 섞여도 안 나가게)
    const items: PublicBuyItem[] = rows.slice(0, 100).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      region: r.region,
      created_at: r.created_at,
    }));
    return NextResponse.json({ items }, { headers: HEADERS });
  } catch (e) {
    console.error("buy-requests public", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "목록을 불러오지 못했어요." }, { status: 500, headers: HEADERS });
  }
}
