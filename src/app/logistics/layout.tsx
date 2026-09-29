import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "점핑전국물류",
  description: "파렛트 적재 계산, 물류 날씨, 환율 계산 등 물류 실무에 필요한 도구를 한 곳에서 확인하세요.",
};

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
