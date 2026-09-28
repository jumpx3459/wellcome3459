"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/format";
import KakaoChannelButton from "@/components/KakaoChannelButton";

// 2026-09-28: 긴급 공지(부동산·설비 처분 등) 공개 목록 — 재고 매물(deals)과는
// 완전히 별개의 가벼운 공지판이라 카드 구조도 단순함(수량/할인율 없음). 구인/구직은
// 직업안정법상 신고 요건이 부동산보다 엄격해서 법률 검토 전까지 의도적으로 제외.
type Notice = {
  id: string;
  category: string;
  title: string;
  body: string;
  images: string[] | null;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
  regions: { name: string } | null;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  부동산: { bg: "#EAF2FF", text: "#1B5FBF" },
  설비: { bg: "#FDEEE8", text: "#E25100" },
  기타: { bg: "#F0F0F2", text: "#5B6472" },
};

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from("urgent_notices")
      .select("id, category, title, body, images, contact_name, contact_phone, created_at, regions(name)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setNotices((data as unknown as Notice[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="flex flex-col min-h-screen bg-gray100" style={{ paddingBottom: 84 }}>
      <div
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
          padding: "22px 22px 24px",
        }}
      >
        <div className="text-xs font-bold tracking-widest" style={{ color: "#FFD166" }}>긴급 공지</div>
        <h1 className="font-display text-2xl mt-1.5 text-white">폐업·정리 부동산·설비 소식</h1>
        <p className="mt-2" style={{ fontSize: 13.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
          재고 매물과 별개로, 사업 정리 과정에서 나오는 공장·상가·설비 소식을 모아드려요.
        </p>
      </div>

      <div className="px-5 pt-5 flex flex-col gap-3">
        {loading && <div className="text-sm text-gray500 text-center py-8">불러오는 중...</div>}

        {!loading && notices.length === 0 && (
          <div className="text-sm text-gray500 text-center py-8 leading-relaxed">
            아직 올라온 공지가 없어요.
            <br />
            새 소식이 올라오면 마이페이지에서 알림을 켜둔 분들께 먼저 알려드려요.
          </div>
        )}

        {notices.map((n) => {
          const color = CATEGORY_COLORS[n.category] ?? CATEGORY_COLORS["기타"];
          return (
            <div key={n.id} className="bg-white rounded-2xl border border-gray200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="text-xs font-black px-2 py-0.5 rounded-full"
                  style={{ background: color.bg, color: color.text }}
                >
                  {n.category}
                </span>
                {n.regions?.name && (
                  <span className="text-xs font-bold text-gray500">{n.regions.name}</span>
                )}
                <span className="text-xs text-gray500 ml-auto">{formatRelativeTime(n.created_at)}</span>
              </div>

              {n.images && n.images.length > 0 && (
                <img
                  src={n.images[0]}
                  alt={n.title}
                  className="w-full rounded-xl object-cover mb-2.5"
                  style={{ maxHeight: 180 }}
                />
              )}

              <div className="text-base font-black text-navy">{n.title}</div>
              <p className="text-sm text-gray500 mt-1.5 whitespace-pre-line leading-relaxed">{n.body}</p>

              {(n.contact_name || n.contact_phone) && (
                <div className="mt-3 pt-3 flex items-center gap-2 text-sm" style={{ borderTop: "1px solid #EEF0F2" }}>
                  <span className="font-bold text-navy">{n.contact_name || "담당자"}</span>
                  {n.contact_phone && (
                    <a href={`tel:${n.contact_phone}`} className="font-bold" style={{ color: "var(--color-brandOrange)" }}>
                      {n.contact_phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-2">
          <KakaoChannelButton />
        </div>
      </div>
    </main>
  );
}
