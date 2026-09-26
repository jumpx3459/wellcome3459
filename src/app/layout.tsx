import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { pretendard } from "@/lib/fonts";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dumpingjumping.vercel.app";
const DEFAULT_DESCRIPTION =
  "전국 B2B 덤핑 재고·이월상품·반품 특가 정보를 관심 카테고리와 지역만 등록하면 가장 먼저 알려드립니다. Powered by JumpX.";

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
    images: ["/images/logo.png"],
  },
  twitter: {
    card: "summary",
    title: "덤핑점핑 - B2B 덤핑 재고 특가 알림",
    description: DEFAULT_DESCRIPTION,
    images: ["/images/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B2540",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans overflow-x-hidden">
        {/* 앱 폭 제한 래퍼(max-w-md)는 경로별로 달라야 해서 AppShell이 그림 */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
