import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { canSeeDealPrivate } from "@/lib/adminScope";
import { chipBNoMasked, loadRecentSellers, RECENT_SELLER_CHIPS } from "@/lib/recentSellers";

// 2026-10-28 7a 최근 확인된 판매자 칩 — 목록(값 없음). 등록 폼이 열릴 때 1번 부름.
//   응답 = 최대 5개 { rootCheckId, companyName, bNoMasked, lastDealAt } — 연락처·담당자·대표자명·원문 사업자번호 없음(값은 칩을 눌렀을 때 prefill GET).
//   범위: 최근 1년 매물에 붙은 진위 일치·예외 확인 root만(src/lib/recentSellers.ts). 점핑매니저는 본인이 조회한 기록만, 예외 확인 root 제외.
//   상호: 담당 매물(canSeeDealPrivate)이면 매물에 적은 상호, 아니면 조회 때 입력한 상호(input_company_name)만. 감사 기록 없음(값을 주지 않으므로).
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerRequests"); // 사업자 조회(재사용)와 같은 권한
  if (denied) return denied;

  const found = await loadRecentSellers(auth.db, auth.admin);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: 500 });

  const items = [];
  for (const s of found.items.slice(0, RECENT_SELLER_CHIPS)) {
    const full = await canSeeDealPrivate(auth.db, auth.admin, s.dealId);
    if (full === "error") return NextResponse.json({ error: "권한을 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
    items.push({
      rootCheckId: s.rootCheckId,
      companyName: (full ? s.dealCompany ?? s.rootCompany : s.rootCompany) ?? null,
      bNoMasked: chipBNoMasked(s.bNo),
      lastDealAt: s.dealAt,
      exception: s.rootException,
    });
  }
  return NextResponse.json({ items });
}
