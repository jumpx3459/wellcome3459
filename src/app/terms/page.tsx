import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "서비스 이용약관",
  description: "덤핑점핑 서비스 이용약관입니다.",
};

// 2026-09-30: 페이지 틀만 — 약관 본문은 대표가 따로 전달(시행 2026-10-07, TERMS_VERSION과 맞출 것).
// 가입·재동의 시트의 [필수] 서비스 이용약관 "보기"가 이 페이지로 연결됨.
export default function TermsPage() {
  return (
    <main className="min-h-screen px-5 py-8">
      <h1 className="font-display text-2xl text-navy mb-6">서비스 이용약관</h1>
      <section className="flex flex-col gap-5 text-sm text-gray900 leading-relaxed">{/* 약관 본문 */}</section>
    </main>
  );
}
