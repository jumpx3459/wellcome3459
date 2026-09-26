"use client";

import { useEffect, useState } from "react";

// 긴급성 로테이션 카피 — 원래 deals/page.tsx 헤더 전용이었던 걸 buy/홈(게스트+회원)/
// 마이페이지/signup까지 5개 화면(=하단 탭 5개 전부)에 동일 문구로 노출해 각인
// 효과를 주기 위해 공유 컴포넌트로 추출 (2026-09-26). 폰트도 기존 text-sm(14px)에서
// 잘 안 읽힌다는 피드백을 반영해 text-base(16px)로 키움.
export const ROTATING_TAGS = ["⏰ 기한임박 매물", "📦 과잉재고 정리", "🏭 폐업 정리 매물", "🔍 긴급 소싱 매칭"];

export default function RotatingUrgencyTag({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const [tagIndex, setTagIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTagIndex((i) => (i + 1) % ROTATING_TAGS.length), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      key={tagIndex}
      className={`text-base font-black py-2 -my-2 whitespace-nowrap animate-onboarding-step ${className}`}
      style={style}
    >
      {ROTATING_TAGS[tagIndex]}
    </div>
  );
}
