import type { Metadata } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals } from "@/lib/mockData";
import { discountPercent } from "@/lib/dealFields";

const GUEST_DESCRIPTION = "회원가 공개 · 덤핑점핑";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let name = "덤핑매물 상세";
  let description = "B2B 덤핑 재고 특가 정보를 지금 확인하세요.";
  // 2026-10-03 A안: 공유 미리보기·검색 결과에 가격 없음 — 이 서버 조회는 항상 비회원(anon)이라 가격 칸을 select하지 않고
  // DB 할인율(deals.discount_pct)만. 제목 = "매물명 · N% ↓"(할인율 없으면 매물명만)
  let discountPct: number | null = null;
  let image: string | null = null;

  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from("deals")
      .select("title, description, discount_pct, images")
      .eq("id", id)
      .single();
    if (data) {
      name = data.title;
      description = data.description || GUEST_DESCRIPTION;
      discountPct = data.discount_pct ?? null;
      image = data.images?.[0] ?? null;
    }
  } else {
    const deal = mockDeals.find((d) => d.id === id);
    if (deal) {
      name = deal.title;
      description = GUEST_DESCRIPTION;
      discountPct = discountPercent(deal.original_price, deal.deal_price);
      image = deal.images?.[0] ?? null;
    }
  }

  const ogTitle = discountPct && discountPct > 0 ? `${name} · ${discountPct}% ↓` : name;
  const title = `${ogTitle} | 덤핑점핑`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function DealDetailLayout({ children }: Props) {
  return children;
}
