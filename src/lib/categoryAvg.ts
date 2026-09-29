// "🔥 ○○ 평균보다 N%p 더 저렴" 배지 기준 (2026-09-29).
// 확인 안 된 숫자는 표시하지 않는다 — 표본이 충분할 때만 평균을 낸다.
//   표본: 같은 카테고리의 진행 중 매물 + 최근 30일 안에 등록된 매물(마감 포함), 제목에 "[테스트]"가 있으면 제외
//   조건: 표본 MIN_SAMPLES건 이상일 때만 평균 계산, 해당 매물이 평균보다 MIN_GAP_PCT%p 이상 저렴하면 배지
export const MIN_SAMPLES = 10;
export const MIN_GAP_PCT = 8;
export const SAMPLE_DAYS = 30;

export type AvgSampleRow = {
  category: string;
  title: string;
  original_price: number | null;
  deal_price: number;
  status?: string | null;
  closes_at: string;
  created_at?: string | null;
};

export function isTestTitle(title: string): boolean {
  return title.includes("[테스트]");
}

function discountPct(r: { original_price: number | null; deal_price: number }): number | null {
  if (!r.original_price || r.original_price <= 0) return null;
  return ((r.original_price - r.deal_price) / r.original_price) * 100;
}

export function avgDiscountByCategory(rows: AvgSampleRow[], nowMs: number): Record<string, number> {
  const since = nowMs - SAMPLE_DAYS * 24 * 3600e3;
  const sums: Record<string, { total: number; count: number }> = {};
  for (const r of rows) {
    if (isTestTitle(r.title)) continue;
    const active = (r.status ?? "active") === "active" && new Date(r.closes_at).getTime() > nowMs;
    const recent = !!r.created_at && new Date(r.created_at).getTime() >= since;
    if (!active && !recent) continue;
    const pct = discountPct(r);
    if (pct === null) continue;
    sums[r.category] ??= { total: 0, count: 0 };
    sums[r.category].total += pct;
    sums[r.category].count += 1;
  }
  const out: Record<string, number> = {};
  for (const [cat, { total, count }] of Object.entries(sums)) {
    if (count >= MIN_SAMPLES) out[cat] = total / count;
  }
  return out;
}

// 배지에 쓸 %p 차이 — 조건 미달이면 null (배지 숨김)
export function hotGapPct(
  deal: { category: string; title: string; original_price: number | null; deal_price: number },
  avgs: Record<string, number>,
): number | null {
  if (isTestTitle(deal.title)) return null;
  const avg = avgs[deal.category];
  const pct = discountPct(deal);
  if (avg === undefined || pct === null) return null;
  const gap = pct - avg;
  return gap >= MIN_GAP_PCT ? gap : null;
}
