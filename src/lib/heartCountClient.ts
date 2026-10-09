import { supabase } from "@/lib/supabase";
import { HEART_COUNT_START, heartMap } from "@/lib/heartCount";

// 브라우저에서 하트 수 읽기 (2026-10-09 PR 4a) — anon·회원 모두 실행 가능한 DB 함수 deal_heart_counts.
// 실패(함수가 아직 없음 = SQL 실행 전, 네트워크 등)면 빈 값 → 하트를 그리지 않음(예전 누계 interest_count로 되돌리지 않음).
export async function fetchHeartCounts(dealIds: string[]): Promise<Record<string, number>> {
  if (!supabase || dealIds.length === 0) return {};
  try {
    const { data, error } = await supabase.rpc("deal_heart_counts", { p_deal_ids: dealIds.slice(0, 200), p_since: HEART_COUNT_START });
    if (error) return {};
    return heartMap(data as { deal_id: string; heart_count: number }[]);
  } catch {
    return {};
  }
}
