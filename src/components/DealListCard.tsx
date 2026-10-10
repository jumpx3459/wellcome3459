import Link from "next/link";
import type { Deal } from "@/lib/mockData";
import DealCardMedia from "@/components/DealCardMedia";
import PriceText from "@/components/PriceText";
import { cardDiscountPct, MEMBER_PRICE_CTA } from "@/lib/dealPriceAccess";
import { dealPriceLabel, isNegotiable } from "@/lib/priceMode";
import NegotiablePrice from "@/components/NegotiablePrice";
import { heartToShow } from "@/lib/heartCount";
import { qtyRegionText } from "@/lib/homeCard";
import { rem } from "@/lib/rem";

// /deals 목록 카드 — 실매물·예시 공용 (2026-09-29, 예전엔 예시 카드가 따로 있어서 배지 위치가 달랐음).
// 예시는 레이아웃 동일, 회색 톤으로만 구분(회색 줄 앞 "예시 ·" + 목록 위 "예시" 표시).
// 2026-10-04 v2: 사진을 정사각형(1:1)으로 크게, 글자 영역은 3줄로 압축. 보관·소비기한·원산지·MOQ·평균 대비 배지는 목록에서 뺌(상세에는 그대로).
// 2026-10-10 카드 정리: 왼쪽 카테고리 색 테두리·카테고리 색 글자 없음, 사진 위는 남은 시간(오른쪽 위)만(할인 배지·카테고리 칩·📷 장수 뺌).
//   글 영역 ① 매물명(기존 크기, 2줄 말줄임) ② [할인 배지] + 가격(회원) / "회원가 보기 ›"(비회원) — #0d2943 800, 할인 없으면 배지 없음, 줄 그은 정상가 없음
//   ③ 회색 한 줄 "{잔여 수량(천 단위 쉼표)}{단위} · {지역}"(#64748b). 재고 막대도 뺌(3줄 구성).
const INK = "#0d2943";

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
  priceHidden?: boolean; // 2026-10-03 A안: 비회원 — 가격 자리에 "회원가 보기 ›" (예시 카드도 같음)
}) {
  const gray = closed || example;
  const ink = closed ? "#6B7480" : INK;
  const discountPct = cardDiscountPct(d);
  const negotiable = isNegotiable(d); // 2026-10-04 가격 협의 — 가격 자리에 "가격 협의 · 점핑매니저가 연결해드려요"
  const showBadge = !closed && !negotiable && discountPct > 0;

  return (
    <Link
      href={example ? `/deals/example-${d.id}` : `/deals/${d.id}`}
      className="bg-white border border-gray200 rounded-2xl overflow-hidden flex flex-col relative w-full min-w-0 max-w-full"
      style={{
        opacity: closed ? 0.85 : example ? 0.9 : 1,
        boxShadow: gray ? "none" : "0 2px 8px rgba(11,37,64,0.08), 0 1px 2px rgba(11,37,64,0.04)",
      }}
    >
      <DealCardMedia
        image={d.images?.[0]}
        alt={d.title}
        category={d.category}
        discountPct={0}
        closesAt={d.closes_at}
        closed={closed}
        example={example}
        eager={eager}
        ratio="1/1"
      />

      {/* 2026-10-03: 운영(안드로이드 크롬)에서 긴 매물명이 한 줄로 카드 폭을 밀어 화면 밖으로 넘친 제보 — 본문·매물명을 min-w-0 블록 안에 둠 */}
      <div className="px-4 py-3 min-w-0">
        <div className="min-w-0">
          <div className="text-lg font-bold text-gray900 line-clamp-2" data-title>{d.title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1.5 min-w-0" data-price-row>
          {showBadge && (
            <span
              className="text-white rounded whitespace-nowrap flex-shrink-0"
              style={{ fontSize: rem(15), fontWeight: 800, lineHeight: 1.35, padding: "1px 7px", background: example ? "#9AA3AD" : "#e8590c" }}
              data-discount-badge
            >
              -{discountPct}%
            </span>
          )}
          {negotiable ? (
            <NegotiablePrice color={ink} className="text-lg" />
          ) : priceHidden ? (
            <span className="text-lg whitespace-nowrap" style={{ color: ink, fontWeight: 800 }} data-member-price>
              {MEMBER_PRICE_CTA} ›
            </span>
          ) : (
            <span className="text-lg whitespace-nowrap" style={{ color: ink, fontWeight: 800 }} data-price>
              <PriceText text={dealPriceLabel(d)} />
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-x-1 min-w-0" style={{ fontSize: rem(14), color: "#64748b" }} data-qty-region>
          <span className="truncate min-w-0">
            {example ? "예시 · " : ""}
            {closed ? d.location : qtyRegionText(d.remaining_qty, d.quantity_unit, d.location)}
          </span>
          {/* 2026-09-26: 관심표시 3건 미만은 숨김 — "관심 0~2명"은 오히려 인기 없어 보임.
              2026-10-09 PR 4a: 누계(interest_count) 대신 공개 하트 수(heart_count — 집계 시작 이후·테스트 회원 제외) */}
          {!closed && !example && heartToShow(d.heart_count) !== null && (
            <span className="flex-shrink-0 whitespace-nowrap font-bold" style={{ color: "#C2410C" }}>· ❤️ {heartToShow(d.heart_count)}</span>
          )}
        </div>
        {closed && (
          <div className="text-sm text-gray500 mt-1.5">
            {new Date(d.closes_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 마감
          </div>
        )}
      </div>
    </Link>
  );
}
