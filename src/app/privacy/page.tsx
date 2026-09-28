import type { Metadata } from "next";
import PrivacyBody from "./PrivacyBody";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "덤핑점핑 알림 서비스의 개인정보 수집·이용, 쿠키 사용, 이용약관을 안내합니다.",
};

// 2026-09-28: "가 크게 보기" 토글(useState)이 필요해서 실제 내용은 클라이언트
// 컴포넌트(PrivacyBody)로 분리 — metadata export는 서버 컴포넌트에서만 되므로
// 이 파일은 그대로 서버 컴포넌트로 남겨둠.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-5 py-8">
      <PrivacyBody />
    </main>
  );
}
