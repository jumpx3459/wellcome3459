import type { MetadataRoute } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { SITE_URL as BASE_URL } from "@/lib/siteUrl";


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/en`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/deals`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/support`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/sell`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/buy`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/logistics`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  if (!isSupabaseConfigured || !supabase) return staticRoutes;

  // 2026-10-27 브랜드 보호 매물(brand_protected)은 sitemap 제외 — 칸이 아직 없으면(SQL 전) 조건 없이 다시 조회
  const nowIso = new Date().toISOString();
  const first = await supabase.from("deals").select("id, created_at").eq("status", "active").gt("closes_at", nowIso).eq("brand_protected", false);
  const { data } = first.error ? await supabase.from("deals").select("id, created_at").eq("status", "active").gt("closes_at", nowIso) : first;

  const dealRoutes: MetadataRoute.Sitemap = (data ?? []).map((d) => ({
    url: `${BASE_URL}/deals/${d.id}`,
    lastModified: d.created_at ? new Date(d.created_at) : undefined,
    changeFrequency: "hourly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...dealRoutes];
}
