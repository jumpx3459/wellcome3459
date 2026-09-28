"use client";

import { useEffect } from "react";

// 루트 layout이 <html lang="ko">로 고정이라(경로별로 바꾸려면 모든 페이지가 동적 렌더링이 되거나
// 라우트 구조를 전부 옮겨야 함) /en에서는 콘텐츠를 <div lang="en">으로 감싸고, 여기서 html lang도
// 맞춰준다. 다른 화면으로 이동하면 원래 값(ko)으로 되돌림.
export default function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.lang;
    root.lang = lang;
    return () => {
      root.lang = prev || "ko";
    };
  }, [lang]);
  return null;
}
