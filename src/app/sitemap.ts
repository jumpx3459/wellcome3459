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

  const { data } = await supabase
    .from("deals")
    .select("id, created_at")
    .eq("status", "active")
    .gt("closes_at", new Date().toISOString());

  const dealRoutes: MetadataRoute.Sitemap = (data ?? []).map((d) => ({
    url: `${BASE_URL}/deals/${d.id}`,
    lastModified: d.created_at ? new Date(d.created_at) : undefined,
    changeFrequency: "hourly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...dealRoutes];
}
