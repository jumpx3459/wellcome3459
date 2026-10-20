import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이런 상품 찾습니다",
  description: "지금 구매자가 찾는 재고 목록. 보유한 재고가 있으면 공급 가능해요를 눌러 등록하면 점핑매니저가 연결해드립니다.",
};

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
