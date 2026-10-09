import type { Metadata } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals } from "@/lib/mockData";
import { discountPercent } from "@/lib/dealFields";
import { BASE_OPEN_GRAPH, DEFAULT_OG_IMAGE } from "@/lib/ogImage";
import { SITE_URL } from "@/lib/siteUrl";

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

  // 2026-10-08 4b-1: 여기 openGraph·twitter는 루트 값을 통째로 덮어써서, 사진 없는 매물은 og 이미지가 아예 없었음 → 기본 이미지로 명시
  const ogImages = image ? [image] : [DEFAULT_OG_IMAGE];
  return {
    title,
    description,
    // 2026-10-09 PR 4a: 공통 칸을 펼친 뒤 덮어씀 — 예전엔 og:url·og:type·siteName이 비었음. url = 이 매물의 정식 절대 주소
    openGraph: {
      ...BASE_OPEN_GRAPH,
      title,
      description,
      url: `${SITE_URL}/deals/${id}`,
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages,
    },
  };
}

export default function DealDetailLayout({ children }: Props) {
  return children;
}
