import Link from "next/link";
import { categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import { formatDealPrice } from "@/lib/format";
import DealCardMedia from "@/components/DealCardMedia";
import PriceText from "@/components/PriceText";
import { stockTypeBadge } from "@/lib/stockType";
import { cardDiscountPct, showStrikePrice } from "@/lib/dealPriceAccess";
import { dealPriceLabel, isNegotiable } from "@/lib/priceMode";
import NegotiablePrice from "@/components/NegotiablePrice";
import MemberPriceTeaser from "@/components/MemberPriceTeaser";

// /deals 목록 카드 — 실매물·예시 공용 (2026-09-29, 예전엔 예시 카드가 따로 있어서 배지 위치가 달랐음).
// 예시는 레이아웃 동일, 회색 톤 + "예시" 라벨로만 구분.
// 2026-10-04 v2: 사진을 정사각형(1:1)으로 크게, 카테고리·시즌 태그는 사진 위 왼쪽 아래 오버레이로 이동, 글자 영역은 3줄로 압축 —
//   ① 매물명(2줄 말줄임) ② 판매가 + 정상가(취소선, 좁으면 아랫줄) ③ 잔여 수량 · 지역 한 줄. 재고 막대는 남은 재고 80% 이하일 때만.
//   보관·소비기한·원산지·MOQ·평균 대비 배지는 목록에서 뺌(상세에는 그대로).
export default function DealListCard({
  deal: d,
  closed = false,
  example = false,
  eager = false,
  priceHidden = d.price_hidden ?? false,
}: {
  deal: Deal;
  closed?: boolean;
  example?: boolean;
  hotGapPct?: number | null; // 같은 카테고리 평균보다 몇 %p 더 저렴한지 — 2026-10-04 v2부터 목록 카드에는 표시하지 않음(호출부는 그대로)
  eager?: boolean; // 첫 카드만 사진 바로 불러오기
  priceHidden?: boolean; // 2026-10-03 A안: 비회원 — 가격 자리에 "-N% · 회원가 보기" (예시 카드도 같음)
}) {
  const color = categoryColors[d.category] ?? categoryColors["기타"];
  const gray = closed || example;
  const accent = gray ? "#6B7480" : color.text;
  const remainPct = d.total_qty ? Math.round((d.remaining_qty / d.total_qty) * 100) : 0;
  const discountPct = cardDiscountPct(d);
  const negotiable = isNegotiable(d); // 2026-10-04 가격 협의 — 가격 자리에 "가격 협의 · 점핑매니저가 연결해드려요"
  const unit = d.quantity_unit || "개";
  // 사진 위 왼쪽 아래 태그: 카테고리(+시즌·재고 유형)
  const stock = stockTypeBadge(d.stock_type);
  const tag = `${categoryIcons[d.category] ?? "🗂️"} ${example ? "예시 · " : ""}${d.category}${stock ? ` · ${stock}` : ""}`;

  return (
    <Link
      href={example ? `/deals/example-${d.id}` : `/deals/${d.id}`}
      className="bg-white border border-gray200 rounded-2xl overflow-hidden flex flex-col relative w-full min-w-0 max-w-full"
      style={{
        borderLeft: `5px solid ${gray ? "#C7CBD1" : color.solid}`,
        opacity: closed ? 0.85 : example ? 0.9 : 1,
        boxShadow: gray ? "none" : "0 2px 8px rgba(11,37,64,0.08), 0 1px 2px rgba(11,37,64,0.04)",
      }}
    >
      <DealCardMedia
        image={d.images?.[0]}
        imageCount={d.images?.length ?? 0}
        alt={d.title}
        category={d.category}
        discountPct={discountPct}
        closesAt={d.closes_at}
        closed={closed}
        example={example}
        eager={eager}
        ratio="1/1"
        tag={tag}
      />

      {/* 2026-10-03: 운영(안드로이드 크롬)에서 긴 매물명이 한 줄로 카드 폭을 밀어 화면 밖으로 넘친 제보 — 본문·매물명을 min-w-0 블록 안에 둠 */}
      <div className="px-4 py-3 min-w-0">
        <div className="min-w-0">
          <div className="text-lg font-bold text-gray900 line-clamp-2" data-title>{d.title}</div>
        </div>
        {negotiable ? (
          <div className="mt-1.5">
            <NegotiablePrice color={accent} className="text-lg" />
          </div>
        ) : priceHidden ? (
          <div className="mt-1.5">
            <MemberPriceTeaser discountPct={discountPct} color={accent} className="text-lg" />
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mt-1.5">
            <span className="text-lg font-black whitespace-nowrap" style={{ color: accent }}>
              <PriceText text={dealPriceLabel(d)} />
            </span>
            {/* 2026-10-08 4b-1: 정상가가 없음·0·판매가 이하·판매가 없음이면 줄 그은 가격을 그리지 않음(할인율 배지와 같은 기준) */}
            {showStrikePrice(d) && (
              <span className="text-sm text-gray500 font-normal line-through whitespace-nowrap">
                <PriceText text={formatDealPrice(d.original_price!, d.quantity_unit, d.price_unit)} />
              </span>
            )}
          </div>
        )}
        <div className="text-sm font-medium mt-1 flex items-center gap-x-1 min-w-0" style={{ color: "#495057" }}>
          {closed ? (
            <span className="truncate min-w-0">{d.location}</span>
          ) : (
            <>
              <span className="whitespace-nowrap flex-shrink-0">잔여 {d.remaining_qty}{unit}</span>
              <span aria-hidden className="flex-shrink-0">·</span>
              <span className="truncate min-w-0">{d.location}</span>
              {/* 2026-09-26: 관심표시 3건 미만은 숨김 — "관심 0~2명"은 오히려 인기 없어 보임 */}
              {!example && (d.interest_count ?? 0) >= 3 && (
                <span className="flex-shrink-0 whitespace-nowrap font-bold" style={{ color: "#C2410C" }}>· ❤️ {d.interest_count}</span>
              )}
            </>
          )}
        </div>
        {/* 남은 재고 80% 이하일 때만 — 가득 찬 재고를 막대로 보여 줄 필요 없음 */}
        {!closed && remainPct <= 80 && (
          <div className="mt-2">
            <div className="h-[7px] bg-gray200 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${remainPct}%`, background: example ? "#AEB5BD" : color.solid }} />
            </div>
            <div className="text-sm font-bold mt-1" style={{ color: accent }}>
              재고 {remainPct}% 남음{!example && remainPct < 30 ? " · 서두르세요" : ""}
            </div>
          </div>
        )}
        {closed && (
          <div className="text-sm text-gray500 mt-1.5">
            {new Date(d.closes_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 마감
          </div>
        )}
      </div>
    </Link>
  );
}
