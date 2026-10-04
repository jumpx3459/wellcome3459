import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "무료 알림 신청",
  description:
    "관심 카테고리만 등록하면 시세보다 낮은 B2B 재고 매물을 가장 먼저 알려드립니다. 회원가입 30초면 끝나요.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
