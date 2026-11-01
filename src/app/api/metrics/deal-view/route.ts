import type { NextRequest } from "next/server";
import { parseDealViewBody } from "@/lib/partnerSlots";
import { handleMetric } from "@/lib/metricsServer";

// 매물 상세 조회 1회 일별 합계 (2026-10-30 feat/stats-foundation) — { dealId }. 회원(토큰 확인)·비회원을 나눠 셈(deal_view_daily, track_deal_view).
// 없는 매물(FK 오류)도 응답은 204로 같음.
export async function POST(req: NextRequest) {
  return handleMetric(req, {
    rateKey: "mt-view",
    parse: parseDealViewBody,
    record: (db, i, isMember) => db.rpc("track_deal_view", { p_deal_id: i.dealId, p_is_member: isMember }),
  });
}
