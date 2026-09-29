// 재고 유형 (seller_requests.stock_type / deals.stock_type, 2026-09-29).
// DB check 제약과 같은 7개 값만 허용 — 바꾸면 supabase/schema.sql의 check도 같이 바꿀 것.
// general은 "일반 재고"라 배지를 달지 않는다. 알림 매칭(matchesConditions)과는 무관.
export const STOCK_TYPES = [
  { value: "general", label: "일반 재고", icon: "" },
  { value: "near_expiry", label: "유통기한 임박", icon: "⏰" },
  { value: "overstock", label: "과잉재고", icon: "📦" },
  { value: "closure", label: "이전·폐업 정리", icon: "🏭" },
  { value: "season_end", label: "시즌 종료", icon: "🍂" },
  { value: "returned", label: "반품·리퍼", icon: "↩️" },
  { value: "discontinued", label: "포장 변경·단종", icon: "🔄" },
] as const;

export type StockType = (typeof STOCK_TYPES)[number]["value"];

export function isStockType(v: unknown): v is StockType {
  return typeof v === "string" && STOCK_TYPES.some((t) => t.value === v);
}

// 배지 문구 — general·값 없음이면 null (배지 없음)
export function stockTypeBadge(v: string | null | undefined): string | null {
  const t = STOCK_TYPES.find((x) => x.value === v);
  if (!t || t.value === "general") return null;
  return `${t.icon} ${t.label}`;
}
