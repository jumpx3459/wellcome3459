import { mockDeals } from "@/lib/mockData";

// "💡 이런 매물이 올라와요" 예시 카드 — 회원 홈(AlertInboxHome)과 /deals가 같은 규칙을 쓴다.
// 실제 매물이 EXAMPLE_THRESHOLD건보다 적을 때만, 데모가 아닌(Supabase 연결된) 환경에서 노출.
export const EXAMPLE_THRESHOLD = 5;
export const EXAMPLE_DEALS = mockDeals.filter((d) => d.status !== "closed").slice(0, 4);

export function shouldShowExamples(realCount: number, supabaseConfigured: boolean): boolean {
  return supabaseConfigured && realCount < EXAMPLE_THRESHOLD;
}
