import type { MetadataRoute } from "next";
import { SITE_URL as BASE_URL } from "@/lib/siteUrl";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/mypage"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
