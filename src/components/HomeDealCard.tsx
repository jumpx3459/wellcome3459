import type { MouseEvent } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/mockData";
import { formatCountdown, formatDealPrice } from "@/lib/format";
import { cardDiscountPct, showStrikePrice } from "@/lib/dealPriceAccess";
import { dealPriceLabel, isNegotiable } from "@/lib/priceMode";
import { isTimerRed, regionQtyText } from "@/lib/homeCard";
import { rem } from "@/lib/rem";
import NoPhotoPlaceholder from "@/components/NoPhotoPlaceholder";
import StockTypeBadge from "@/components/StockTypeBadge";
import PriceText from "@/components/PriceText";
import MemberPriceTeaser from "@/components/MemberPriceTeaser";
import NegotiablePrice from "@/components/NegotiablePrice";

// 회원 홈 매물 카드 D안 (2026-10-09 4b-2) — 회원 홈(AlertInboxHome) 전용. /deals·비회원 홈은 DealListCard 그대로.
// 가로 2열: 왼쪽 134px(타이머 → 사진 134×134) · 오른쪽(태그 → 제목 → 지역·수량 → 할인율+가격 → 정상가).
// 가격·억 표기·정상가 숨김은 4b-1 규칙 그대로(PriceText·dealPriceLabel·showStrikePrice).
export const HOME_CARD_THUMB = 134;

export default function HomeDealCard({
  deal: d,
  example = false,
  eager = false,
  onOpenPhotos,
}: {
  deal: Deal;
  example?: boolean;
  eager?: boolean;
  onOpenPhotos?: (e: MouseEvent, images: string[], video: string | null) => void; // 사진 눌러 크게 보기
}) {
  const cd = formatCountdown(d.closes_at);
  const red = isTimerRed(d.closes_at);
  const pct = cardDiscountPct(d);
  const images = d.images ?? [];
  const hasPhoto = images.length > 0;
  const openable = hasPhoto && !!onOpenPhotos;

  return (
    <Link
      href={example ? `/deals/example-${d.id}` : `/deals/${d.id}`}
      className="block w-full text-left"
      style={{ background: "#fff", borderRadius: 14, padding: 12, opacity: example ? 0.85 : 1, boxShadow: "0 1px 2px rgba(15,31,61,.06)" }}
      data-home-card
    >
      <div className="flex" style={{ gap: 12 }}>
        <div className="flex-shrink-0" style={{ width: HOME_CARD_THUMB }}>
          {/* 모든 형식("4일 7:52"·"03:15:19") 같은 글꼴 — 예전엔 시:분:초만 font-mono였음 */}
          <div
            data-timer
            data-timer-red={red ? "1" : undefined}
            className="text-center whitespace-nowrap"
            style={{ fontSize: rem(15), fontWeight: 700, color: red ? "#dc2626" : "#334155", fontVariantNumeric: "tabular-nums", marginBottom: 6, lineHeight: 1.3 }}
          >
            {cd.label}
          </div>
          <div
            className="relative overflow-hidden"
            style={{ width: HOME_CARD_THUMB, height: HOME_CARD_THUMB, borderRadius: 12 }}
            {...(openable
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: (e: MouseEvent) => onOpenPhotos!(e, images, d.video_url ?? null),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") onOpenPhotos!(e as unknown as MouseEvent, images, d.video_url ?? null);
                  },
                }
              : {})}
          >
            {hasPhoto ? (
              <img
                src={images[0]}
                alt={d.title}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                className="w-full h-full"
                style={{ objectFit: "cover", filter: example ? "grayscale(30%)" : undefined }}
              />
            ) : (
              <NoPhotoPlaceholder category={d.category} size="sm" muted={example} />
            )}
            {hasPhoto && d.video_url && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,.25)" }}>
                <span style={{ fontSize: rem(22), color: "#fff" }}>▶</span>
              </span>
            )}
            {images.length > 1 && (
              <span
                className="absolute rounded font-bold text-white whitespace-nowrap pointer-events-none"
                style={{ right: 6, bottom: 6, fontSize: rem(13), lineHeight: 1.3, padding: "2px 6px", background: "rgba(0,0,0,.5)" }}
                data-photo-count
              >
                📷 {images.length}장
              </span>
            )}
          </div>
        </div>

        {/* 2026-10-09 4a: 오른쪽 글 묶음을 카드 세로 가운데로(카드 높이는 왼쪽 열이 정함 — 변화 없음) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ overflowWrap: "anywhere" }} data-home-card-body>
          {(example || (d.stock_type && d.stock_type !== "general")) && (
            <div className="flex flex-wrap items-center gap-1" style={{ marginBottom: 4 }}>
              {example && (
                <span className="font-black rounded" style={{ fontSize: rem(12), padding: "2px 7px", background: "#E9ECEF", color: "#495057" }}>
                  예시
                </span>
              )}
              {d.stock_type && d.stock_type !== "general" && <StockTypeBadge value={d.stock_type} />}
            </div>
          )}
          <div
            data-title
            style={{ fontSize: rem(19), fontWeight: 600, color: "#0f1f3d", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {d.title}
          </div>
          <div className="truncate" style={{ fontSize: rem(15), color: "#64748b", marginTop: 4 }} data-region-qty>
            {regionQtyText(d.location, d.remaining_qty, d.quantity_unit)}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5" style={{ marginTop: 6 }}>
            {isNegotiable(d) ? (
              <NegotiablePrice color="#0f1f3d" className="text-lg" />
            ) : d.price_hidden ? (
              <MemberPriceTeaser discountPct={pct} color="#0f1f3d" className="text-lg" />
            ) : (
              <>
                {pct > 0 && (
                  <span className="text-white rounded whitespace-nowrap" style={{ fontSize: rem(15), fontWeight: 800, padding: "1px 7px", background: example ? "#9AA3AD" : "#E25100" }}>
                    -{pct}%
                  </span>
                )}
                {/* 한 줄에 들어가면 한 줄. 좁은 화면·큰 글자에서 넘칠 때만 PriceText 규칙대로 단위 앞(억·만 사이)에서 줄바꿈 — 잘리지 않게 */}
                <span style={{ fontSize: rem(21.5), fontWeight: 800, color: example ? "#6B7480" : "#0f1f3d", lineHeight: 1.25 }} data-price>
                  <PriceText text={dealPriceLabel(d)} />
                </span>
              </>
            )}
          </div>
          {!isNegotiable(d) && !d.price_hidden && showStrikePrice(d) && (
            <div style={{ fontSize: rem(13), color: "#94a3b8", textDecoration: "line-through", marginTop: 2 }}>
              <PriceText text={formatDealPrice(d.original_price!, d.quantity_unit, d.price_unit)} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
