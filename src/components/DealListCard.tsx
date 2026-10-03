import Link from "next/link";
import { categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import { formatDealPrice } from "@/lib/format";
import DealCardMedia from "@/components/DealCardMedia";
import PriceText from "@/components/PriceText";
import StockTypeBadge from "@/components/StockTypeBadge";
import { isLumpSum } from "@/lib/priceUnit";
import { formatExpiry, isStorageType, STORAGE_ICONS } from "@/lib/dealFields";

// /deals 목록 카드 — 실매물·예시 공용 (2026-09-29, 예전엔 예시 카드가 따로 있어서 배지 위치가 달랐음).
// 예시는 레이아웃 동일, 회색 톤 + "예시" 라벨로만 구분.
export default function DealListCard({
  deal: d,
  closed = false,
  example = false,
  hotGapPct = null,
  eager = false,
}: {
  deal: Deal;
  closed?: boolean;
  example?: boolean;
  hotGapPct?: number | null; // 같은 카테고리 평균보다 몇 %p 더 저렴한지 — 표시 조건은 src/lib/categoryAvg.ts
  eager?: boolean; // 첫 카드만 사진 바로 불러오기
}) {
  const color = categoryColors[d.category] ?? categoryColors["기타"];
  const gray = closed || example;
  const accent = gray ? "#6B7480" : color.text;
  const remainPct = d.total_qty ? Math.round((d.remaining_qty / d.total_qty) * 100) : 0;
  const discountPct = d.original_price ? Math.round(((d.original_price - d.deal_price) / d.original_price) * 100) : 0;
  const unit = d.quantity_unit || "개";
  const lump = isLumpSum(d.price_unit); // 일괄 판매면 MOQ 의미 없음
  const expiry = formatExpiry(d.expiry_date); // 2026-10-01 PR-B: "~2026.10.20까지"
  const storage = isStorageType(d.storage_type) ? d.storage_type : null;

  return (
    <Link
      href={example ? `/deals/example-${d.id}` : `/deals/${d.id}`}
      className="bg-white border border-gray200 rounded-2xl overflow-hidden flex flex-col relative"
      style={{
        borderLeft: `5px solid ${gray ? "#C7CBD1" : color.solid}`,
        opacity: closed ? 0.85 : example ? 0.9 : 1,
        boxShadow: gray ? "none" : "0 2px 8px rgba(11,37,64,0.08), 0 1px 2px rgba(11,37,64,0.04)",
      }}
    >
      <DealCardMedia
        image={d.images?.[0]}
        alt={d.title}
        category={d.category}
        discountPct={discountPct}
        closesAt={d.closes_at}
        closed={closed}
        example={example}
        eager={eager}
      />

      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div
            className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full min-w-0"
            style={{ background: gray ? "#E9ECEF" : color.bg, color: gray ? "#495057" : color.text }}
          >
            <span className="text-sm flex-shrink-0">{categoryIcons[d.category] ?? "🗂️"}</span>
            <span className="truncate">{example ? `예시 · ${d.category}` : d.category}</span>
          </div>
          <StockTypeBadge value={d.stock_type} className="mr-auto" />
          {/* 2026-09-26: 관심표시 3건 미만은 숨김 — "관심 0~2명"은 오히려 인기 없어 보임 */}
          {!example && (d.interest_count ?? 0) >= 3 && (
            <div className="inline-flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: "#C2410C" }}>
              ❤️ {d.interest_count}명 관심
            </div>
          )}
        </div>
        {/* 2026-10-03: 매물명 2줄까지 + 말줄임. 수량·MOQ는 각각 한 덩어리(글자 중간 줄바꿈 없음), 가격은 숫자·단위 사이에서만 줄바꿈(PriceText) */}
        <div className="text-lg font-bold text-gray900 mt-2 line-clamp-2" data-title>{d.title}</div>
        <div className="text-sm font-medium mt-1 flex flex-wrap items-center gap-x-1" style={{ color: "#495057" }}>
          {closed ? (
            d.location
          ) : (
            <>
              <span className="whitespace-nowrap">잔여 {d.remaining_qty}{unit} ·</span>
              <span>{d.location}</span>
            </>
          )}
        </div>
        {(storage || expiry) && (
          <div className="text-xs font-bold mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: gray ? "#6B7480" : "#C2410C" }}>
            {storage && <span>{STORAGE_ICONS[storage]} {storage}</span>}
            {storage && expiry ? <span style={{ color: "#C7CBD1" }}>·</span> : null}
            {expiry && <span>⏰ 소비기한 {expiry}</span>}
          </div>
        )}
        {(d.origin || (d.min_order_qty && !lump)) && (
          <div className="text-xs font-medium mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "#495057" }}>
            {d.origin && <span>🌍 {d.origin}</span>}
            {d.origin && d.min_order_qty && !lump ? <span style={{ color: "#C7CBD1" }}>·</span> : null}
            {d.min_order_qty && !lump && <span className="whitespace-nowrap">MOQ {d.min_order_qty}{unit}</span>}
          </div>
        )}
        <div className="flex flex-wrap items-baseline gap-x-1.5 mt-2">
          <span className="text-lg font-black" style={{ color: accent }}>
            <PriceText text={formatDealPrice(d.deal_price, d.quantity_unit, d.price_unit)} />
          </span>
          <span className="text-sm text-gray500 font-normal line-through">
            <PriceText text={formatDealPrice(d.original_price, d.quantity_unit, d.price_unit)} />
          </span>
        </div>
        {!gray && hotGapPct !== null && (
          <div
            className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mt-1.5"
            style={{ background: "#FDEEE8", color: "#C2410C" }}
          >
            🔥 {d.category} 평균보다 {Math.round(hotGapPct)}%p 더 저렴
          </div>
        )}
        {!closed && (
          <div className="mt-2.5">
            <div className="h-[7px] bg-gray200 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${remainPct}%`, background: example ? "#AEB5BD" : color.solid }} />
            </div>
            <div className="text-sm font-bold mt-1.5" style={{ color: accent }}>
              재고 {remainPct}% 남음{!example && remainPct < 30 ? " · 서두르세요" : ""}
            </div>
          </div>
        )}
        {closed && (
          <div className="text-sm text-gray500 mt-2">
            {new Date(d.closes_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 마감
          </div>
        )}
      </div>
    </Link>
  );
}
