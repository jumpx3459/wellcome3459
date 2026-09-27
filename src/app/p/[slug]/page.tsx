"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import { formatPrice } from "@/lib/format";
import { getPartner } from "@/lib/partners";

const PREVIEW_COUNT = 4;

// 2026-09-27: 점핑파트너 영업용 데모 스킨. 실제 매물 데이터는 기존 deals 테이블을
// 그대로 읽어오고(별도 DB/도메인 없음), 로고·이름·강조색만 파트너 브랜드로 바꿔
// "당신 브랜드로 운영되는 덤핑점핑"을 미리 보여주는 영업 도구입니다. 바텀탭 등
// 실제 앱 내비게이션은 없는 단일 랜딩 페이지(AppShell에서 /p/ 경로는 바텀탭 제외).
export default function PartnerDemoPage() {
  const params = useParams<{ slug: string }>();
  const partner = getPartner(params.slug);
  const [deals, setDeals] = useState<Deal[]>(mockDeals.filter((d) => d.status !== "closed").slice(0, PREVIEW_COUNT));

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return; // 데모 모드: mockDeals 사용

    (async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, title, deal_price, original_price, total_qty, remaining_qty, quantity_unit, closes_at, location, images, categories(name), regions(name)"
        )
        .eq("status", "active")
        .gt("closes_at", new Date().toISOString())
        .order("closes_at", { ascending: true })
        .limit(PREVIEW_COUNT);

      if (error || !data) return;
      setDeals(
        data.map((d) => {
          const rec = d as unknown as Record<string, unknown>;
          return {
            ...rec,
            category: (rec.categories as { name: string } | null)?.name ?? "기타",
            location: (rec.regions as { name: string } | null)?.name ?? rec.location,
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

  const signupHref = partner.refCode ? `/signup?ref=${partner.refCode}` : "/signup";

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
          style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", padding: "3px 9px", background: "rgba(255,255,255,0.1)" }}
        >
          Powered by 덤핑점핑 × JumpX
        </span>
        <h1 className="font-display mt-3" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
          {partner.name}
        </h1>
        <p className="mt-2.5" style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.88)" }}>
          {partner.tagline}
        </p>
        <Link
          href={signupHref}
          className="inline-flex items-center gap-1.5 mt-5 font-bold rounded-2xl"
          style={{ padding: "13px 22px", fontSize: 15, background: "#fff", color: partner.accentColor }}
        >
          🔔 지금 무료로 알림받기
        </Link>
      </div>

      <div className="flex-1 px-5 py-5" style={{ background: "#F5F6F8" }}>
        <div className="text-sm font-bold mb-3" style={{ color: "#0B2540" }}>
          실시간 매물 미리보기
        </div>
        <div className="flex flex-col gap-3">
          {deals.slice(0, PREVIEW_COUNT).map((d) => {
            const color = categoryColors[d.category] ?? categoryColors["기타"];
            const discountPct = d.original_price ? ((d.original_price - d.deal_price) / d.original_price) * 100 : 0;
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
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-base font-black" style={{ color: color.text }}>{formatPrice(d.deal_price)}</span>
                    {discountPct > 0 && (
                      <span className="text-xs font-bold rounded-full" style={{ color: partner.accentColor, background: "#fff", border: `1px solid ${partner.accentColor}`, padding: "1px 7px" }}>
                        -{Math.round(discountPct)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Link
          href={signupHref}
          className="w-full block text-center font-bold rounded-2xl text-white mt-6"
          style={{ background: partner.accentColor, padding: "15px 0", fontSize: 15 }}
        >
          {partner.name} 알림 무료로 받기
        </Link>
        <p className="text-center text-xs mt-3" style={{ color: "#9AA3AD" }}>
          이 페이지는 영업용 데모입니다 · 실제 계약 시 전용 도메인·데이터로 확장됩니다
        </p>
      </div>
    </main>
  );
}
