import { stockTypeBadge } from "@/lib/stockType";
import { rem } from "@/lib/rem";

// 재고 유형 배지 — 매물 카드·상세 공용 (2026-09-29). general·값 없음이면 아무것도 안 그림.
export default function StockTypeBadge({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const text = stockTypeBadge(value);
  if (!text) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold whitespace-nowrap flex-shrink-0 ${className}`}
      style={{ fontSize: rem(13), padding: "3px 9px", background: "#FFF4E0", color: "#8A4B00", border: "1px solid #F5D9A8" }}
    >
      {text}
    </span>
  );
}
