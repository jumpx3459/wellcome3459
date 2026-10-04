import { NEGOTIABLE_LABEL, NEGOTIABLE_NOTE } from "@/lib/priceMode";

// 2026-10-04 가격 협의 매물의 가격 자리 — "가격 협의 · 점핑매니저가 연결해드려요".
// MemberPriceTeaser와 같은 규칙: 각 덩어리는 글자 중간에서 줄바꿈하지 않고, 자리가 모자라면 둘 사이에서만 줄바꿈.
export default function NegotiablePrice({
  color,
  className = "",
  showNote = true,
}: {
  color: string;
  className?: string;
  showNote?: boolean;
}) {
  return (
    <span className={`font-black ${className}`} style={{ color }} data-negotiable-price>
      <span className="whitespace-nowrap">{NEGOTIABLE_LABEL}</span>
      {showNote && (
        <>
          <span aria-hidden className="font-bold text-gray500"> ·</span>
          <wbr />{" "}
          <span className="whitespace-nowrap font-bold text-gray500" style={{ fontSize: "0.72em" }}>
            {NEGOTIABLE_NOTE}
          </span>
        </>
      )}
    </span>
  );
}
