"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockCategories, mockDeals, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatPrice, formatRelativeTime } from "@/lib/format";
import SplashScreen from "@/components/SplashScreen";
import OnboardingIntro from "@/components/OnboardingIntro";
import InstallAppButton, { useInstallPrompt } from "@/components/InstallAppButton";
import KakaoChannelButton from "@/components/KakaoChannelButton";
import CategoryScroller from "@/components/CategoryScroller";
import EcosystemGrid from "@/components/EcosystemGrid";
import AlertInboxHome from "@/components/AlertInboxHome";

const TODAY_BADGE_THRESHOLD = 5; // 이보다 적으면 "오늘 N건" 배너를 아예 숨김 (빈약한 숫자 노출 방지)
const BUSINESS_COUNT_THRESHOLD = 30; // 이보다 적으면 사업자 수 대신 무숫자 카피로 대체 (빈약한 숫자 노출 방지)

const EXAMPLE_DEALS = mockDeals.filter((d) => d.status !== "closed").slice(0, 3);

export default function Home() {
  const [todayCount, setTodayCount] = useState(0);
  const [businessCount, setBusinessCount] = useState(0);
  const [preview, setPreview] = useState<Deal[]>(EXAMPLE_DEALS);
  const [isExample, setIsExample] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [signupPending, setSignupPending] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  // 2026-09-27: 로고 바운스(animate-logo-jump)가 스플래시(1.8초)와 동시에
  // 마운트돼 화면에 드러날 일 없이 가려진 채로 끝나던 버그 — 스플래시가
  // 실제로 사라지는 시점(onFinish)에야 애니메이션 클래스를 붙이도록 지연.
  // OnboardingIntro(첫 방문자 화면)의 자체 로고도 같은 문제라 이 값을 그대로 전달.
  const [logoAnimate, setLogoAnimate] = useState(false);
  const { canInstall, promptInstall } = useInstallPrompt();

  const dismissInstallBanner = () => {
    try {
      localStorage.setItem("dj_install_banner_dismissed", "1");
    } catch {}
    setInstallDismissed(true);
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setIsMember(!!data.session?.user);
    });
  }, []);

  useEffect(() => {
    try {
      setSignupPending(localStorage.getItem("dj_signup_pending") === "1");
      setInstallDismissed(localStorage.getItem("dj_install_banner_dismissed") === "1");
    } catch {}
  }, []);

  // 2026-09-27: 신뢰 지표용 인증 사업자 수 — 개인정보 없이 숫자만 내려주는
  // 공개 API(/api/public-stats)에서 가져옴 (members 테이블 RLS는 본인만 조회 가능).
  useEffect(() => {
    fetch("/api/public-stats")
      .then((res) => res.json())
      .then((data) => setBusinessCount(data.businessCount ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return; // 데모 모드: 예시 매물 그대로 노출

    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [{ count }, { data: previewData }] = await Promise.all([
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("created_at", todayStart.toISOString()),
        supabase
          .from("deals")
          .select(
            "id, title, deal_price, original_price, total_qty, remaining_qty, closes_at, created_at, location, images, package_unit, min_order_qty, quantity_unit, categories(name), regions(name)"
          )
          .eq("status", "active")
          .gt("closes_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      setTodayCount(count ?? 0);
      if (previewData && previewData.length > 0) {
        setPreview(
          previewData.map((d) => ({
            id: d.id,
            title: d.title,
            category: (d.categories as unknown as { name: string } | null)?.name ?? "기타",
            region: (d.regions as unknown as { name: string } | null)?.name ?? "",
            location: d.location ?? "",
            original_price: d.original_price,
            deal_price: d.deal_price,
            total_qty: d.total_qty,
            remaining_qty: d.remaining_qty,
            closes_at: d.closes_at,
            created_at: d.created_at,
            images: d.images ?? [],
            package_unit: d.package_unit ?? null,
            min_order_qty: d.min_order_qty ?? null,
            quantity_unit: d.quantity_unit ?? null,
          }))
        );
        setIsExample(false);
      }
      // 실제 매물이 아직 없으면 예시(EXAMPLE_DEALS)를 그대로 보여줘서
      // "이런 특가 알림이 온다"는 감을 주고, 빈 화면으로 밋밋해지는 걸 막습니다.
    })();
  }, []);

  return (
    <SplashScreen onFinish={() => setLogoAnimate(true)}>
    <OnboardingIntro logoAnimate={logoAnimate} />
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
          <span style={{ color: "#5EEAD4", fontSize: 11 }}>✔</span>
          <span className="font-bold text-white/90" style={{ fontSize: 11 }}>
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
        <h1 className="font-display leading-snug drop-shadow-sm break-keep" style={{ fontSize: 24 }}>
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

      <div className="pt-5">
        <div className="px-5 text-lg font-bold text-navy mb-3">어떤 상품을 찾고 계세요?</div>
        {/* 3x3 그리드(약 300px)가 히어로 직후 화면 절반을 차지해 실제 매물 미리보기가
            스크롤 없이 안 보이던 문제 — 가로 스크롤 칩 한 줄로 축소. 카테고리 구분은
            여전히 아이콘 배지 색상만으로(카드 배경은 통일). */}
        <div className="relative">
          <CategoryScroller className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
            {mockCategories.map((c) => {
              const color = categoryColors[c];
              return (
                <Link
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
                </Link>
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
      {canInstall && !installDismissed && (
        <div className="px-5 pt-5">
          {/* 2026-09-27: 배너가 전체폭을 다 써서 주목도가 과하다는 피드백 — 폭을
              절반 정도로 줄이고, 부담 없이 넘길 수 있게 닫기(X) 버튼을 추가. */}
          <div
            className="rounded-2xl px-4 py-3.5 relative"
            style={{ border: "2px solid rgba(255,111,15,0.35)", maxWidth: "58%" }}
          >
            <button
              type="button"
              onClick={dismissInstallBanner}
              aria-label="닫기"
              className="absolute flex items-center justify-center"
              style={{ top: 6, right: 6, width: 20, height: 20, color: "#B8BFC7", fontSize: 13, lineHeight: 1 }}
            >
              ✕
            </button>
            <div className="pr-4">
              <InstallAppButton canInstall={canInstall} promptInstall={promptInstall} />
            </div>
          </div>
        </div>
      )}

      {/* 매물 예시 — 실제 매물이 있으면 실제로, 없으면 예시로 "이런 특가가 온다"는 감을 줌 */}
      {preview.length > 0 && (
        <div className="px-5 pt-8">
          <div className="flex items-center gap-1.5 mb-3.5">
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
              const discountPct = d.original_price
                ? Math.round(((d.original_price - d.deal_price) / d.original_price) * 100)
                : 0;
              return (
                <Link
                  key={d.id}
                  href={isExample ? "/signup" : `/deals/${d.id}`}
                  className="relative flex items-center gap-3 rounded-2xl border border-gray200 px-3.5 py-3 overflow-hidden active:scale-[0.98] transition-transform"
                >
                  {discountPct > 0 && (
                    // 2026-09-27 (재검토): 브랜드 색(레드) 통일성을 유지하기 위해 주황
                    // 계열로 되돌리되, CTA와 헷갈리지 않도록 형태(코너 리본 → 필)와
                    // 채도/투명도를 낮춰 "정보 배지"로만 읽히게 구분.
                    <div
                      className="absolute top-2 right-2 text-xs font-black text-white px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(226,81,0,0.72)" }}
                    >
                      -{discountPct}%
                    </div>
                  )}
                  <div
                    className="w-14 h-14 rounded-token flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden"
                    style={{ background: color.bg }}
                  >
                    {d.images && d.images.length > 0 ? (
                      <img
                        src={d.images[0]}
                        alt={d.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      categoryIcons[d.category] ?? "🗂️"
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-10">
                    <div className="text-sm font-bold text-navy truncate">{d.title}</div>
                    <div className="text-xs text-gray500 mt-0.5">
                      {d.category} · {d.location}
                      {d.package_unit && ` · ${d.package_unit}`}
                    </div>
                    {/* 2026-09-27: 동종업계 문자광고(가격/출고지/물량단위/최소주문 등을
                        항상 함께 표기)를 벤치마킹 — 상세페이지엔 이미 있던 최소주문
                        수량을 미리보기 카드에도 노출해 구매 결정에 필요한 정보 밀도를 높임. */}
                    <div className="text-[11px] text-gray500 mt-0.5 flex items-center gap-1.5">
                      <span>{d.remaining_qty}/{d.total_qty} 남음</span>
                      {d.min_order_qty && (
                        <>
                          <span>·</span>
                          <span>최소 {d.min_order_qty}{d.quantity_unit || "개"}</span>
                        </>
                      )}
                      {formatRelativeTime(d.created_at) && (
                        <>
                          <span>·</span>
                          <span>{formatRelativeTime(d.created_at)}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="text-lg font-black" style={{ color: color.text }}>
                        {formatPrice(d.deal_price)}
                      </span>
                      <span className="text-xs text-gray500 line-through">
                        {formatPrice(d.original_price)}
                      </span>
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
      <div className="mt-9 px-5 flex flex-col gap-3" style={{ paddingBottom: "132px" }}>
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

        {/* 점프엑스 생태계 서비스 — 재고 알림(이 앱의 유일한 역할)과 무관한 별도
            서비스라, 메인 재고 흐름과 섞이지 않게 하단에 별도 구역으로 분리.
            타일 3개(화물배차/계산기/정부지원금)는 마이페이지와 마크업이 완전히
            겹쳐서 <EcosystemGrid />로 추출함 (2026-09-26) — 여기선 라벨/구분선만
            홈 전용으로 유지. */}
        <div className="mt-3 pt-4" style={{ borderTop: "1px solid #EEF0F2" }}>
          <div className="text-xs font-bold text-gray500 mb-2">점프엑스 생태계 서비스</div>
          <EcosystemGrid />
        </div>
      </div>

      {/* 메인 CTA — 항상 화면 하단에 고정.
          2026-09-27: 이 페이지에서 비회원 전환수단이 이 CTA 하나뿐이라(당근 "글쓰기"처럼
          보조 액션이 아님) FAB로 축소하진 않되, 패딩/그림자를 줄여 무게감만 낮춤.
          완전 불투명 흰 배경 대신 옅은 반투명+블러로 바꾸고, 바로 위에 페이드를 얹어
          스크롤 중인 매물 리스트가 CTA 아래로 자연스럽게 이어지도록 함. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-5 pt-5"
        style={{ bottom: "64px" }}
      >
        <div
          className="pointer-events-none absolute left-0 right-0"
          style={{
            bottom: "100%",
            height: 28,
            background: "linear-gradient(to bottom, rgba(245,246,248,0), rgba(255,255,255,.85))",
          }}
        />
        <div
          className="rounded-2xl"
          style={{
            background: "rgba(255,255,255,.9)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 -6px 16px rgba(11,37,64,.07)",
            padding: 8,
          }}
        >
          <Link
            href="/signup"
            className="block text-white text-center font-bold rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #E25100, #FF6F0F)",
              padding: "15px 0",
              fontSize: "17px",
              boxShadow: "0 4px 14px rgba(226,81,0,0.28)",
            }}
          >
            🔔 덤핑매물 무료 알림받기
          </Link>
        </div>
      </div>
    </main>
    )}
    </SplashScreen>
  );
}
