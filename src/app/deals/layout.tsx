import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "지금 놓치면 마감 · 덤핑매물 알림 리스트",
  description:
    "수산·축산물부터 생활용품, 산업원자재까지 전국 B2B 덤핑 재고 특가를 실시간 카운트다운과 함께 확인하세요.",
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
