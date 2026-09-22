import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인 | 덤핑점핑",
  description: "가입할 때 인증했던 휴대폰 번호로 인증번호만 받으면 바로 로그인됩니다.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
