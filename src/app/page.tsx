"use client";

import { DEAL_NEW_COLS, isMissingNewColumn, type DealRowLoose } from "@/lib/dealFields";
import { useEffect, useState } from "react";
import Link from "next/link";
import TabLink from "@/components/TabLink";
import BusinessFooter from "@/components/BusinessFooter";
import { mockCategories, mockDeals, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatPrice } from "@/lib/format";
import SplashScreen from "@/components/SplashScreen";
import OnboardingIntro from "@/components/OnboardingIntro";
import InstallAppButton, { useInstallPrompt } from "@/components/InstallAppButton";
import KakaoChannelButton from "@/components/KakaoChannelButton";
import CategoryScroller from "@/components/CategoryScroller";
import EcosystemGrid, { SECTION_TITLE_STYLE, SERVICES_ANCHOR_ID, scrollToServicesIfHash } from "@/components/EcosystemGrid";
import AlertInboxHome from "@/components/AlertInboxHome";
import { formatDealLocation } from "@/lib/formatDealLocation";
import NoPhotoPlaceholder from "@/components/NoPhotoPlaceholder";
import MemberPriceTeaser from "@/components/MemberPriceTeaser";
import { GUEST_PRICE_COLS, dealPriceFields, cardDiscountPct } from "@/lib/dealPriceAccess";
import { isNegotiable } from "@/lib/priceMode";
import NegotiablePrice from "@/components/NegotiablePrice";
import { SITE_URL } from "@/lib/siteUrl";
import { rem } from "@/lib/rem";
import ReturningMemberIntro from "@/components/ReturningMemberIntro";
import { getRememberedLoginMethod, hasActivePushSubscription, hasLoginHistory, type LoginMethod } from "@/lib/returningMember";
import FloatingCTA, { FLOATING_CTA_BUTTON_CLASS, FLOATING_CTA_SPACE, floatingCtaButtonStyle } from "@/components/FloatingCTA";

const TODAY_BADGE_THRESHOLD = 5; // 이보다 적으면 "오늘 N건" 배너를 아예 숨김 (빈약한 숫자 노출 방지)
const BUSINESS_COUNT_THRESHOLD = 30; // 이보다 적으면 사업자 수 대신 무숫자 카피로 대체 (빈약한 숫자 노출 방지)

const EXAMPLE_DEALS = mockDeals.filter((d) => d.status !== "closed").slice(0, 3);

export default function Home() {
  const [todayCount, setTodayCount] = useState(0);
  const [businessCount, setBusinessCount] = useState(0);
  const [preview, setPreview] = useState<Deal[]>(EXAMPLE_DEALS);
  const [isExample, setIsExample] = useState(true);
  // "unknown" = 세션 확인 전. 비회원 홈 전용 조회는 "guest"로 확정된 뒤에만 실행한다
  // (예전엔 회원도 오늘 건수·미리보기·public-stats를 매번 조회했음).
  const [memberState, setMemberState] = useState<"unknown" | "member" | "guest">(
    isSupabaseConfigured ? "unknown" : "guest"
  );
  const isMember = memberState === "member";
  // 첫 방문 화면 "지금 진행 중인 매물 N건" — null = 로딩 중·실패(줄 없음)
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [signupPending, setSignupPending] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  // 2026-09-27: 로고 바운스(animate-logo-jump)가 스플래시(1.8초)와 동시에
  // 마운트돼 화면에 드러날 일 없이 가려진 채로 끝나던 버그 — 스플래시가
  // 실제로 사라지는 시점(onFinish)에야 애니메이션 클래스를 붙이도록 지연.
  // OnboardingIntro(첫 방문자 화면)의 자체 로고도 같은 문제라 이 값을 그대로 전달.
  const [logoAnimate, setLogoAnimate] = useState(false);
  const { canInstall, promptInstall, hasNativePrompt, repeatVisit } = useInstallPrompt();

  const dismissInstallBanner = () => {
    try {
      localStorage.setItem("dj_install_banner_dismissed", "1");
    } catch {}
    setInstallDismissed(true);
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setMemberState(data.session?.user ? "member" : "guest");
    });
  }, []);

  // 2026-09-29: 재방문 회원 — 비로그인인데 이 기기에서 로그인한 적 있거나(방식 기억값 포함) 푸시 구독이 있으면
  // 가입 온보딩 대신 "다시 오셨네요" 화면. null = 판별 중(그동안 온보딩도 안 띄움)
  const [returning, setReturning] = useState<{ method: LoginMethod | null; pushActive: boolean } | null | false>(null);
  const [returningBrowse, setReturningBrowse] = useState(false);
  useEffect(() => {
    if (memberState !== "guest") return;
    let cancelled = false;
    (async () => {
      const pushActive = await hasActivePushSubscription();
      if (cancelled) return;
      if (!pushActive && !hasLoginHistory()) return setReturning(false);
      setReturning({ method: getRememberedLoginMethod(), pushActive });
      try {
        setReturningBrowse(sessionStorage.getItem("dj_returning_browse") === "1");
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [memberState]);
  const browseAsReturning = () => {
    try {
      sessionStorage.setItem("dj_returning_browse", "1"); // 이번 방문(탭)에서만 닫힘
    } catch {}
    setReturningBrowse(true);
  };

  // 매물 상세 "점핑 서비스 · 전체 보기"(비회원)로 들어오면 섹션까지 스크롤
  useEffect(() => {
    if (memberState === "guest") scrollToServicesIfHash();
  }, [memberState]);

  useEffect(() => {
    try {
      setSignupPending(localStorage.getItem("dj_signup_pending") === "1");
      setInstallDismissed(localStorage.getItem("dj_install_banner_dismissed") === "1");
    } catch {}
  }, []);

  // 2026-09-27: 신뢰 지표용 인증 사업자 수 — 개인정보 없이 숫자만 내려주는
  // 공개 API(/api/public-stats)에서 가져옴 (members 테이블 RLS는 본인만 조회 가능).
  useEffect(() => {
    if (memberState !== "guest") return;
    fetch("/api/public-stats")
      .then((res) => res.json())
      .then((data) => setBusinessCount(data.businessCount ?? 0))
      .catch(() => {});
  }, [memberState]);

  useEffect(() => {
    if (memberState !== "guest") return; // 회원 홈(AlertInboxHome)은 자체 조회
    if (!isSupabaseConfigured || !supabase) return; // 데모 모드: 예시 매물 그대로 노출

    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const nowIso = new Date().toISOString();

      const [{ count }, { data: previewData }, { count: activeTotal, error: activeError }] = await Promise.all([
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("created_at", todayStart.toISOString()),
        // 2026-10-01 PR-B: 카드에 소비기한 — SQL 전이면 새 컬럼 빼고 다시 조회
        (async () => {
          const run = (extra: string) =>
            supabase!
              .from("deals")
              .select<string, DealRowLoose>(
                `id, title, ${GUEST_PRICE_COLS}, total_qty, remaining_qty, closes_at, created_at, location, images, package_unit, min_order_qty, quantity_unit, price_unit, stock_type, categories(name), regions(name)${extra}`
              )
              .eq("status", "active")
              .gt("closes_at", new Date().toISOString())
              .order("created_at", { ascending: false })
              .limit(3);
          const r = await run(DEAL_NEW_COLS);
          return isMissingNewColumn(r.error) ? run("") : r;
        })(),
        // 첫 방문 화면 진행 중 매물 수 — /deals "진행중" 탭과 같은 조건(status=active · closes_at > 지금).
        // 2026-10-05: 예전 "평균 할인율"(discount_pct 평균) 대신. 개수만(head) 세서 가격 칸(#57 A안)은 읽지 않음
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gt("closes_at", nowIso),
      ]);

      setTodayCount(count ?? 0);
      setActiveCount(activeError || activeTotal == null ? null : activeTotal);
      if (previewData && previewData.length > 0) {
        setPreview(
          previewData.map((d) => ({
            id: d.id,
            title: d.title,
            category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
            region: (d.regions as unknown as { name: string } | null)?.name ?? "",
            location: formatDealLocation(((d.regions as unknown) as { name: string } | null)?.name, d.location),
            stock_type: d.stock_type ?? "general",
            ...dealPriceFields(d, true),
            total_qty: d.total_qty,
            remaining_qty: d.remaining_qty,
            closes_at: d.closes_at,
            created_at: d.created_at,
            images: d.images ?? [],
            package_unit: d.package_unit ?? null,
            min_order_qty: d.min_order_qty ?? null,
            storage_type: d.storage_type ?? null,
            expiry_date: d.expiry_date ?? null,
            quantity_unit: d.quantity_unit ?? null,
            price_unit: d.price_unit ?? null,
          }))
        );
        setIsExample(false);
      }
      // 실제 매물이 아직 없으면 예시(EXAMPLE_DEALS)를 그대로 보여줘서
      // "이런 특가 알림이 온다"는 감을 주고, 빈 화면으로 밋밋해지는 걸 막습니다.
    })();
  }, [memberState]);

  return (
    <SplashScreen onFinish={() => setLogoAnimate(true)}>
    {/* hreflang — React 19가 <link>를 <head>로 올려줌. 짝은 /en의 metadata.alternates */}
    <link rel="alternate" hrefLang="ko-KR" href={`${SITE_URL}/`} />
    <link rel="alternate" hrefLang="en" href={`${SITE_URL}/en`} />
    {/* 세션 확인 전(unknown)엔 회원일 수도 있어 온보딩을 띄우지 않음. 재방문 회원(판별 중 포함)도 온보딩 대신 */}
    <OnboardingIntro logoAnimate={logoAnimate} isMember={memberState !== "guest" || returning !== false} activeCount={activeCount} />
    {memberState === "guest" && returning && !returningBrowse && (
      <ReturningMemberIntro method={returning.method} pushActive={returning.pushActive} onBrowse={browseAsReturning} />
    )}
    {signupPending && (
      <Link
        href="/signup"
        className="block bg-[#FFF4E0] px-5 py-3 text-sm font-bold text-center"
        style={{ color: "#966B00" }}
      >
        ⚠️ 인증은 완료됐는데 가입이 안 끝났어요! 가입 마저 하기 →
      </Link>
    )}
    {isMember ? (
      <AlertInboxHome logoAnimate={logoAnimate} />
    ) : (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-4 pb-4 text-white"
        style={{ background: "linear-gradient(135deg, #0B2540, #1B3A5C)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="bg-white rounded-xl px-3 py-2 inline-block">
            <img src="/images/logo.png" alt="덤핑점핑" className={`h-8 w-auto ${logoAnimate ? "animate-logo-jump" : ""}`} />
          </div>
          <span className="text-white/70 text-sm tracking-wide self-end mb-1">
            Powered by JumpX
          </span>
        </div>

        {/* 신뢰 지표 — 2026-09-27 (재검토 2): 동종업계 문자광고("전국 4,973개
            업체 공유") 벤치마킹 — "명"(개인) 대신 "개 업체"(사업자 인증 회원) 단위로
            바꾸면 같은 실측치라도 B2B 플랫폼 성격에 더 맞고 설득력도 큼.
            /api/public-stats에서 실시간 집계한 값이 충분히 클 때만 노출하고,
            작거나 아직 안 불러왔으면 무숫자 카피로 자연스럽게 대체. */}
        <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 mb-4">
          <span style={{ color: "#5EEAD4", fontSize: rem(11) }}>✔</span>
          <span className="font-bold text-white/90" style={{ fontSize: rem(11) }}>
            {businessCount >= BUSINESS_COUNT_THRESHOLD
              ? `전국 ${businessCount.toLocaleString()}개 사업자가 함께하는 중`
              : "지금도 계속 새 매물이 올라와요"}
          </span>
        </div>

        {/* 2026-09-27 (재재검토): 헤드라인(text-xl)과 서브카피(text-sm) 크기 차이가
            작아 위계가 흐릿하다는 피드백 — 트러스트 배지는 11px로 더 줄이고,
            헤드라인은 한 단계 키우고(text-xl→text-2xl), 서브카피는 한 단계
            줄여서(text-sm→text-xs) "배지 < 서브카피 < 헤드라인" 3단 위계를 명확히 함. */}
        {/* 2026-09-27 (3): text-2xl(27px)이 390px 이하 폭에서 헤드라인 2번째 줄이
            3줄로 깨지는 원인 — 카피는 그대로 두고 24px로 한 단계만 낮춰 위계
            개선분은 절반 남기면서 2줄을 유지. */}
        <h1 className="font-display leading-snug drop-shadow-sm break-keep" style={{ fontSize: rem(24) }}>
          <span style={{ color: "#FF6F0F" }}>남는 상품은 빠르게 알리고,</span>
          <br />
          급한 상품은 남보다 먼저 잡으세요.
        </h1>
        <p className="text-white/85 text-xs mt-4 leading-relaxed">
          <span className="hidden sm:inline">
            전국의 임박·과잉·폐업·재고처분 매물을 찾아 원하는 상품이 나오면
            <br />
            가장 먼저 알려드립니다.
          </span>
          <span className="sm:hidden">임박·과잉·폐업 재고, 가장 먼저 알려드립니다.</span>
        </p>

        {/* 긴급성 — 실제 오늘 등록 건수가 일정 수준 이상일 때만 노출 (빈약한 숫자 노출 방지) */}
        {todayCount >= TODAY_BADGE_THRESHOLD && (
          <Link
            href="/deals"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold px-3 py-2 rounded-full"
            style={{ background: "rgba(255,111,15,0.2)", color: "var(--color-brandOrangeAccent)" }}
          >
            🔥 오늘 등록된 덤핑 매물 {todayCount}건 · 지금 확인하기 →
          </Link>
        )}
      </div>

      {/* 2026-10-05 여백(px 고정 — 이 앱은 rem이 18px 기준이라 Tailwind 단위는 값이 어긋남): 남색 머리 아래 16px · 카테고리 줄 아래 24px · 제목 아래 12px (카드 안쪽 위아래는 원래 값 py-3 유지) */}
      <div style={{ paddingTop: 16 }}>
        <div className="px-5 text-lg font-bold text-navy mb-3">어떤 상품을 찾고 계세요?</div>
        {/* 3x3 그리드(약 300px)가 히어로 직후 화면 절반을 차지해 실제 매물 미리보기가
            스크롤 없이 안 보이던 문제 — 가로 스크롤 칩 한 줄로 축소. 카테고리 구분은
            여전히 아이콘 배지 색상만으로(카드 배경은 통일). */}
        <div className="relative">
          <CategoryScroller className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
            {mockCategories.map((c) => {
              const color = categoryColors[c];
              return (
                <TabLink
                  key={c}
                  href={`/deals?category=${encodeURIComponent(c)}`}
                  className="flex items-center gap-1.5 rounded-full py-2 pl-2 pr-3.5 bg-white border border-gray200 whitespace-nowrap flex-shrink-0 active:scale-95 transition-transform"
                >
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-full text-sm flex-shrink-0"
                    style={{ background: color.bg }}
                  >
                    {categoryIcons[c]}
                  </span>
                  <span className="text-sm font-bold text-navy">{c}</span>
                </TabLink>
              );
            })}
          </CategoryScroller>
          {/* 스크롤바를 숨겨놔서(no-scrollbar) 더 있다는 힌트가 없던 문제 —
              오른쪽 끝에 살짝 페이드 처리해서 "옆으로 더 있다"는 걸 알려줌 */}
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-1 w-10"
            style={{ background: "linear-gradient(to right, rgba(245,246,248,0), rgba(245,246,248,1))" }}
          />
        </div>
      </div>

      {/* 상단은 핵심 전환(회원가입→맞춤 알림)에만 집중 — 카카오톡 채널 추가는
          같은 "카카오 버튼" 스타일로 나란히 있으면 가입과 중복돼 보여서
          매물을 먼저 보여준 뒤(아래) 저관여 위치로 옮김. */}
      {/* 2026-10-03: 첫 방문엔 설치 카드를 숨김 — 로그인 회원이거나 두 번째 방문부터 */}
      {canInstall && !installDismissed && (isMember || repeatVisit) && (
        <div className="px-5 pt-5">
          {/* 2026-10-05: 전체 폭 한 줄 띠 — 왼쪽 이모지+글자, 오른쪽 [지금 설치], 끝에 닫기(X, 터치 44×44).
              (예전 2026-09-27 폭 58% 카드는 [지금 설치]가 아랫줄로 내려가 폐기) */}
          <div
            className="rounded-2xl flex items-center"
            style={{ border: "2px solid rgba(255,111,15,0.35)", padding: "6px 2px 6px 16px" }}
          >
            <div className="flex-1 min-w-0">
              <InstallAppButton oneLine canInstall={canInstall} promptInstall={promptInstall} hasNativePrompt={hasNativePrompt} />
            </div>
            <button
              type="button"
              onClick={dismissInstallBanner}
              aria-label="닫기"
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 44, height: 44, color: "#B8BFC7", fontSize: rem(13), lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 매물 예시 — 실제 매물이 있으면 실제로, 없으면 예시로 "이런 특가가 온다"는 감을 줌 */}
      {preview.length > 0 && (
        <div className="px-5" style={{ paddingTop: "calc(24px - 0.25rem)" /* 카테고리 줄 아래 pb-1(0.25rem)이 이미 있어 그만큼 빼서 칩 아래 끝→제목 24px */ }}>
          <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
            <div className="text-base font-bold text-navy">
              {isExample ? "가입하면 이런 특가 알림이 와요" : "오늘 이런 매물이 올라왔어요"}
            </div>
            {isExample && (
              <span className="text-xs font-bold text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
                예시
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {preview.map((d) => {
              const color = categoryColors[d.category] ?? categoryColors["기타"];
              const discountPct = cardDiscountPct(d);
              return (
                <Link
                  key={d.id}
                  href={isExample ? "/signup" : `/deals/${d.id}`}
                  className="relative flex items-center gap-3 rounded-2xl border border-gray200 px-3.5 py-3 overflow-hidden active:scale-[0.98] transition-transform"
                >
                  {/* 2026-10-03: 사진 56px(3.5rem) → 110px 정사각형(px 고정 — 큰 글자 설정에서도 같은 크기). 사진 없을 때 자리 표시도 같은 크기 */}
                  <div
                    className="relative rounded-token flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden"
                    style={{ background: color.bg, width: 140, height: 140 }}
                  >
                    {/* 2026-10-03: 할인율 배지를 카드 오른쪽 위 → 사진 왼쪽 위로(/deals 카드 DealCardMedia와 같은 위치·색 규칙의 축소판).
                        본문 오른쪽 위에 있을 땐 "소비기한 임박" 칩·매물명과 겹쳤음(사진이 커져 본문 폭이 줄어서). 큰 글자에서도 사진 안에 들어가게 최대 폭 제한 */}
                    {discountPct > 0 && (
                      <div
                        className="absolute top-1.5 left-1.5 z-[1] font-black text-white rounded-full pointer-events-none whitespace-nowrap"
                        style={{
                          background: isExample ? "rgba(107,116,128,0.78)" : "rgba(226,81,0,0.78)",
                          fontSize: rem(13),
                          lineHeight: 1.2,
                          padding: "2px 7px",
                          maxWidth: "calc(100% - 12px)",
                        }}
                      >
                        -{discountPct}%
                      </div>
                    )}
                    {d.images && d.images.length > 0 ? (
                      <img
                        src={d.images[0]}
                        alt={d.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <NoPhotoPlaceholder category={d.category} size="sm" />
                    )}
                  </div>
                  {/* 할인 배지가 사진 위로 옮겨가서 본문 오른쪽 배지 자리(pr) 없음 — 글자 칸 최대 */}
                  <div className="flex-1 min-w-0" style={{ overflowX: "clip", overflowWrap: "anywhere" }}>
                    {/* 매물명 2줄까지 + 말줄임 */}
                    <div className="font-bold text-navy line-clamp-2 leading-snug" style={{ fontSize: rem(17) }} data-title>{d.title}</div>
                    {/* 2026-10-04 card-layout-v2: 회원 홈 목록형과 같은 규칙 — 메타 한 줄 "카테고리 · 잔여"(진한 회색), 소비기한·포장·최소 수량·등록 시각은 목록에서 뺌(상세에는 그대로) */}
                    <div className="mt-0.5" style={{ fontSize: rem(14), color: "#374151" }}>
                      {d.category} · 잔여 {d.remaining_qty}{d.quantity_unit || "개"}
                    </div>
                    {/* 2026-10-03 A안: 비회원 홈(예시 포함) — 가격 자리에 "-N% · 회원가 보기" */}
                    <div className="mt-1.5">
                      {isNegotiable(d) ? (
                        <NegotiablePrice color={color.text} className="text-lg" />
                      ) : (
                        <MemberPriceTeaser discountPct={discountPct} color={color.text} className="text-lg" />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {isExample && (
            <p className="text-xs text-gray500 mt-2.5 text-center leading-relaxed">
              지금 가입하면 이런 특가를 실제로 가장 먼저 알려드려요 🔔
            </p>
          )}
        </div>
      )}

      {/* 카카오톡 채널 추가 — 저관여 위치. 매물(가치)을 먼저 보여준 뒤 배치해서
          상단의 핵심 가입 CTA와 시각적으로 경쟁하지 않게 함. */}
      <div className="px-5 pt-6">
        <KakaoChannelButton />
      </div>

      {/* 보조 CTA — 스크롤 영역 안, 메인 CTA는 하단에 고정.
          위계: 둘러보기(텍스트 링크) < 정보성(고스트 pill) < 구매 등록(아웃라인) < 판매 등록(틴트+강조)
          — 판매 등록(공급 유입)이 플랫폼 성립의 병목이라 시각적으로 가장 강조.
          정보성 pill을 맨 아래 두면 하단 고정 CTA(무료 알림받기, 총 높이 약 160px)에
          가려질 수 있어 액션 카드보다 위로 옮기고, 안전 여백도 108→132px로 늘림. */}
      <div className="mt-9 px-5 flex flex-col gap-3">
        <Link
          href="/deals"
          className="text-center text-sm font-bold text-gray500 underline underline-offset-4"
        >
          오늘 등록된 매물 전체 보기 →
        </Link>

        {/* design-v2: 배경 틴트를 빼고 화이트로 — 주황 테두리/서브텍스트가 틴트 위에서
            흐릿해지던 문제 수정. 서브텍스트는 이모지 폭(24px)만큼 들여써서 타이틀 본문과
            세로로 맞춤. 아래 구매 카드와 텍스트 크기(16px/900)를 통일해 짝 패턴으로 정리. */}
        <Link
          href="/sell"
          className="flex items-center justify-between rounded-2xl mt-1"
          style={{ background: "#fff", border: "2px solid #FF6F0F", padding: "16px 20px" }}
        >
          <div>
            <div className="text-base font-black text-navy">
              <span className="inline-block" style={{ width: 24 }}>📦</span>
              잠든 재고, 깨워서 현금으로
            </div>
            <div className="text-xs font-bold mt-0.5" style={{ color: "#E25100", marginLeft: 24 }}>
              판매 등록은 무료 · 지금 등록하기
            </div>
          </div>
          <span className="text-xl" style={{ color: "#FF6F0F" }}>→</span>
        </Link>

        <Link
          href="/buy"
          className="flex items-center gap-3 rounded-2xl bg-white border border-gray200"
          style={{ padding: "14px 20px" }}
        >
          <img
            src="/images/manager.png"
            alt="점핑매니저"
            className="w-16 h-16 rounded-xl object-contain bg-gray100 flex-shrink-0"
          />
          <div>
            <div className="text-base font-black text-navy">
              <span className="inline-block" style={{ width: 24 }}>🔍</span>
              이런 상품 찾습니다
            </div>
            <div className="text-xs text-gray500 mt-0.5" style={{ marginLeft: 24 }}>구매 희망 등록 →</div>
          </div>
        </Link>

        {/* 점핑 서비스 — 재고 알림(이 앱의 유일한 역할)과 무관한 별도
            서비스라, 메인 재고 흐름과 섞이지 않게 하단에 별도 구역으로 분리.
            2026-09-28: "점프엑스 생태계 서비스"는 덤핑점핑 화면에 다른 법인/
            플랫폼 이름이 불쑥 등장해 브랜드 혼선을 줘서 "점핑 서비스"로 변경
            (기존 "점핑매니저"/"점핑파트너" 네이밍 컨벤션과 통일).
            타일 3개(화물배차/계산기/정부지원금)는 마이페이지와 마크업이 완전히
            겹쳐서 <EcosystemGrid />로 추출함 (2026-09-26) — 여기선 라벨/구분선만
            홈 전용으로 유지. */}
        <div id={SERVICES_ANCHOR_ID} className="mt-3 pt-4" style={{ borderTop: "1px solid #EEF0F2", scrollMarginTop: 12 }}>
          <div className="mb-2.5" style={SECTION_TITLE_STYLE}>점핑 서비스</div>
          <EcosystemGrid />
        </div>
        {/* 2026-09-30 (커밋 D): 사업자 정보 푸터 — English(/en) 링크도 푸터 링크 줄로 이동 */}
        {/* 2026-10-01: 회색 배경을 폭 전체에(-mx-5), 고정 CTA 높이만큼 푸터 아래 여백 */}
        <BusinessFooter className="-mx-5 mt-6" bottomSpace={FLOATING_CTA_SPACE} />
      </div>

      {/* 메인 CTA — 항상 화면 하단에 고정.
          2026-09-27: 이 페이지에서 비회원 전환수단이 이 CTA 하나뿐이라(당근 "글쓰기"처럼
          보조 액션이 아님) FAB로 축소하진 않되, 패딩/그림자를 줄여 무게감만 낮춤.
          완전 불투명 흰 배경 대신 옅은 반투명+블러로 바꾸고, 바로 위에 페이드를 얹어
          스크롤 중인 매물 리스트가 CTA 아래로 자연스럽게 이어지도록 함. */}
      {/* 2026-09-29: 공용 하단 고정 버튼 — 판·블러 없이 버튼만 띄움 */}
      <FloatingCTA>
          <Link
            href="/signup"
            className={FLOATING_CTA_BUTTON_CLASS}
            style={floatingCtaButtonStyle()}
          >
            🔔 덤핑매물 무료 알림받기
          </Link>
              </FloatingCTA>
    </main>
    )}
    </SplashScreen>
  );
}
