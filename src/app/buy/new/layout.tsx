import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "구매 희망 재고 등록",
  description: "찾는 물건과 조건만 남기면 점핑매니저가 맞는 판매자를 직접 찾아드립니다.",
};

export default function BuyNewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
