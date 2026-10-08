import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
// 2026-10-07: 통글자 2MB 파일 대신 글자 범위별로 쪼갠 Pretendard(92조각, 화면에 쓰인 글자 조각만 받음) — font-display: swap
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import { SITE_URL as BASE_URL } from "@/lib/siteUrl";
import { DEFAULT_OG_IMAGE } from "@/lib/ogImage";

const DEFAULT_DESCRIPTION =
  "전국 B2B 덤핑 재고·이월상품·반품 특가 정보를 관심 카테고리만 등록하면 가장 먼저 알려드립니다. Powered by JumpX.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "덤핑점핑 - B2B 덤핑 재고 특가 알림",
    template: "%s | 덤핑점핑",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: ["덤핑", "재고떨이", "이월상품", "B2B 특가", "재고매입", "반품 상품", "도매 특가", "덤핑점핑"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "덤핑점핑",
  },
  icons: {
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "덤핑점핑 - B2B 덤핑 재고 특가 알림",
    description: DEFAULT_DESCRIPTION,
    url: BASE_URL,
    siteName: "덤핑점핑",
    locale: "ko_KR",
    type: "website",
    images: [DEFAULT_OG_IMAGE], // 2026-10-08 4b-1: 1200×630(예전 logo-og.png 888×772는 카톡에서 잘림)
  },
  twitter: {
    card: "summary_large_image",
    title: "덤핑점핑 - B2B 덤핑 재고 특가 알림",
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B2540",
  width: "device-width",
  initialScale: 1,
  // 2026-09-29: iPhone 홈 화면 앱(appleWebApp statusBarStyle "black-translucent")은 화면이 상태 표시줄
  // 밑까지 그려짐 — cover로 두고 env(safe-area-inset-*)(globals.css --sat/--sab)만큼 피한다.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans overflow-x-hidden">
        {/* 앱 폭 제한 래퍼(max-w-md)는 경로별로 달라야 해서 AppShell이 그림 */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
