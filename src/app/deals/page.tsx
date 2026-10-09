"use client";

import { DEAL_NEW_COLS, isMissingNewColumn, type DealRowLoose } from "@/lib/dealFields";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import TabLink from "@/components/TabLink";
import BusinessFooter from "@/components/BusinessFooter";
import { useSearchParams } from "next/navigation";
import { useCurrentPath } from "@/lib/useCurrentPath";
import { withReturnTo } from "@/lib/safeReturnTo";
import { DealListCardSkeleton, LoadFailNote, useSlowLoad } from "@/components/LoadingCards";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals, mockCategories, mockRegions, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import AdSlot from "@/components/AdSlot";
import SellFab from "@/components/SellFab";
import { fetchHeartCounts } from "@/lib/heartCountClient";

// 2026-10-09 4b-2: 카드 6장마다 넣던 "AD 광고 영역" 자리표시는 화면에서만 숨김(코드·AdSlot은 유지 — 광고 붙일 때 true)
const SHOW_AD_SLOTS = false;
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import { formatDealLocation } from "@/lib/formatDealLocation";
import DealListCard from "@/components/DealListCard";
import { avgDiscountByCategory, hotGapPct, type AvgSampleRow } from "@/lib/categoryAvg";
import { selectWithPriceAccess, dealPriceFields, discountSortKey } from "@/lib/dealPriceAccess";

import { EXAMPLE_DEALS, shouldShowExamples } from "@/lib/exampleDeals";
import { rem } from "@/lib/rem";
import { SECTION_TITLE_STYLE } from "@/components/EcosystemGrid";
import { useBackToClose } from "@/lib/useBackToClose";

// design-v2: 헤더 우측의 "정부지원금" 링크를 마이페이지로 옮기고, 그 자리를
// 이 화면이 다루는 매물 성격을 보여주는 순수 카피 로테이션으로 채움 (클릭 동작 없음).
// 2026-09-26: RotatingUrgencyTag로 추출 — buy/홈/마이페이지/signup에도 동일하게 노출.

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
  // 2026-10-07: 처음 불러오는 동안은 예시(mockDeals) 대신 회색 자리 표시 카드(데모 모드=Supabase 없음은 예시 그대로)
  const [deals, setDeals] = useState<Deal[]>(isSupabaseConfigured ? [] : mockDeals.filter((d) => d.status !== "closed"));
  const [dealsStatus, setDealsStatus] = useState<"loading" | "ok" | "error">(isSupabaseConfigured ? "loading" : "ok");
  const [dealsRetry, setDealsRetry] = useState(0);
  const dealsSlow = useSlowLoad(dealsStatus === "loading", dealsRetry);
  const [closedDeals, setClosedDeals] = useState<Deal[]>(
    mockDeals.filter((d) => d.status === "closed")
  );
  const [closedLoaded, setClosedLoaded] = useState(!isSupabaseConfigured);
  const [activeCat, setActiveCat] = useState<string>(
    initialCat && mockCategories.includes(initialCat) ? initialCat : "전체"
  );
  const [activeRegion, setActiveRegion] = useState<string>("전체");
  const [sort, setSort] = useState<"urgent" | "disc">("urgent");
  // 2026-09-27: native <select>는 접힌 필박스만 커스텀 스타일이 먹고, 펼친 옵션
  // 목록은 브라우저/OS 기본 스타일이 강제돼(웹 표준 한계) 다크 헤더 안에서 흰
  // 목록이 이질적으로 튀어나오는 문제 — 버튼+커스텀 드롭다운 패널로 교체.
  const [catOpen, setCatOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  // 2026-10-01 PR-C: 카테고리·지역 펼침 패널 — 뒤로가기 = 패널만 닫기 (둘 사이 전환은 기록 1개 유지)
  useBackToClose(catOpen || regionOpen, () => {
    setCatOpen(false);
    setRegionOpen(false);
  });
  // 2026-09-28: 빈 결과 화면의 CTA가 로그인 여부와 상관없이 무조건 /signup(신규
  // 가입 위저드)으로 보내던 문제 — 이미 가입된 회원도 다시 가입하라는 셈이라
  // 회원이면 마이페이지 알림 조건으로 보내도록 분기하기 위해 필요.
  const [isMember, setIsMember] = useState(false);
  // 2026-10-03 A안: 가격 없이 받은 목록(비회원)이면 카드 가격 자리에 "회원가 보기" — 조회 전(첫 화면·예시)도 숨김으로 시작
  const [priceHidden, setPriceHidden] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setIsMember(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsMember(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return; // 데모 모드: mockDeals 사용

    let cancelled = false;
    setDealsStatus("loading");
    (async () => {
      try {
      // 2026-10-01 PR-B: 카드에 소비기한 — SQL 전이면 새 컬럼 빼고 다시 조회
      const run = (priceCols: string, extra: string) => supabase!
        .from("deals")
        .select<string, DealRowLoose>(
          `id, title, ${priceCols}, total_qty, remaining_qty, quantity_unit, price_unit, closes_at, location, images, video_url, origin, min_order_qty, interest_count, stock_type, categories(name), regions(name)${extra}`
        )
        .eq("status", "active")
        .gt("closes_at", new Date().toISOString()) // 마감 지난 매물은 애초에 가져오지 않음
        .order("closes_at", { ascending: true });
      const { data, error, priceHidden: hidden } = await selectWithPriceAccess(async (cols) => {
        const r = await run(cols, DEAL_NEW_COLS);
        return isMissingNewColumn(r.error) ? run(cols, "") : r;
      });

      if (cancelled) return;
      if (error || !data) {
        setDealsStatus("error");
        return;
      }
      if (data) {
        setPriceHidden(hidden);
        // 2026-10-09 PR 4a: 공개 하트 수(deal_heart_counts) — 실패하면 빈 값(하트 안 그림)
        const hearts = await fetchHeartCounts(data.map((d) => d.id as string));
        if (cancelled) return;
        setDeals(
          data.map((d) => ({
            id: d.id,
            title: d.title,
            category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
            region: (d.regions as unknown as { name: string } | null)?.name ?? "",
            location: formatDealLocation(((d.regions as unknown) as { name: string } | null)?.name, d.location),
            stock_type: d.stock_type ?? "general",
            ...dealPriceFields(d, hidden),
            total_qty: d.total_qty,
            remaining_qty: d.remaining_qty,
            quantity_unit: d.quantity_unit ?? "개",
            price_unit: d.price_unit ?? null,
            closes_at: d.closes_at,
            images: d.images ?? [],
            video_url: d.video_url ?? null,
            origin: d.origin ?? null,
            min_order_qty: d.min_order_qty ?? null,
            storage_type: d.storage_type ?? null,
            expiry_date: d.expiry_date ?? null,
            interest_count: d.interest_count ?? 0,
            heart_count: hearts[d.id as string],
          }))
        );
        setDealsStatus("ok");
      }
      } catch {
        if (!cancelled) setDealsStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealsRetry]);

  // "지난 매물" 탭을 처음 열 때만 조회 (기본 탭에서 불필요한 요청을 안 하도록)
  useEffect(() => {
    if (view !== "closed" || closedLoaded || !isSupabaseConfigured || !supabase) return;

    (async () => {
      // 2026-10-01 PR-B: 카드에 소비기한 — SQL 전이면 새 컬럼 빼고 다시 조회
      const run = (priceCols: string, extra: string) => supabase!
        .from("deals")
        .select<string, DealRowLoose>(
          `id, title, ${priceCols}, total_qty, remaining_qty, quantity_unit, price_unit, closes_at, location, images, video_url, origin, min_order_qty, interest_count, stock_type, categories(name), regions(name)${extra}`
        )
        .or(`status.eq.closed,closes_at.lte.${new Date().toISOString()}`)
        .order("closes_at", { ascending: false })
        .limit(30);
      const { data, error, priceHidden: hidden } = await selectWithPriceAccess(async (cols) => {
        const r = await run(cols, DEAL_NEW_COLS);
        return isMissingNewColumn(r.error) ? run(cols, "") : r;
      });

      if (!error && data) {
        setClosedDeals(
          data.map((d) => ({
            id: d.id,
            title: d.title,
            category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
            region: (d.regions as unknown as { name: string } | null)?.name ?? "",
            location: formatDealLocation(((d.regions as unknown) as { name: string } | null)?.name, d.location),
            stock_type: d.stock_type ?? "general",
            ...dealPriceFields(d, hidden),
            total_qty: d.total_qty,
            remaining_qty: d.remaining_qty,
            quantity_unit: d.quantity_unit ?? "개",
            price_unit: d.price_unit ?? null,
            closes_at: d.closes_at,
            images: d.images ?? [],
            video_url: d.video_url ?? null,
            origin: d.origin ?? null,
            min_order_qty: d.min_order_qty ?? null,
            storage_type: d.storage_type ?? null,
            expiry_date: d.expiry_date ?? null,
            status: "closed",
          }))
        );
      }
      setClosedLoaded(true);
    })();
  }, [view, closedLoaded]);

  // "평균보다 더 저렴" 배지 표본 — 진행 중 + 최근 30일 등록 매물 (기준은 src/lib/categoryAvg.ts)
  const [avgSamples, setAvgSamples] = useState<AvgSampleRow[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return; // 데모 모드: 표본 없음 → 배지 안 뜸
    (async () => {
      const nowIso = new Date().toISOString();
      const since = new Date(Date.now() - 30 * 24 * 3600e3).toISOString();
      // 2026-10-03 A안: 비회원은 가격 대신 discount_pct로 평균 (src/lib/categoryAvg.ts)
      const { data, error, priceHidden: hidden } = await selectWithPriceAccess((cols) =>
        supabase!
          .from("deals")
          .select<string, DealRowLoose>(`title, ${cols}, status, closes_at, created_at, categories(name)`)
          .or(`created_at.gte.${since},and(status.eq.active,closes_at.gt.${nowIso})`)
          .limit(1000)
      );
      if (!error && data) {
        setAvgSamples(
          data.map((d) => ({
            category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
            title: d.title,
            ...(hidden
              ? { original_price: null, deal_price: null, discount_pct: d.discount_pct ?? null }
              : { original_price: d.original_price, deal_price: d.deal_price }),
            status: d.status,
            closes_at: d.closes_at,
            created_at: d.created_at,
          }))
        );
      }
    })();
  }, []);

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
    return discountSortKey(b) - discountSortKey(a);
  });

  const activeSettled = view !== "active" || dealsStatus === "ok";
  const showExamples = view === "active" && activeSettled && shouldShowExamples(filtered.length, isSupabaseConfigured);

  // 카테고리 평균 할인율 — 표본 10건 이상인 카테고리만 (미달이면 배지 숨김)
  const avgDiscount = now ? avgDiscountByCategory(avgSamples, now) : {};

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-5 pb-3 text-white"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <TabLink href="/" className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto" />
          </TabLink>
          <span
            className="rounded-full font-medium"
            style={{ fontSize: rem(11), color: "rgba(255,255,255,0.6)", padding: "3px 9px", background: "rgba(255,255,255,0.08)" }}
          >
            Powered by JumpX
          </span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-y-1.5">
          <div className="text-xs font-bold tracking-widest whitespace-nowrap" style={{ color: "#FFD166" }}>
            오늘의 덤핑 매물
          </div>
          <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
        </div>
        <h1 className="font-display text-2xl mt-1.5">
          {view === "active" ? "지금 놓치면 마감" : "지난 마감 매물"}
        </h1>

        <div className="flex gap-5 mt-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.16)" }}>
          <button
            onClick={() => setView("active")}
            className="text-sm font-bold pb-2"
            style={{
              color: view === "active" ? "#fff" : "rgba(255,255,255,0.5)",
              borderBottom: view === "active" ? "2px solid #fff" : "2px solid transparent",
            }}
          >
            진행중
          </button>
          <button
            onClick={() => setView("closed")}
            className="text-sm font-bold pb-2"
            style={{
              color: view === "closed" ? "#fff" : "rgba(255,255,255,0.5)",
              borderBottom: view === "closed" ? "2px solid #fff" : "2px solid transparent",
            }}
          >
            지난 매물
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                setCatOpen((v) => !v);
                setRegionOpen(false);
              }}
              className="w-full flex items-center justify-between gap-1 text-sm font-bold rounded-full"
              style={{
                padding: "7px 12px",
                background: "rgba(255,255,255,0.12)",
                color: activeCat === "전체" ? "rgba(255,255,255,0.75)" : "#FFD166",
              }}
            >
              <span className="truncate">
                {activeCat === "전체" ? "🗃️ 전체 카테고리" : `${categoryIcons[activeCat] ?? "🗂️"} ${activeCat}`}
              </span>
              <span className="flex-shrink-0" style={{ fontSize: rem(10) }}>{catOpen ? "▴" : "▾"}</span>
            </button>
            {catOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-lg z-50" style={{ padding: 8 }}>
                <div className="grid grid-cols-2 gap-1.5 overflow-y-auto" style={{ maxHeight: 280 }}>
                  {["전체", ...mockCategories].map((c) => {
                    const picked = activeCat === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setActiveCat(c);
                          setCatOpen(false);
                        }}
                        className="text-left rounded-xl"
                        style={{
                          padding: "9px 10px",
                          fontSize: rem(12.5),
                          fontWeight: 700,
                          lineHeight: 1.25,
                          background: picked ? "#FFF1E7" : "#fff",
                          border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                          color: "#1A1F26",
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                setRegionOpen((v) => !v);
                setCatOpen(false);
              }}
              className="w-full flex items-center justify-between gap-1 text-sm font-bold rounded-full"
              style={{
                padding: "7px 12px",
                background: "rgba(255,255,255,0.12)",
                color: activeRegion === "전체" ? "rgba(255,255,255,0.75)" : "#FFD166",
              }}
            >
              <span className="truncate">{activeRegion === "전체" ? "전 지역" : activeRegion}</span>
              <span className="flex-shrink-0" style={{ fontSize: rem(10) }}>{regionOpen ? "▴" : "▾"}</span>
            </button>
            {regionOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-lg z-50" style={{ padding: 8 }}>
                <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 280 }}>
                  {["전체", ...mockRegions].map((r) => {
                    const picked = activeRegion === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setActiveRegion(r);
                          setRegionOpen(false);
                        }}
                        className="text-left rounded-lg"
                        style={{
                          padding: "9px 10px",
                          fontSize: rem(13.5),
                          fontWeight: 700,
                          background: picked ? "#FFF1E7" : "#fff",
                          color: picked ? "#E25100" : "#1A1F26",
                        }}
                      >
                        {r === "전체" ? "전 지역" : r}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {(catOpen || regionOpen) && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setCatOpen(false);
              setRegionOpen(false);
            }}
          />
        )}
      </div>

      <div className="flex-1 bg-gray100 px-4 py-3.5 flex flex-col gap-3">
        <Link
          href="/sell"
          className="flex items-center justify-between rounded-xl"
          style={{ background: "#FF6F0F", padding: "12px 16px", boxShadow: "0 2px 10px rgba(255,111,15,0.35)" }}
        >
          <span className="text-sm font-bold text-white">📦 나도 긴급 매물 등록하기</span>
          <span
            className="text-xs font-bold text-white rounded-full flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px" }}
          >
            무료 등록 →
          </span>
        </Link>

        {filtered.length > 0 && activeSettled && (
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
        {view === "active" && !activeSettled && (
          dealsStatus === "error" || dealsSlow ? (
            <LoadFailNote onRetry={() => setDealsRetry((n) => n + 1)} />
          ) : (
            <>
              <DealListCardSkeleton />
              <DealListCardSkeleton />
              <DealListCardSkeleton />
              <DealListCardSkeleton />
            </>
          )
        )}
        {filtered.length === 0 && activeSettled && (
          view === "active" ? (
            <EmptyState category={activeCat} region={activeRegion} isMember={isMember} />
          ) : (
            <div className="text-center text-gray500 text-base py-10">아직 마감된 매물이 없어요.</div>
          )
        )}
        {activeSettled && filtered.flatMap((d, idx) => {
          const isClosed = view === "closed";
          const card = (
            <DealListCard
              key={d.id}
              deal={d}
              closed={isClosed}
              priceHidden={d.price_hidden ?? priceHidden}
              hotGapPct={isClosed ? null : hotGapPct(d, avgDiscount)}
              eager={idx === 0}
            />
          );

          return SHOW_AD_SLOTS && (idx + 1) % 6 === 0
            ? [card, <AdSlot key={`ad-${d.id}`} />]
            : [card];
        })}

        {showExamples && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2">
              <span style={SECTION_TITLE_STYLE}>💡 이런 매물이 올라와요</span>
              <span className="flex-1" style={{ height: 1, background: "#E4E7EB" }} />
              <span className="text-xs font-bold rounded-full" style={{ padding: "2px 8px", background: "#E9ECEF", color: "#495057" }}>예시</span>
            </div>
            <div className="flex flex-col gap-3">
              {EXAMPLE_DEALS.map((d) => (
                <DealListCard key={`example-${d.id}`} deal={d} example priceHidden={priceHidden} />
              ))}
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "#9AA3AD" }}>
              실제 매물이 아닌 예시예요 · 매물이 계속 등록되고 있어요
            </p>
          </div>
        )}

        <a href="/unsubscribe" className="text-center text-xs text-gray500 underline mt-2 mb-4 py-2">
          알림이 필요 없으신가요? 알림 해지 · 탈퇴
        </a>
        <BusinessFooter className="-mx-4 -mb-3.5 mt-2" />
      </div>
      {/* 2026-10-09 4b-2: 떠 있는 "＋ 매물 등록" — 마지막 내용이 가리지 않게 맨 아래 90px */}
      <div aria-hidden style={{ height: 90 }} />
      <SellFab />
    </main>
  );
}

// 매물이 없을 때 허전해 보이지 않도록, 점핑매니저 일러스트 + 선택된 카테고리에 맞춘 문구를 보여줍니다.
function EmptyState({
  category,
  region,
  isMember,
}: {
  category: string;
  region: string;
  isMember: boolean;
}) {
  const isAll = category === "전체";
  const currentPath = useCurrentPath(); // 가입 후 이 목록으로 복귀
  // "전체"는 가장 흔한 기본 상태인데 categoryColors["기타"]의 회색(#8A8A82)을 그대로
  // 쓰면 정작 가장 많이 보이는 CTA가 제일 흐릿해짐 — 배경/뱃지는 기타 톤 유지하되
  // CTA 버튼 색만 브랜드 주황으로 분리.
  const color = isAll ? categoryColors["기타"] : categoryColors[category];
  const ctaColor = isAll ? "var(--color-brandOrange)" : color.solid;
  const icon = isAll ? "🔍" : categoryIcons[category];
  const regionText = region === "전체" ? "" : ` · ${region}`;

  return (
    <div
      className="rounded-2xl px-5 pt-6 pb-5 flex flex-col items-center text-center mt-2"
      style={{ background: color.bg }}
    >
      {/* 2026-09-27: manager.png는 불투명 흰 배경이 박혀있어 카드의 틴트 배경(color.bg)
          위에서 흰 사각형이 그대로 보이는 문제 — 투명 컷아웃(manager-cut.png)으로 교체. */}
      <img src="/images/manager-cut.png" alt="점핑매니저" className="w-32 h-32 object-contain -mb-1" />

      <div
        className="mt-1 mb-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-white"
        style={{ color: color.text }}
      >
        <span>{icon}</span>
        {isAll ? "전체 카테고리" : category}
        {regionText}
      </div>

      <div className="font-bold text-navy text-base leading-relaxed">
        {isAll ? (
          <>
            지금은 조건에 맞는{" "}
            <br className="hidden sm:inline" />
            덤핑 매물이 없어요.
          </>
        ) : (
          `아직 ${category} 카테고리엔 좋은 매물이 없어요.`
        )}
      </div>
      <p className="text-sm text-gray500 mt-1.5 leading-relaxed">
        점핑매니저가 매물을 찾는 대로 가장 먼저 알림으로 알려드릴게요!
      </p>

      {/* 2026-09-28: 로그인 여부와 상관없이 무조건 /signup(신규 가입)으로 보내던
          버그 — 이미 가입된 회원이면 다시 가입하라는 셈이라 혼란스러웠음. 회원은
          마이페이지 "내 알림 조건"(#alerts)으로, 비회원만 지금처럼 강조된
          가입 유도 버튼을 보게 분기. 회원용은 위계를 낮춘 톤(연한 배경)으로. */}
      {isMember ? (
        <TabLink
          href="/mypage#alerts"
          className="mt-4 text-sm font-bold rounded-xl px-5 py-2.5"
          style={{ background: "#F5F6F8", color: "#6B7480" }}
        >
          내 조건 보기 ›
        </TabLink>
      ) : (
        <Link
          href={withReturnTo("/signup", currentPath)}
          className="mt-4 text-sm font-bold text-white rounded-xl px-5 py-2.5"
          style={{ background: ctaColor }}
        >
          {isAll ? "전체" : category} 알림 받기
        </Link>
      )}
    </div>
  );
}
