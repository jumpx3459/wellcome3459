import type { NextRequest } from "next/server";
import { parseSlotBody } from "@/lib/partnerSlots";
import { handleMetric } from "@/lib/metricsServer";

// 제휴 칸 노출·클릭 일별 합계 (2026-10-30 feat/stats-foundation) — { slot, partnerId, kind }. 응답은 항상 204(입력 오류만 400).
// 한국 날짜 합계만 쌓음(ad_daily_stats, track_ad_event) — 개인 식별 값 없음.
export async function POST(req: NextRequest) {
  return handleMetric(req, {
    rateKey: "mt-slot",
    parse: parseSlotBody,
    record: (db, i) => db.rpc("track_ad_event", { p_slot: i.slot, p_ad_id: i.partnerId, p_kind: i.kind }),
  });
}
