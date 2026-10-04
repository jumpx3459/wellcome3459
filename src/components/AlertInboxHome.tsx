"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TabLink from "@/components/TabLink";
import BusinessFooter from "@/components/BusinessFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals, mockRegions, type Deal } from "@/lib/mockData";
import { formatPrice, formatDealPrice } from "@/lib/format";
import { formatCountdown } from "@/lib/format";
import InstallAppButton, { useInstallPrompt } from "@/components/InstallAppButton";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import { formatDealLocation } from "@/lib/formatDealLocation";
import NoPhotoPlaceholder from "@/components/NoPhotoPlaceholder";
import { matchesConditions } from "@/lib/dealMatching";
import { EXAMPLE_DEALS, shouldShowExamples } from "@/lib/exampleDeals";
import { rem } from "@/lib/rem";
import StockTypeBadge from "@/components/StockTypeBadge";
import DealCardMedia from "@/components/DealCardMedia";
import MemberPriceTeaser from "@/components/MemberPriceTeaser";
import { selectWithPriceAccess, dealPriceFields, cardDiscountPct } from "@/lib/dealPriceAccess";
import { dealPriceLabel, isNegotiable } from "@/lib/priceMode";
import NegotiablePrice from "@/components/NegotiablePrice";
import type { DealRowLoose } from "@/lib/dealFields";
import { SECTION_TITLE_STYLE } from "@/components/EcosystemGrid";
import { isLumpSum } from "@/lib/priceUnit";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { useBackToClose } from "@/lib/useBackToClose";

// 헤더(점핑매니저 안내줄)의 실측 높이 — 아래 콘텐츠의 paddingTop 보정에 사용.
// 2026-09-26 로컬 Playwright 실측 77.3px(360/390/430px 폭 동일) → 78로 올림.
// 2026-09-26 (8) 타이틀 15.5px→20px로 키우며 재실측 83px(360/390/430px 폭 동일,
// Playwright headless Chromium) → 그대로 반영.
// 헤더 문구/폰트를 바꾸면 다시 재야 함. 원래 있던 헤더-콘텐츠 간격 14px은 별도로 더함.
const INBOX_HEADER_HEIGHT = 83;
const INBOX_HEADER_GAP = 14;

const INSTALL_DISMISS_KEY = "dj_home_install_dismissed";
// 2026-09-28: 회원 홈 = 내 조건에 맞는 진행 중 매물만 (전체는 /deals). 매칭 규칙은 푸시 발송과
// 같은 matchesConditions (src/lib/dealMatching.ts). 한 번에 가져오는 최대 건수.
const INBOX_LIMIT = 50;

type FeedGroup = { label: string; items: Deal[] };

// 실제 등록 시각 기준 시간대 버킷 — Claude Design 원안은 고정 개수로
// 슬라이스했지만(데모 데이터 8건 한정), 실제 데이터는 건수가 들쭉날쭉해서
// created_at 기준 진짜 시간 구간으로 나눈다.
function bucketDeals(deals: Deal[]): FeedGroup[] {
  const buckets: Record<string, Deal[]> = { "오늘 · 방금": [], "오늘": [], "어제": [], "이전": [] };
  for (const d of deals) {
    if (!d.created_at) {
      buckets["이전"].push(d);
      continue;
    }
    const hours = (Date.now() - new Date(d.created_at).getTime()) / 3600000;
    if (hours < 3) buckets["오늘 · 방금"].push(d);
    else if (hours < 24) buckets["오늘"].push(d);
    else if (hours < 48) buckets["어제"].push(d);
    else buckets["이전"].push(d);
  }
  return Object.entries(buckets)
    .map(([label, items]) => ({ label, items }))
    .filter((g) => g.items.length > 0);
}

export default function AlertInboxHome({ logoAnimate = false }: { logoAnimate?: boolean }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [outsideCount, setOutsideCount] = useState(0); // 내 조건 밖 진행 중 매물 수
  const [showInstall, setShowInstall] = useState(true);
  const { canInstall, promptInstall, hasNativePrompt } = useInstallPrompt();
  const [, setTick] = useState(0);
  useEffect(() => {
    try {
      setShowInstall(localStorage.getItem(INSTALL_DISMISS_KEY) !== "1");
    } catch {}
  }, []);

  // 마감 카운트다운 실시간 갱신
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setDeals(mockDeals.filter((d) => d.status !== "closed"));
      setLoaded(true);
      return;
    }
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setLoaded(true);
        return;
      }

      const [{ data: catRows }, { data: regRows }] = await Promise.all([
        supabase.from("member_categories").select("category_id, categories(name)").eq("member_id", userId),
        supabase.from("member_regions").select("region_id, regions(name)").eq("member_id", userId),
      ]);
      const catIds = (catRows ?? []).map((r) => r.category_id as number);
      const regIds = (regRows ?? []).map((r) => r.region_id as number);
      const nowIso = new Date().toISOString();

      // 전체 진행 중 매물 수(내 조건 밖 개수 계산용)와, 조건 매칭 매물을 DB에서 바로 걸러 조회.
      // 카테고리를 하나도 안 고른 회원은 매칭 매물이 없음(푸시도 안 감) — 조회 생략.
      const totalQuery = supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gt("closes_at", nowIso);
      // 2026-10-03 A안: 회원 요청이 42501(가격 칸 권한 없음 — 세션이 요청 시점에 사라진 경우 등)이면 가격 없이 한 번 더 (src/lib/dealPriceAccess.ts)
      const matchQuery = (cols: string) => {
        let q = supabase!
          .from("deals")
          .select<string, DealRowLoose>(
            `id, title, ${cols}, total_qty, remaining_qty, quantity_unit, price_unit, closes_at, created_at, location, images, video_url, origin, min_order_qty, category_id, region_id, stock_type, categories(name), regions(name)`,
            { count: "exact" }
          )
          .eq("status", "active")
          .gt("closes_at", nowIso)
          .in("category_id", catIds)
          .order("created_at", { ascending: false })
          .limit(INBOX_LIMIT);
        if (regIds.length > 0) q = q.in("region_id", regIds);
        return q;
      };
      const [{ count: totalCount }, matchRes] = await Promise.all([
        totalQuery,
        catIds.length > 0
          ? selectWithPriceAccess(matchQuery)
          : Promise.resolve({ data: [] as DealRowLoose[], count: 0, priceHidden: false }),
      ]);
      // DB 필터와 별개로 같은 규칙 함수로 한 번 더 확인 (푸시 발송 기준과 어긋나지 않게)
      const dealRows = (matchRes.data ?? []).filter((d) =>
        matchesConditions({ category: d.category_id as number, region: d.region_id as number }, catIds, regIds)
      );
      setOutsideCount(Math.max(0, (totalCount ?? 0) - (matchRes.count ?? dealRows.length)));

      setCategories(
        (catRows ?? [])
          .map((r) => (r.categories as unknown as { name: string } | null)?.name)
          .filter((n): n is string => Boolean(n))
      );
      setRegions(
        (regRows ?? [])
          .map((r) => (r.regions as unknown as { name: string } | null)?.name)
          .filter((n): n is string => Boolean(n))
      );
      setDeals(
        (dealRows ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
          region: (d.regions as unknown as { name: string } | null)?.name ?? "",
          location: formatDealLocation(((d.regions as unknown) as { name: string } | null)?.name, d.location),
          stock_type: d.stock_type ?? "general",
          ...dealPriceFields(d, matchRes.priceHidden),
          total_qty: d.total_qty,
          remaining_qty: d.remaining_qty,
          quantity_unit: d.quantity_unit ?? "개",
          price_unit: d.price_unit ?? null,
          closes_at: d.closes_at,
          created_at: d.created_at,
          images: d.images ?? [],
          video_url: d.video_url ?? null,
          origin: d.origin ?? null,
          min_order_qty: d.min_order_qty ?? null,
        }))
      );
      setLoaded(true);
    })();
  }, []);

  const condCats =
    categories.length > 0
      ? categories.slice(0, 2).join("·") + (categories.length > 2 ? ` 외 ${categories.length - 2}` : "")
      : "전체 카테고리";
  const allRegionsOn = regions.length > 0 && regions.length === mockRegions.length;
  const condRegions =
    regions.length === 0 || allRegionsOn
      ? "전 지역"
      : regions.slice(0, 2).join("·") + (regions.length > 2 ? ` 외 ${regions.length - 2}` : "");
  const myCondText = `${condCats} · ${condRegions}`;

  const [viewer, setViewer] = useState<{ images: string[]; video: string | null; index: number } | null>(null);
  // 2026-10-01 PR-C: 열려 있으면 안드로이드 뒤로가기 = 이것만 닫기 (src/lib/useBackToClose.ts)
  useBackToClose(viewer !== null, () => setViewer(null));

  const groups = bucketDeals(deals);
  // 매물 수 적을 땐 큰 카드(임팩트), 많아지면 촘촘한 리스트로 자동 전환
  const wideLayout = deals.length <= 4;

  const openViewer = (e: React.MouseEvent, images: string[], video: string | null, index = 0) => {
    e.preventDefault();
    e.stopPropagation();
    setViewer({ images, video, index });
  };

  const dismissInstall = () => {
    setShowInstall(false);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <main className="flex flex-col min-h-screen bg-white" style={{ paddingBottom: 64 }}>
      {/* 2026-09-26: position:sticky였는데 실제로는 전혀 안 떠 있던 버그 발견 —
          layout.tsx의 overflow-x-hidden 단독 설정이 overflow-y를 auto로 계산시켜
          이 div가 의도치 않은 sticky 기준 컨테이너가 됐는데, 그 컨테이너 자체는
          내부 스크롤이 발생한 적이 없어 sticky가 무력화됨 (buy/sell/signup 하단
          CTA와 동일 원인, 동일 수정). fixed로 교체하고 아래 콘텐츠에 paddingTop
          보정. 서브텍스트 자리는 RotatingUrgencyTag로 교체해 다른 화면과 통일된
          긴급성 문구를 노출. */}
      {/* 2026-09-26 (8): 다른 4개 탭 헤더(deals/buy/sell/signup)는 전부 네이비
          도트 텍스처인데 이 고정 바만 흰 배경이라 겉돈다는 피드백 — 동일 텍스처로
          통일. 타이틀도 15.5px→20px로 키워 로테이션 태그(text-base, 루트
          112.5% 적용 시 실제 18px)보다 확실히 크게. 단, 이 바는 스크롤해도 항상
          고정으로 떠 있어서 deals 히어로(27px)만큼 키우진 않음 — 매물 피드
          공간을 계속 깎아먹지 않도록 "태그보다만 크게" 수준으로 절충.
          2026-09-27: manager.png는 불투명 흰 배경이 박혀있어 네이비 상단바
          위에서 흰 사각형이 그대로 보이는 문제 — buy 페이지와 동일하게 투명
          컷아웃(manager-cut.png)으로 교체, 뱃지처럼 마감하던 rounded-lg도 제거. */}
      <div
        className="fixed z-10 left-1/2 -translate-x-1/2 w-full max-w-md"
        style={{
          // 인앱 브라우저 배너(InAppBanner)가 떠 있으면 그 아래로
          top: "calc(var(--sat) + var(--inapp-banner-h, 0px))",
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        <div className="flex items-center gap-3.5" style={{ padding: "14px 20px 12px" }}>
          {/* 2026-09-28: 회원 홈에 실제 로고가 없다는 피드백(2026-09-27 코멘트 참고,
              당시엔 캐릭터에 애니메이션만 추가) — 좌측 끝에 로고 배지를 배치하고,
              간격을 띄워 캐릭터+문구 블록을 오른쪽에 둠.
              2026-09-28 (2차): "Powered by JumpX" 서브텍스트가 잘 안 보이는 데다
              오히려 로고 배지보다 폭이 넓어서(9.5px 텍스트가 로고보다 김) 제목
              공간을 깎아먹고 있었음 — 빼고 로고를 키움(h-5→h-6). 세로 스택이
              아니게 돼 flex-col도 제거. */}
          <TabLink href="/" className="bg-white rounded-md inline-flex items-center flex-shrink-0" style={{ padding: "4px 7px" }}>
            <img src="/images/logo.png" alt="덤핑점핑" className="h-6 w-auto block" />
          </TabLink>
          <div className="flex items-center gap-2.5 min-w-0">
            {/* 2026-09-27: 캐릭터 아이콘에 스플래시와 동일한 바운스 애니메이션 적용. */}
            <img
              src="/images/manager-cut.png"
              alt="점핑매니저"
              className={logoAnimate ? "animate-logo-jump" : ""}
              style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }}
            />
            <div className="min-w-0">
              {/* 2026-09-28: 0028에서 로고 블록이 좌측에 추가되며 이 텍스트 폭이
                  줄어 360px대 화면에서 말줄임 위험이 커짐 — 캐릭터(브랜드 개성
                  요소, 애니메이션 포함)는 유지하고, 폰트를 20→18px로 줄이고
                  빈 상태 카피도 더 짧게 다듬어 대응.
                  2026-09-28 (2차, 되돌림): 태그를 제목과 같은 줄·bar 우측 끝으로
                  뺐다가(0035) 로컬 세션 실측 결과 flexShrink:0 태그가 150px 가까이
                  고정 차지해 360px 화면에서 제목이 "오늘 긴…" 수준까지 잘리고,
                  두 줄→한 줄로 바뀌며 바 높이(83px 실측 튜닝값)도 어긋나 빈 틈이
                  생기는 걸 확인 — 제목 폭·바 높이를 그대로 지키기 위해 태그는
                  다시 둘째 줄로 되돌리되, 그 줄 안에서만 justify-end로 우측 정렬. */}
              <div className="font-display truncate" style={{ fontSize: rem(18), color: "#fff" }}>
                {deals.length > 0 ? `내 조건 긴급매물 ${deals.length}건` : "내 조건 긴급매물"}
              </div>
              <div className="flex justify-end">
                <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: `${INBOX_HEADER_HEIGHT + INBOX_HEADER_GAP}px 20px 2px` }}>
        <Link
          href="/sell"
          className="flex items-center justify-between rounded-xl"
          style={{ background: "#FF6F0F", padding: "13px 16px", boxShadow: "0 2px 10px rgba(255,111,15,0.35)" }}
        >
          <span className="text-sm font-bold text-white">📦 잠든 재고, 깨워서 현금으로</span>
          <span
            className="text-xs font-bold text-white rounded-full flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px" }}
          >
            무료 등록 →
          </span>
        </Link>
      </div>

      <TabLink
        href="/mypage#alerts"
        className="flex items-center gap-2 w-full text-left"
        style={{ borderBottom: "1px solid #F1F3F5", padding: "9px 20px" }}
      >
        <span style={{ fontSize: rem(12) }}>⚙️</span>
        <span className="flex-1 min-w-0 truncate" style={{ fontSize: rem(12.5), color: "#6B7480" }}>{myCondText}</span>
        <span className="flex-shrink-0 font-bold" style={{ fontSize: rem(12), color: "#E25100" }}>조건 수정</span>
      </TabLink>

      {showInstall && canInstall && (
        <div className="flex items-center gap-2.5" style={{ borderBottom: "1px solid #F1F3F5", padding: "12px 20px", background: "#FAFBFC" }}>
          <div className="flex-1 min-w-0">
            <InstallAppButton canInstall={canInstall} promptInstall={promptInstall} hasNativePrompt={hasNativePrompt} />
          </div>
          <button onClick={dismissInstall} className="flex-shrink-0" style={{ border: "none", background: "none", color: "#9AA3AD", fontSize: rem(16), width: 28, height: 28 }}>
            ×
          </button>
        </div>
      )}

      {groups.map((g, gi) => (
        <div key={g.label}>
          <div className="flex items-center gap-2" style={{ padding: "18px 20px 9px" }}>
            <span className="font-black" style={{ fontSize: rem(12), color: "#0B2540", letterSpacing: "0.02em" }}>{g.label}</span>
            <span className="flex-1" style={{ height: 1, background: "#EEF0F2" }} />
            <span className="font-mono font-bold" style={{ fontSize: rem(11), color: "#6B7480" }}>{g.items.length}건</span>
          </div>
          {g.items.map((d, di) => {
            const cd = formatCountdown(d.closes_at);
            const pct = cardDiscountPct(d);
            return (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="block w-full text-left"
                style={{ borderBottom: "1px solid #F1F3F5", padding: "14px 20px", background: "#fff" }}
              >
                <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: rem(12), color: "#6B7480" }}>{d.location}</span>
                  {/* 넓은 카드는 남은 시간이 사진 오른쪽 위(DealCardMedia), 좁은 썸네일 카드만 여기 */}
                  {!wideLayout && (
                    <span className="font-mono font-bold ml-auto" style={{ fontSize: rem(12), color: cd.urgent ? "var(--color-urgent)" : "#6B7480" }}>
                      ⏱ {cd.label}
                    </span>
                  )}
                </div>
                <div className={wideLayout ? "flex flex-col gap-2.5" : "flex items-start gap-2.5"}>
                  {wideLayout ? (
                    <DealCardMedia
                      image={d.images?.[0]}
                      alt={d.title}
                      category={d.category}
                      discountPct={pct}
                      closesAt={d.closes_at}
                      videoUrl={d.video_url ?? null}
                      imageCount={d.images?.length ?? 0}
                      onMediaClick={d.images && d.images.length > 0 ? (e) => openViewer(e, d.images!, d.video_url ?? null) : undefined}
                      eager={gi === 0 && di === 0}
                      className="rounded-xl"
                    />
                  ) : d.images && d.images.length > 0 ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => openViewer(e, d.images!, d.video_url ?? null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openViewer(e as unknown as React.MouseEvent, d.images!, d.video_url ?? null);
                      }}
                      className="relative rounded-xl overflow-hidden flex-shrink-0"
                      style={{ width: 64, height: 64 }}
                    >
                      <img src={d.images[0]} alt={d.title} className="w-full h-full object-cover" />
                      {d.video_url && (
                        <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,.25)" }}>
                          <span style={{ fontSize: wideLayout ? rem(32) : rem(18), color: "#fff" }}>▶</span>
                        </span>
                      )}
                      {d.images.length > 1 && (
                        <span className="absolute bottom-1 right-1 rounded font-bold text-white" style={{ fontSize: rem(10), padding: "1px 5px", background: "rgba(0,0,0,.5)" }}>
                          1/{d.images.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span
                      className="rounded-xl overflow-hidden flex-shrink-0 block"
                      style={{ width: 64, height: 64 }}
                    >
                      <NoPhotoPlaceholder category={d.category} size="sm" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    {d.stock_type && d.stock_type !== "general" && <StockTypeBadge value={d.stock_type} className="mb-1" />}
                    <span className="block font-bold leading-snug" style={{ fontSize: rem(16), color: "#1A1F26" }}>{d.title}</span>
                    <span className="block mt-0.5" style={{ fontSize: rem(12.5), color: "#6B7480" }}>
                      {d.category} · {d.location} · 잔여 {d.remaining_qty}{d.quantity_unit || "개"}
                    </span>
                    {(d.origin || (d.min_order_qty && !isLumpSum(d.price_unit))) && (
                      <span className="block mt-0.5" style={{ fontSize: rem(11.5), color: "#9AA3AD" }}>
                        {d.origin && `🌍 ${d.origin}`}
                        {d.origin && d.min_order_qty && !isLumpSum(d.price_unit) ? " · " : ""}
                        {d.min_order_qty && !isLumpSum(d.price_unit) && `MOQ ${d.min_order_qty}${d.quantity_unit || "개"}`}
                      </span>
                    )}
                    <span className="flex items-baseline gap-1.5 mt-1.5">
                      {isNegotiable(d) ? (
                        <NegotiablePrice color="#0B2540" className="text-lg" />
                      ) : d.price_hidden ? (
                        <MemberPriceTeaser discountPct={pct} color="#0B2540" className="text-lg" />
                      ) : (
                        <>
                          {!wideLayout && pct > 0 && (
                            <span className="font-black text-white rounded" style={{ fontSize: rem(12), padding: "2px 7px", background: "#E25100" }}>
                              -{pct}%
                            </span>
                          )}
                          <span className="font-black" style={{ fontSize: rem(18), color: "#0B2540" }}>{dealPriceLabel(d)}</span>
                          <span style={{ fontSize: rem(12.5), color: "#6B7480", textDecoration: "line-through" }}>{d.original_price != null ? formatDealPrice(d.original_price, d.quantity_unit, d.price_unit) : ""}</span>
                        </>
                      )}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ))}

      {loaded && groups.length === 0 && (
        <div className="text-center" style={{ padding: "40px 20px 28px" }}>
          <p className="font-bold" style={{ fontSize: rem(15), color: "#1A1F26" }}>
            내 조건에 맞는 진행 중 매물이 없어요
          </p>
          <p className="mt-1" style={{ fontSize: rem(13), color: "#6B7480" }}>
            조건에 맞는 매물이 올라오면 가장 먼저 알려드릴게요.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <TabLink
              href="/mypage#alerts"
              className={`flex-1 ${BTN_CLASS}`}
              style={btnStyle("secondary")}
            >
              조건 넓히기
            </TabLink>
            <Link
              href="/deals"
              className={`flex-1 ${BTN_CLASS}`}
              style={btnStyle("primary")}
            >
              전체 매물 보기
            </Link>
          </div>
        </div>
      )}

      {loaded && shouldShowExamples(deals.length, isSupabaseConfigured) && (
        <div>
          <div className="flex items-center gap-2" style={{ padding: "18px 20px 9px" }}>
            <span style={SECTION_TITLE_STYLE}>💡 이런 매물이 올라와요</span>
            <span className="flex-1" style={{ height: 1, background: "#EEF0F2" }} />
            <span className="text-xs font-bold rounded-full" style={{ padding: "2px 8px", background: "#E9ECEF", color: "#495057" }}>예시</span>
          </div>
          {EXAMPLE_DEALS.map((d) => {
            const pct = d.original_price && d.deal_price != null ? Math.round(((d.original_price - d.deal_price) / d.original_price) * 100) : 0;
            return (
              <Link key={`example-${d.id}`} href={`/deals/example-${d.id}`} className="block w-full text-left" style={{ borderBottom: "1px solid #F1F3F5", padding: "14px 20px", opacity: 0.8 }}>
                <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
                  <span className="font-black rounded" style={{ fontSize: rem(11.5), padding: "3px 8px", background: "#E9ECEF", color: "#495057" }}>예시</span>
                  <span style={{ fontSize: rem(12), color: "#6B7480" }}>{d.location}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <DealCardMedia
                    image={d.images?.[0]}
                    alt={d.title}
                    category={d.category}
                    discountPct={pct}
                    closesAt={d.closes_at}
                    videoUrl={d.video_url ?? null}
                    imageCount={d.images?.length ?? 0}
                    example
                    className="rounded-xl"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold leading-snug" style={{ fontSize: rem(16), color: "#1A1F26" }}>{d.title}</span>
                    <span className="block mt-0.5" style={{ fontSize: rem(12.5), color: "#6B7480" }}>
                      {d.category} · {d.location} · 잔여 {d.remaining_qty}{d.quantity_unit || "개"}
                    </span>
                    {(d.origin || (d.min_order_qty && !isLumpSum(d.price_unit))) && (
                      <span className="block mt-0.5" style={{ fontSize: rem(11.5), color: "#9AA3AD" }}>
                        {d.origin && `🌍 ${d.origin}`}
                        {d.origin && d.min_order_qty && !isLumpSum(d.price_unit) ? " · " : ""}
                        {d.min_order_qty && !isLumpSum(d.price_unit) && `MOQ ${d.min_order_qty}${d.quantity_unit || "개"}`}
                      </span>
                    )}
                    <span className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="font-black" style={{ fontSize: rem(18), color: "#6B7480" }}>{dealPriceLabel(d)}</span>
                      <span style={{ fontSize: rem(12.5), color: "#9AA3AD", textDecoration: "line-through" }}>{d.original_price != null ? formatDealPrice(d.original_price, d.quantity_unit, d.price_unit) : ""}</span>
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
          <p className="text-center" style={{ padding: "10px 20px 4px", fontSize: rem(11.5), color: "#9AA3AD" }}>
            실제 매물이 아닌 예시예요 · 매물이 등록되면 빠르게 알려드려요
          </p>
        </div>
      )}

      {/* 예전엔 "조건을 넓히면 주 N건" 추정치(카테고리 수로 계산한 확인 안 된 숫자)를 보여줬음 —
          실제 개수인 "내 조건 밖 진행 중 매물"로 교체, 0건이면 숨김. */}
      {loaded && outsideCount > 0 && (
        <div style={{ padding: "22px 20px 30px" }}>
          <Link href="/deals" className="flex items-center justify-between gap-3">
            <span style={{ fontSize: rem(13), color: "#6B7480" }}>내 조건 밖 진행 중 매물 {outsideCount}건</span>
            <span className="font-bold flex-shrink-0" style={{ fontSize: rem(13), color: "#E25100" }}>전체 매물 보기 →</span>
          </Link>
        </div>
      )}

      {/* 2026-09-30 (커밋 D): 단독 English 링크 → 사업자 정보 푸터의 링크 줄로 이동 */}
      <BusinessFooter className="mt-2" />

      {viewer && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(0,0,0,.92)" }}
          onClick={() => setViewer(null)}
        >
          <button
            onClick={() => setViewer(null)}
            className="absolute top-4 right-4 text-white"
            style={{ fontSize: rem(28), background: "none", border: "none" }}
          >
            ×
          </button>
          {viewer.video ? (
            <video src={viewer.video} controls autoPlay className="max-w-full max-h-[80vh]" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={viewer.images[viewer.index]} alt="매물 사진" className="max-w-full max-h-[80vh] object-contain" onClick={(e) => e.stopPropagation()} />
          )}
          {viewer.images.length > 1 && !viewer.video && (
            <div className="flex gap-4 mt-4">
              <button onClick={(e) => { e.stopPropagation(); setViewer({ ...viewer, index: (viewer.index - 1 + viewer.images.length) % viewer.images.length }); }} className="text-white text-xl">‹</button>
              <span className="text-white text-sm">{viewer.index + 1} / {viewer.images.length}</span>
              <button onClick={(e) => { e.stopPropagation(); setViewer({ ...viewer, index: (viewer.index + 1) % viewer.images.length }); }} className="text-white text-xl">›</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
