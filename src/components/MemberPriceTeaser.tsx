import { MEMBER_PRICE_CTA } from "@/lib/dealPriceAccess";

// 2026-10-03 A안: 비회원 카드의 가격 자리 — "-N% · 회원가 보기" (할인율 없으면 "회원가 보기").
// 할인율·문구는 각각 한 덩어리(글자 중간 줄바꿈 없음), 자리가 모자라면 둘 사이에서만 줄바꿈 (PriceText와 같은 규칙).
export default function MemberPriceTeaser({
  discountPct,
  color,
  className = "",
}: {
  discountPct: number | null | undefined;
  color: string;
  className?: string;
}) {
  const pct = discountPct && discountPct > 0 ? discountPct : null;
  return (
    <span className={`font-black ${className}`} style={{ color }} data-member-price>
      {pct !== null && (
        <>
          <span className="whitespace-nowrap">-{pct}% ·</span>
          <wbr />{" "}
        </>
      )}
      <span style={{ wordBreak: "keep-all" }}>{MEMBER_PRICE_CTA}</span>
    </span>
  );
}
