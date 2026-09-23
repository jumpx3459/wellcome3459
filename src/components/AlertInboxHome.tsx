"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals, categoryIcons, categoryColors, mockRegions, type Deal } from "@/lib/mockData";
import { formatPrice } from "@/lib/format";
import { formatCountdown } from "@/lib/format";
import InstallAppButton, { useInstallPrompt } from "@/components/InstallAppButton";
import Toast, { useToast } from "@/components/Toast";

const INSTALL_DISMISS_KEY = "dj_home_install_dismissed";
const ALERT_EXAMPLE_THRESHOLD = 5; // 실제 매칭 매물이 이보다 적을 때만 예시 섹션 노출
const EXAMPLE_DEALS = mockDeals.filter((d) => d.status !== "closed").slice(0, 4);

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

export default function AlertInboxHome() {
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showInstall, setShowInstall] = useState(true);
  const { canInstall } = useInstallPrompt();
  const [, setTick] = useState(0);
  const { message: toastMessage, showToast } = useToast();

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
      return;
    }
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const [{ data: catRows }, { data: regRows }, { data: dealRows }] = await Promise.all([
        supabase.from("member_categories").select("categories(name)").eq("member_id", userId),
        supabase.from("member_regions").select("regions(name)").eq("member_id", userId),
        supabase
          .from("deals")
          .select(
            "id, title, deal_price, original_price, total_qty, remaining_qty, closes_at, created_at, location, images, video_url, categories(name), regions(name)"
          )
          .eq("status", "active")
          .gt("closes_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

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
          location: d.location ?? "",
          original_price: d.original_price,
          deal_price: d.deal_price,
          total_qty: d.total_qty,
          remaining_qty: d.remaining_qty,
          closes_at: d.closes_at,
          created_at: d.created_at,
          images: d.images ?? [],
          video_url: d.video_url ?? null,
        }))
      );
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
  const estAlertsWide = Math.max(2, categories.length * 4 + (regions.length === 0 ? 6 : regions.length * 2)) + 14;

  const matches = (d: Deal) =>
    categories.length > 0 && categories.includes(d.category) && (regions.length === 0 || regions.includes(d.region));

  const [viewer, setViewer] = useState<{ images: string[]; video: string | null; index: number } | null>(null);

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
      <div className="sticky top-0 z-10 bg-white" style={{ borderBottom: "1px solid #EEF0F2" }}>
        <div className="flex items-center justify-between" style={{ padding: "16px 20px 12px" }}>
          <div className="flex items-center gap-2">
            <img src="/images/logo.png" alt="덤핑점핑" style={{ height: 22, width: "auto" }} />
            <span className="font-black" style={{ fontSize: 17, color: "#0B2540", letterSpacing: "-0.02em" }}>
              알림함
            </span>
          </div>
          <button
            onClick={() => showToast("전부 읽음으로 처리했어요")}
            className="rounded-full font-bold"
            style={{ background: "#F5F6F8", border: "none", fontSize: 11.5, color: "#6B7480", padding: "7px 12px" }}
          >
            읽음 처리
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 20px 2px" }}>
        <Link
          href="/sell"
          className="flex items-center justify-between rounded-xl"
          style={{ background: "rgba(255,111,15,0.10)", border: "1.5px solid #FF6F0F", padding: "13px 16px" }}
        >
          <span className="text-sm font-bold text-navy">📦 잠든 재고, 깨워서 현금으로</span>
          <span className="text-sm font-bold" style={{ color: "#FF6F0F" }}>무료 등록 →</span>
        </Link>
      </div>

      <Link
        href="/mypage#alerts"
        className="flex items-center gap-2 w-full text-left"
        style={{ borderBottom: "1px solid #F1F3F5", padding: "9px 20px" }}
      >
        <span style={{ fontSize: 12 }}>⚙️</span>
        <span className="flex-1 min-w-0 truncate" style={{ fontSize: 11.5, color: "#6B7480" }}>{myCondText}</span>
        <span className="flex-shrink-0 font-bold" style={{ fontSize: 11, color: "#E25100" }}>조건 수정</span>
      </Link>

      {showInstall && canInstall && (
        <div className="flex items-center gap-2.5" style={{ borderBottom: "1px solid #F1F3F5", padding: "12px 20px", background: "#FAFBFC" }}>
          <div className="flex-1 min-w-0">
            <InstallAppButton />
          </div>
          <button onClick={dismissInstall} className="flex-shrink-0" style={{ border: "none", background: "none", color: "#9AA3AD", fontSize: 16, width: 28, height: 28 }}>
            ×
          </button>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label}>
          <div className="flex items-center gap-2" style={{ padding: "18px 20px 9px" }}>
            <span className="font-black" style={{ fontSize: 12, color: "#0B2540", letterSpacing: "0.02em" }}>{g.label}</span>
            <span className="flex-1" style={{ height: 1, background: "#EEF0F2" }} />
            <span className="font-mono font-bold" style={{ fontSize: 11, color: "#6B7480" }}>{g.items.length}건</span>
          </div>
          {g.items.map((d) => {
            const match = matches(d);
            const color = categoryColors[d.category] ?? categoryColors["기타"];
            const cd = formatCountdown(d.closes_at);
            const pct = d.original_price ? Math.round(((d.original_price - d.deal_price) / d.original_price) * 100) : 0;
            return (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="block w-full text-left"
                style={{ borderBottom: "1px solid #F1F3F5", padding: "14px 20px", background: match ? "#FFFCF8" : "#fff" }}
              >
                <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
                  <span
                    className="font-black rounded"
                    style={{ fontSize: 10.5, padding: "3px 8px", background: match ? "#FDEEE8" : "#F1F3F5", color: match ? "#E25100" : "#6B7480" }}
                  >
                    {match ? "내 조건 매칭" : "추천"}
                  </span>
                  <span style={{ fontSize: 11, color: "#6B7480" }}>{d.location}</span>
                  <span className="font-mono font-bold ml-auto" style={{ fontSize: 11, color: cd.urgent ? "var(--color-urgent)" : "#6B7480" }}>
                    ⏱ {cd.label}
                  </span>
                </div>
                <div className={wideLayout ? "flex flex-col gap-2.5" : "flex items-start gap-2.5"}>
                  {d.images && d.images.length > 0 ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => openViewer(e, d.images!, d.video_url ?? null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openViewer(e as unknown as React.MouseEvent, d.images!, d.video_url ?? null);
                      }}
                      className="relative rounded-xl overflow-hidden flex-shrink-0"
                      style={
                        wideLayout
                          ? { width: "100%", aspectRatio: "16/9" }
                          : { width: 64, height: 64 }
                      }
                    >
                      <img src={d.images[0]} alt={d.title} className="w-full h-full object-cover" />
                      {d.video_url && (
                        <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,.25)" }}>
                          <span style={{ fontSize: wideLayout ? 32 : 18, color: "#fff" }}>▶</span>
                        </span>
                      )}
                      {d.images.length > 1 && (
                        <span className="absolute bottom-1 right-1 rounded font-bold text-white" style={{ fontSize: 10, padding: "1px 5px", background: "rgba(0,0,0,.5)" }}>
                          1/{d.images.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span
                      className="rounded-xl flex items-center justify-center flex-shrink-0"
                      style={wideLayout ? { width: "100%", height: 120, fontSize: 32, background: color.bg } : { width: 64, height: 64, fontSize: 22, background: color.bg }}
                    >
                      {categoryIcons[d.category] ?? "🗂️"}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold leading-snug" style={{ fontSize: 14.5, color: "#1A1F26" }}>{d.title}</span>
                    <span className="block mt-0.5" style={{ fontSize: 11.5, color: "#6B7480" }}>
                      {d.category} · {d.location} · 잔여 {d.remaining_qty}
                    </span>
                    <span className="flex items-baseline gap-1.5 mt-1.5">
                      {pct > 0 && (
                        <span className="font-black text-white rounded" style={{ fontSize: 10.5, padding: "2px 6px", background: "#E25100" }}>
                          -{pct}%
                        </span>
                      )}
                      <span className="font-black" style={{ fontSize: 17, color: "#0B2540" }}>{formatPrice(d.deal_price)}</span>
                      <span style={{ fontSize: 11.5, color: "#6B7480", textDecoration: "line-through" }}>{formatPrice(d.original_price)}</span>
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ))}

      {groups.length === 0 && (
        <div className="text-center" style={{ padding: "48px 20px", color: "#6B7480", fontSize: 14 }}>
          아직 조건에 맞는 매물이 없어요. 매물이 뜨면 가장 먼저 알려드릴게요.
        </div>
      )}

      {isSupabaseConfigured && deals.length < ALERT_EXAMPLE_THRESHOLD && (
        <div>
          <div className="flex items-center gap-2" style={{ padding: "18px 20px 9px" }}>
            <span className="font-black" style={{ fontSize: 12, color: "#0B2540", letterSpacing: "0.02em" }}>이런 매물이 올라와요</span>
            <span className="flex-1" style={{ height: 1, background: "#EEF0F2" }} />
            <span className="text-[10px] font-bold text-gray500 bg-gray100 rounded-full" style={{ padding: "2px 7px" }}>예시</span>
          </div>
          {EXAMPLE_DEALS.map((d) => {
            const color = categoryColors[d.category] ?? categoryColors["기타"];
            const pct = d.original_price ? Math.round(((d.original_price - d.deal_price) / d.original_price) * 100) : 0;
            return (
              <Link key={`example-${d.id}`} href={`/deals/example-${d.id}`} className="block w-full text-left" style={{ borderBottom: "1px solid #F1F3F5", padding: "14px 20px", opacity: 0.8 }}>
                <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
                  <span className="font-black rounded" style={{ fontSize: 10.5, padding: "3px 8px", background: "#F1F3F5", color: "#6B7480" }}>예시</span>
                  <span style={{ fontSize: 11, color: "#6B7480" }}>{d.location}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {d.images && d.images.length > 0 ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ width: "100%", aspectRatio: "16/9" }}>
                      <img src={d.images[0]} alt={d.title} className="w-full h-full object-cover" />
                      {d.video_url && (
                        <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,.25)" }}>
                          <span style={{ fontSize: 30, color: "#fff" }}>▶</span>
                        </span>
                      )}
                      {d.images.length > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 rounded font-bold text-white" style={{ fontSize: 10, padding: "1px 5px", background: "rgba(0,0,0,.5)" }}>
                          1/{d.images.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="rounded-xl flex items-center justify-center" style={{ width: "100%", height: 120, fontSize: 30, background: color.bg }}>
                      {categoryIcons[d.category] ?? "🗂️"}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold leading-snug" style={{ fontSize: 14.5, color: "#1A1F26" }}>{d.title}</span>
                    <span className="block mt-0.5" style={{ fontSize: 11.5, color: "#6B7480" }}>{d.category} · {d.location}</span>
                    <span className="flex items-baseline gap-1.5 mt-1.5">
                      {pct > 0 && <span className="font-black text-white rounded" style={{ fontSize: 10.5, padding: "2px 6px", background: "#9AA3AD" }}>-{pct}%</span>}
                      <span className="font-black" style={{ fontSize: 17, color: "#6B7480" }}>{formatPrice(d.deal_price)}</span>
                      <span style={{ fontSize: 11.5, color: "#9AA3AD", textDecoration: "line-through" }}>{formatPrice(d.original_price)}</span>
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
          <p className="text-center" style={{ padding: "10px 20px 4px", fontSize: 11.5, color: "#9AA3AD" }}>
            실제 매물이 아닌 예시예요 · 매물이 등록되면 실시간으로 알려드려요
          </p>
        </div>
      )}

      <div style={{ padding: "22px 20px 30px" }}>
        <Link href="/mypage#alerts" className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#9AA3AD" }}>
            조건을 넓히면 주 {estAlertsWide}건까지 받을 수 있어요
          </span>
          <span className="text-xs font-bold flex-shrink-0" style={{ color: "#6B7480" }}>넓히기 →</span>
        </Link>
      </div>

      {viewer && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(0,0,0,.92)" }}
          onClick={() => setViewer(null)}
        >
          <button
            onClick={() => setViewer(null)}
            className="absolute top-4 right-4 text-white"
            style={{ fontSize: 28, background: "none", border: "none" }}
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
      <Toast message={toastMessage} />
    </main>
  );
}
