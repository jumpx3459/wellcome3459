"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockCategories, mockDeals, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatPrice } from "@/lib/format";
import SplashScreen from "@/components/SplashScreen";
import OnboardingIntro from "@/components/OnboardingIntro";
import InstallAppButton from "@/components/InstallAppButton";
import KakaoChannelButton from "@/components/KakaoChannelButton";
import CategoryScroller from "@/components/CategoryScroller";
import AlertInboxHome from "@/components/AlertInboxHome";

const TODAY_BADGE_THRESHOLD = 5; // 이보다 적으면 "오늘 N건" 배너를 아예 숨김 (빈약한 숫자 노출 방지)

function formatRelativeTime(iso?: string | null) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 등록";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  return `${day}일 전`;
}

const EXAMPLE_DEALS = mockDeals.filter((d) => d.status !== "closed").slice(0, 3);

export default function Home() {
  const [todayCount, setTodayCount] = useState(0);
  const [preview, setPreview] = useState<Deal[]>(EXAMPLE_DEALS);
  const [isExample, setIsExample] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [signupPending, setSignupPending] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setIsMember(!!data.session?.user);
    });
  }, []);

  useEffect(() => {
    try {
      setSignupPending(localStorage.getItem("dj_signup_pending") === "1");
    } catch {}
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
            "id, title, deal_price, original_price, total_qty, remaining_qty, closes_at, created_at, location, images, categories(name), regions(name)"
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
          }))
        );
        setIsExample(false);
      }
      // 실제 매물이 아직 없으면 예시(EXAMPLE_DEALS)를 그대로 보여줘서
      // "이런 특가 알림이 온다"는 감을 주고, 빈 화면으로 밋밋해지는 걸 막습니다.
    })();
  }, []);

  return (
    <SplashScreen>
    <OnboardingIntro />
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
      <AlertInboxHome />
    ) : (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-4 pb-4 text-white"
        style={{ background: "linear-gradient(135deg, #0B2540, #1B3A5C)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="bg-white rounded-xl px-3 py-2 inline-block">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto animate-logo-jump" />
          </div>
          <span className="text-white/70 text-sm tracking-wide self-end mb-1">
            Powered by JumpX
          </span>
        </div>

        {/* 신뢰 지표 — 실제 IR 확인 수치만 표기 */}
        <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 mb-4">
          <span style={{ color: "#5EEAD4" }}>✔</span>
          <span className="text-xs font-bold text-white/90">
            890명+ 덤핑재고 알림 받는 중
            {todayCount > 0 && ` · 오늘 등록 ${todayCount}건`}
          </span>
        </div>

        <h1 className="font-display text-xl leading-snug drop-shadow-sm">
          <span style={{ color: "#FF6F0F" }}>남는 재고는 빠르게 알리고,</span> 급한 재고는 남보다 먼저 잡으세요.
        </h1>
        <p className="text-white/85 text-base mt-4 leading-relaxed">
          <span className="hidden sm:inline">
            전국의 임박·과잉·폐업·재고처분 매물을 찾아 원하는 상품이 나오면 가장 먼저 알려드립니다.
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
        <div className="px-5 text-lg font-bold text-navy mb-3">어떤 재고를 찾고 계세요?</div>
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
      <div className="px-5 pt-5">
        <div className="rounded-2xl border-2 border-gray200 px-4 py-3.5">
          <InstallAppButton />
        </div>
      </div>

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
                    <div
                      className="absolute top-0 right-0 text-sm font-black text-white px-3 py-1.5 rounded-bl-2xl"
                      style={{ background: "linear-gradient(135deg, #E25100, #FF6F0F)" }}
                    >
                      -{discountPct}%
                    </div>
                  )}
                  <div
                    className="w-14 h-14 rounded-token flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: color.bg }}
                  >
                    {categoryIcons[d.category] ?? "🗂️"}
                  </div>
                  <div className="flex-1 min-w-0 pr-10">
                    <div className="text-sm font-bold text-navy truncate">{d.title}</div>
                    <div className="text-xs text-gray500 mt-0.5">
                      {d.category} · {d.location}
                    </div>
                    <div className="text-[11px] text-gray400 mt-0.5 flex items-center gap-1.5">
                      <span>{d.remaining_qty}/{d.total_qty} 남음</span>
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

        <div className="flex items-center justify-center py-3" style={{ borderTop: "1px solid #EEF0F2", borderBottom: "1px solid #EEF0F2" }}>
          <Link href="/support" className="flex items-center gap-1 text-xs font-bold text-gray500">
            🏛️ 정부지원금
          </Link>
        </div>

        <Link
          href="/sell"
          className="flex items-center justify-between rounded-2xl mt-1"
          style={{ background: "rgba(255,111,15,0.10)", border: "2px solid #FF6F0F", padding: "16px 20px" }}
        >
          <div>
            <div className="text-base font-black text-navy">📦 잠든 재고, 깨워서 현금으로</div>
            <div className="text-xs font-bold mt-0.5" style={{ color: "#E25100" }}>
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
            className="w-14 h-14 rounded-xl object-contain bg-gray100 flex-shrink-0"
          />
          <div>
            <div className="text-sm font-bold text-navy">🔍 이런 재고 찾습니다</div>
            <div className="text-xs text-gray500 mt-0.5">구매 희망 등록 →</div>
          </div>
        </Link>

        {/* 점프엑스 생태계 서비스 — 재고 알림(이 앱의 유일한 역할)과 무관한 별도
            서비스라, 메인 재고 흐름과 섞이지 않게 하단에 별도 구역으로 분리.
            전국 화물 배차: 매물(스팟성)과 달리 상시 반복 수요라 재방문을 만드는
            리텐션 훅이지만, 판매/구매("매물 등록" 계열)와는 성격이 달라서 톤도
            네이비/블루로 분리. */}
        <div className="mt-3 pt-4" style={{ borderTop: "1px solid #EEF0F2" }}>
          <div className="text-xs font-bold text-gray500 mb-2">점프엑스 생태계 서비스</div>
          <Link
            href="/logistics"
            className="flex items-center justify-between rounded-2xl"
            style={{ background: "rgba(11,37,64,0.06)", border: "2px solid #1B3A5C", padding: "16px 20px" }}
          >
            <div>
              <div className="text-base font-black text-navy">🚚 전국 화물 배차 신청</div>
              <div className="text-xs font-bold mt-0.5" style={{ color: "#1B3A5C" }}>
                배차는 언제든 3분 컷 · 지금 신청하기
              </div>
            </div>
            <span className="text-xl" style={{ color: "#1B3A5C" }}>→</span>
          </Link>
        </div>
      </div>

      {/* 메인 CTA — 항상 화면 하단에 고정 */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-6 pt-3 bg-white"
        style={{ boxShadow: "0 -8px 20px rgba(11,37,64,0.08)", bottom: "64px" }}
      >
        <Link
          href="/signup"
          className="block text-white text-center font-bold rounded-2xl shadow-lg"
          style={{
            background: "linear-gradient(135deg, #E25100, #FF6F0F)",
            padding: "20px 0",
            fontSize: "19px",
            boxShadow: "0 10px 24px rgba(226,81,0,0.35)",
          }}
        >
          🔔 무료 알림받기
        </Link>
      </div>
    </main>
    )}
    </SplashScreen>
  );
}
