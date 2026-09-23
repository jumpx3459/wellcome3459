"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals, mockCategories, mockRegions, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import CountdownBadge from "@/components/CountdownBadge";
import AdSlot from "@/components/AdSlot";
import { formatPrice } from "@/lib/format";

const DEALS_EXAMPLE_THRESHOLD = 5;
const EXAMPLE_DEALS = mockDeals.filter((d) => d.status !== "closed").slice(0, 4);

export default function DealsPage() {
  return (
    <Suspense fallback={null}>
      <DealsPageInner />
    </Suspense>
  );
}

function DealsPageInner() {
  const searchParams = useSearchParams();
  const initialCat = searchParams.get("category");
  const [view, setView] = useState<"active" | "closed">("active");
  const [deals, setDeals] = useState<Deal[]>(mockDeals.filter((d) => d.status !== "closed"));
  const [closedDeals, setClosedDeals] = useState<Deal[]>(
    mockDeals.filter((d) => d.status === "closed")
  );
  const [closedLoaded, setClosedLoaded] = useState(!isSupabaseConfigured);
  const [activeCat, setActiveCat] = useState<string>(
    initialCat && mockCategories.includes(initialCat) ? initialCat : "전체"
  );
  const [activeRegion, setActiveRegion] = useState<string>("전체");
  const [sort, setSort] = useState<"urgent" | "disc">("urgent");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return; // 데모 모드: mockDeals 사용

    (async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, title, deal_price, original_price, total_qty, remaining_qty, quantity_unit, closes_at, location, images, video_url, categories(name), regions(name)"
        )
        .eq("status", "active")
        .gt("closes_at", new Date().toISOString()) // 마감 지난 매물은 애초에 가져오지 않음
        .order("closes_at", { ascending: true });

      if (!error && data) {
        setDeals(
          data.map((d) => ({
            id: d.id,
            title: d.title,
            category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
            region: (d.regions as unknown as { name: string } | null)?.name ?? "",
            location: d.location ?? "",
            original_price: d.original_price,
            deal_price: d.deal_price,
            total_qty: d.total_qty,
            remaining_qty: d.remaining_qty,
            quantity_unit: d.quantity_unit ?? "개",
            closes_at: d.closes_at,
            images: d.images ?? [],
            video_url: d.video_url ?? null,
          }))
        );
      }
    })();
  }, []);

  // "지난 매물" 탭을 처음 열 때만 조회 (기본 탭에서 불필요한 요청을 안 하도록)
  useEffect(() => {
    if (view !== "closed" || closedLoaded || !isSupabaseConfigured || !supabase) return;

    (async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, title, deal_price, original_price, total_qty, remaining_qty, quantity_unit, closes_at, location, images, video_url, categories(name), regions(name)"
        )
        .or(`status.eq.closed,closes_at.lte.${new Date().toISOString()}`)
        .order("closes_at", { ascending: false })
        .limit(30);

      if (!error && data) {
        setClosedDeals(
          data.map((d) => ({
            id: d.id,
            title: d.title,
            category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
            region: (d.regions as unknown as { name: string } | null)?.name ?? "",
            location: d.location ?? "",
            original_price: d.original_price,
            deal_price: d.deal_price,
            total_qty: d.total_qty,
            remaining_qty: d.remaining_qty,
            quantity_unit: d.quantity_unit ?? "개",
            closes_at: d.closes_at,
            images: d.images ?? [],
            video_url: d.video_url ?? null,
            status: "closed",
          }))
        );
      }
      setClosedLoaded(true);
    })();
  }, [view, closedLoaded]);

  // 서버와 클라이언트의 렌더링 시각 차이로 하이드레이션이 어긋나지 않도록,
  // 처음에는 0으로 시작해 아무 매물도 필터링되지 않게 하고 마운트 이후 실제 시각을 채웁니다.
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const notExpired = deals.filter((d) => new Date(d.closes_at).getTime() > now);
  const sourceList = view === "active" ? notExpired : closedDeals;
  const byCategory = activeCat === "전체" ? sourceList : sourceList.filter((d) => d.category === activeCat);
  const byRegion = activeRegion === "전체" ? byCategory : byCategory.filter((d) => d.region === activeRegion);
  const filtered = [...byRegion].sort((a, b) => {
    if (sort === "urgent") return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
    const discA = a.original_price ? (a.original_price - a.deal_price) / a.original_price : 0;
    const discB = b.original_price ? (b.original_price - b.deal_price) / b.original_price : 0;
    return discB - discA;
  });

  const showExamples = isSupabaseConfigured && view === "active" && filtered.length < DEALS_EXAMPLE_THRESHOLD;

  // 카테고리별 평균 할인율 — 특정 매물이 같은 카테고리 평균보다 눈에 띄게 저렴하면 배지로 알려줍니다.
  const avgDiscountByCategory: Record<string, number> = {};
  {
    const sums: Record<string, { total: number; count: number }> = {};
    notExpired.forEach((d) => {
      if (!d.original_price) return;
      const disc = ((d.original_price - d.deal_price) / d.original_price) * 100;
      sums[d.category] ??= { total: 0, count: 0 };
      sums[d.category].total += disc;
      sums[d.category].count += 1;
    });
    Object.entries(sums).forEach(([cat, { total, count }]) => {
      if (count >= 2) avgDiscountByCategory[cat] = total / count; // 표본 2개 이상일 때만 의미있는 비교
    });
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-5 pb-3 text-white"
        style={{ background: "linear-gradient(120deg, #04101C, #1A4B78)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Link href="/" className="bg-white rounded-lg px-3 py-2 inline-block">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
          </Link>
          <span className="text-white/70 text-sm tracking-wide">Powered by JumpX</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-y-1.5">
          <div className="text-xs font-bold tracking-widest whitespace-nowrap" style={{ color: "#FFD166" }}>
            오늘의 덤핑 매물
          </div>
          <Link href="/support" className="text-sm font-bold py-2 -my-2 whitespace-nowrap" style={{ color: "var(--color-brandOrangeAccent)" }}>
            🏛️ 정부지원금
          </Link>
        </div>
        <h1 className="font-display text-2xl mt-1.5">
          {view === "active" ? "지금 놓치면 마감" : "지난 마감 매물"}
        </h1>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setView("active")}
            className="flex-1 text-sm py-2 rounded-lg font-bold"
            style={
              view === "active"
                ? { background: "#fff", color: "#0B2540" }
                : { background: "rgba(255,255,255,0.2)", color: "#fff" }
            }
          >
            진행중
          </button>
          <button
            onClick={() => setView("closed")}
            className="flex-1 text-sm py-2 rounded-lg font-bold"
            style={
              view === "closed"
                ? { background: "#fff", color: "#0B2540" }
                : { background: "rgba(255,255,255,0.2)", color: "#fff" }
            }
          >
            지난 매물
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          <div className="relative flex-1 min-w-0">
            <select
              value={activeCat}
              onChange={(e) => setActiveCat(e.target.value)}
              className="w-full text-sm font-bold rounded-full appearance-none outline-none"
              style={{
                padding: "10px 30px 10px 14px",
                background: activeCat === "전체" ? "#fff" : "rgba(255,255,255,0.22)",
                color: activeCat === "전체" ? "#0B2540" : "#fff",
              }}
            >
              <option value="전체">🗃️ 전체 카테고리</option>
              {mockCategories.map((c) => (
                <option key={c} value={c}>{categoryIcons[c]} {c}</option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: activeCat === "전체" ? "#6B7480" : "#fff" }}
            >
              ▾
            </span>
          </div>
          <div className="relative flex-1 min-w-0">
            <select
              value={activeRegion}
              onChange={(e) => setActiveRegion(e.target.value)}
              className="w-full text-sm font-bold rounded-full appearance-none outline-none"
              style={{
                padding: "10px 30px 10px 14px",
                background: activeRegion === "전체" ? "#fff" : "rgba(255,255,255,0.22)",
                color: activeRegion === "전체" ? "#0B2540" : "#fff",
              }}
            >
              <option value="전체">전 지역</option>
              {mockRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: activeRegion === "전체" ? "#6B7480" : "#fff" }}
            >
              ▾
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray100 px-4 py-3.5 flex flex-col gap-3">
        <Link
          href="/sell"
          className="flex items-center justify-between rounded-xl"
          style={{ background: "rgba(255,111,15,0.10)", border: "1.5px solid #FF6F0F", padding: "11px 16px" }}
        >
          <span className="text-sm font-bold text-navy">📦 나도 긴급 매물 등록하기</span>
          <span className="text-sm font-bold" style={{ color: "#FF6F0F" }}>무료 등록 →</span>
        </Link>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray500">{filtered.length}건</span>
            <button
              onClick={() => setSort(sort === "urgent" ? "disc" : "urgent")}
              className="text-xs font-bold text-navy bg-white border border-gray200 rounded-full px-3 py-1.5"
            >
              {sort === "urgent" ? "마감 임박순" : "할인율순"} ⇅
            </button>
          </div>
        )}
        {filtered.length === 0 && (
          view === "active" ? (
            <EmptyState category={activeCat} region={activeRegion} />
          ) : (
            <div className="text-center text-gray500 text-base py-10">아직 마감된 매물이 없어요.</div>
          )
        )}
        {filtered.flatMap((d, idx) => {
          const remainPct = Math.round((d.remaining_qty / d.total_qty) * 100);
          const color = categoryColors[d.category] ?? categoryColors["기타"];
          const isClosed = view === "closed";

          const discountPct = d.original_price
            ? ((d.original_price - d.deal_price) / d.original_price) * 100
            : 0;
          const avgDiscount = avgDiscountByCategory[d.category];
          const gapVsAvg = avgDiscount !== undefined ? discountPct - avgDiscount : 0;
          const showHotBadge = !isClosed && avgDiscount !== undefined && gapVsAvg >= 8;

          const card = (
            <Link
              key={d.id}
              href={`/deals/${d.id}`}
              className="bg-white border border-gray200 rounded-2xl px-4 py-4 flex gap-3 relative overflow-hidden"
              style={{ borderLeft: `5px solid ${isClosed ? "#C7CBD1" : color.solid}`, opacity: isClosed ? 0.85 : 1 }}
            >
              {d.images && d.images.length > 0 ? (
                <img
                  src={d.images[0]}
                  alt={d.title}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  style={{ filter: isClosed ? "grayscale(40%)" : "none" }}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: isClosed ? "#F1F1EF" : color.bg }}
                >
                  {categoryIcons[d.category] ?? "🗂️"}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full min-w-0"
                    style={{ background: isClosed ? "#F1F1EF" : color.bg, color: isClosed ? "#6B7480" : color.text }}
                  >
                    <span className="text-sm flex-shrink-0">{categoryIcons[d.category] ?? "🗂️"}</span>
                    <span className="truncate">{d.category}</span>
                  </div>
                  {isClosed ? (
                    <span className="text-xs font-bold text-white bg-gray500 px-2.5 py-1.5 rounded-full flex-shrink-0">
                      마감됨
                    </span>
                  ) : (
                    <div className="flex-shrink-0">
                      <CountdownBadge closesAt={d.closes_at} />
                    </div>
                  )}
                </div>
                <div className="text-base font-bold text-gray900 mt-2">{d.title}</div>
                <div className="text-sm text-gray500 mt-1">
                  {isClosed
                    ? d.location
                    : `잔여 ${d.remaining_qty}${d.quantity_unit || "개"} · ${d.location}`}
                </div>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-sm text-gray500 font-normal line-through">
                    {formatPrice(d.original_price)}
                  </span>
                  <span className="text-lg font-black" style={{ color: isClosed ? "#6B7480" : "#0B2540" }}>
                    {formatPrice(d.deal_price)}
                  </span>
                  {!isClosed && discountPct > 0 && (
                    <span className="text-sm font-black" style={{ color: "#E25100" }}>
                      -{Math.round(discountPct)}%
                    </span>
                  )}
                </div>
                {showHotBadge && (
                  <div
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mt-1.5"
                    style={{ background: "#FDEEE8", color: "#C2410C" }}
                  >
                    🔥 {d.category} 평균보다 {Math.round(gapVsAvg)}%p 더 저렴
                  </div>
                )}
                {!isClosed && (
                  <div className="mt-2.5">
                    <div className="h-[7px] bg-gray200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${remainPct}%`, background: color.solid }}
                      />
                    </div>
                    <div className="text-sm font-bold mt-1.5" style={{ color: color.text }}>
                      재고 {remainPct}% 남음{remainPct < 30 ? " · 서두르세요" : ""}
                    </div>
                  </div>
                )}
                {isClosed && (
                  <div className="text-sm text-gray500 mt-2">
                    {new Date(d.closes_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 마감
                  </div>
                )}
              </div>
            </Link>
          );

          return (idx + 1) % 6 === 0
            ? [card, <AdSlot key={`ad-${d.id}`} />]
            : [card];
        })}

        {showExamples && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray500">이런 매물이 올라와요</span>
              <span className="flex-1" style={{ height: 1, background: "#E4E7EB" }} />
              <span className="text-[10px] font-bold text-gray500 bg-white border border-gray200 rounded-full" style={{ padding: "2px 7px" }}>예시</span>
            </div>
            <div className="flex flex-col gap-3">
              {EXAMPLE_DEALS.map((d) => {
                const color = categoryColors[d.category] ?? categoryColors["기타"];
                return (
                  <Link key={`example-${d.id}`} href={`/deals/example-${d.id}`} className="bg-white border border-dashed border-gray200 rounded-2xl px-4 py-4 flex gap-3" style={{ opacity: 0.8 }}>
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: color.bg }}>
                      {categoryIcons[d.category] ?? "🗂️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#F1F1EF", color: "#6B7480" }}>
                        예시 · {d.category}
                      </div>
                      <div className="text-base font-bold text-gray900 mt-2">{d.title}</div>
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-sm text-gray500 font-normal line-through">{formatPrice(d.original_price)}</span>
                        <span className="text-lg font-black" style={{ color: "#6B7480" }}>{formatPrice(d.deal_price)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "#9AA3AD" }}>
              실제 매물이 아닌 예시예요 · 매물이 계속 등록되고 있어요
            </p>
          </div>
        )}

        <a href="/unsubscribe" className="text-center text-xs text-gray500 underline mt-2 mb-4 py-2">
          알림이 필요 없으신가요? 알림 해지 · 탈퇴
        </a>
      </div>
    </main>
  );
}

// 매물이 없을 때 허전해 보이지 않도록, 점핑매니저 일러스트 + 선택된 카테고리에 맞춘 문구를 보여줍니다.
function EmptyState({ category, region }: { category: string; region: string }) {
  const isAll = category === "전체";
  const color = isAll ? categoryColors["기타"] : categoryColors[category];
  const icon = isAll ? "🔍" : categoryIcons[category];
  const regionText = region === "전체" ? "" : ` · ${region}`;

  return (
    <div
      className="rounded-2xl px-5 pt-6 pb-5 flex flex-col items-center text-center mt-2"
      style={{ background: color.bg }}
    >
      <img src="/images/manager.png" alt="점핑매니저" className="w-32 h-32 object-contain -mb-1" />

      <div
        className="mt-1 mb-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-white"
        style={{ color: color.text }}
      >
        <span>{icon}</span>
        {isAll ? "전체 카테고리" : category}
        {regionText}
      </div>

      <div className="font-bold text-navy text-base leading-relaxed">
        {isAll
          ? "지금은 조건에 맞는 덤핑 매물이 없어요."
          : `아직 ${category} 카테고리엔 좋은 매물이 없어요.`}
      </div>
      <p className="text-sm text-gray500 mt-1.5 leading-relaxed">
        점핑매니저가 매물을 찾는 대로 가장 먼저 알림으로 알려드릴게요!
      </p>

      <Link
        href="/signup"
        className="mt-4 text-sm font-bold text-white rounded-xl px-5 py-2.5"
        style={{ background: color.solid }}
      >
        {isAll ? "전체" : category} 알림 받기
      </Link>
    </div>
  );
}
