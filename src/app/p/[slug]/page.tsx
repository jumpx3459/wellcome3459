"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import { formatPrice, formatDealPrice } from "@/lib/format";
import { selectWithPriceAccess, dealPriceFields, cardDiscountPct, memberPriceTeaser } from "@/lib/dealPriceAccess";
import { dealPriceLabel, isNegotiable } from "@/lib/priceMode";
import NegotiablePrice from "@/components/NegotiablePrice";
import { withReturnTo } from "@/lib/safeReturnTo";
import { getPartner } from "@/lib/partners";
import { formatDealLocation } from "@/lib/formatDealLocation";
import { rem } from "@/lib/rem";

const PREVIEW_COUNT = 4;

// 2026-09-27: 점핑파트너 영업용 데모 스킨. 실제 매물 데이터는 기존 deals 테이블을
// 그대로 읽어오고(별도 DB/도메인 없음), 로고·이름·강조색만 파트너 브랜드로 바꿔
// "당신 브랜드로 운영되는 덤핑점핑"을 미리 보여주는 영업 도구입니다. 바텀탭 등
// 실제 앱 내비게이션은 없는 단일 랜딩 페이지(AppShell에서 /p/ 경로는 바텀탭 제외).
export default function PartnerDemoPage() {
  const params = useParams<{ slug: string }>();
  const partner = getPartner(params.slug);
  const [deals, setDeals] = useState<Deal[]>(mockDeals.filter((d) => d.status !== "closed").slice(0, PREVIEW_COUNT));
  // 2026-10-03 A안: 비회원은 가격 대신 "-N% · 회원가 보기" — 조회 전(첫 화면)도 숨김으로 시작
  const [priceHidden, setPriceHidden] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return; // 데모 모드: mockDeals 사용

    (async () => {
      const { data, error, priceHidden: hidden } = await selectWithPriceAccess((cols) =>
        supabase!
          .from("deals")
          .select(
            `id, title, ${cols}, total_qty, remaining_qty, quantity_unit, price_unit, closes_at, location, images, stock_type, categories(name), regions(name)`
          )
          .eq("status", "active")
          .gt("closes_at", new Date().toISOString())
          .order("closes_at", { ascending: true })
          .limit(PREVIEW_COUNT)
      );

      if (error || !data) return;
      setPriceHidden(hidden);
      setDeals(
        data.map((d) => {
          const rec = d as unknown as Record<string, unknown>;
          return {
            ...rec,
            ...dealPriceFields(rec, hidden),
            category: (rec.categories as { name: string } | null)?.name ?? "기타",
            location: formatDealLocation((rec.regions as { name: string } | null)?.name, rec.location as string | null),
          } as unknown as Deal;
        })
      );
    })();
  }, []);

  if (!partner) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "#0B2540" }}>
          존재하지 않는 파트너 페이지예요.
        </p>
        <Link href="/" className="mt-4 text-sm font-bold underline" style={{ color: "#6B7480" }}>
          홈으로 가기
        </Link>
      </main>
    );
  }

  // 2026-10-04 4.5: 가입 버튼은 아래 하나(상단 버튼은 높이 830px 이상 화면에서 위·아래가 동시에 보여 두지 않음) — 가입 후 이 페이지로(returnTo) + 파트너 ref 유지. 자동 관심 파라미터 없음
  const memberPriceHref = withReturnTo("/signup", `/p/${params.slug}`, partner.refCode ? `ref=${partner.refCode}` : "");

  return (
    <main className="flex flex-col min-h-screen bg-white">
      <div
        className="px-5 pt-8 pb-7 text-white"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, ${partner.accentColor})`,
          backgroundSize: "16px 16px, cover",
        }}
      >
        <span
          className="inline-block rounded-full font-medium"
          style={{ fontSize: rem(11), color: "rgba(255,255,255,0.65)", padding: "3px 9px", background: "rgba(255,255,255,0.1)" }}
        >
          Powered by 덤핑점핑 × JumpX
        </span>
        <h1 className="font-display mt-3" style={{ fontSize: rem(26), letterSpacing: "-0.02em" }}>
          {partner.name}
        </h1>
        <p className="mt-2.5" style={{ fontSize: rem(14), lineHeight: 1.6, color: "rgba(255,255,255,.88)" }}>
          {partner.tagline}
        </p>
      </div>

      <div className="flex-1 px-5 py-5" style={{ background: "#F5F6F8" }}>
        <div className="text-sm font-bold mb-3" style={{ color: "#0B2540" }}>
          실시간 매물 미리보기
        </div>
        <div className="flex flex-col gap-3">
          {deals.slice(0, PREVIEW_COUNT).map((d) => {
            const color = categoryColors[d.category] ?? categoryColors["기타"];
            const discountPct = cardDiscountPct(d);
            return (
              <div key={d.id} className="bg-white border border-gray200 rounded-2xl overflow-hidden flex" style={{ borderLeft: `5px solid ${color.solid}` }}>
                <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
                  {d.images && d.images.length > 0 ? (
                    <img src={d.images[0]} alt={d.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: color.bg }}>
                      {categoryIcons[d.category] ?? "🗂️"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 px-3.5 py-2.5">
                  <div className="text-sm font-bold truncate" style={{ color: "#0B2540" }}>{d.title}</div>
                  {isNegotiable(d) ? (
                    <div className="mt-1.5"><NegotiablePrice color={color.text} className="text-base" /></div>
                  ) : priceHidden || d.price_hidden ? (
                    <Link href={memberPriceHref} className="inline-block mt-1.5 text-base font-black" style={{ color: color.text }} data-member-price>
                      {memberPriceTeaser(Math.round(discountPct))}
                    </Link>
                  ) : (
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="text-base font-black" style={{ color: color.text }}>{dealPriceLabel(d)}</span>
                      {discountPct > 0 && (
                        <span className="text-xs font-bold rounded-full" style={{ color: partner.accentColor, background: "#fff", border: `1px solid ${partner.accentColor}`, padding: "1px 7px" }}>
                          -{Math.round(discountPct)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Link
          href={memberPriceHref}
          className="w-full block text-center font-bold rounded-2xl text-white mt-6"
          style={{ background: partner.accentColor, padding: "15px 0", fontSize: rem(15) }}
          data-guest-signup-cta
        >
          무료 회원가입하고 가격 보기
        </Link>
        <p className="text-center text-xs mt-3" style={{ color: "#9AA3AD" }}>
          이 페이지는 영업용 데모입니다 · 실제 계약 시 전용 도메인·데이터로 확장됩니다
        </p>
      </div>
    </main>
  );
}
