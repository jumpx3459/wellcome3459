// 기기·브라우저 이름 (2026-10-01) — MY "이 기기: 안드로이드 크롬" 표시용. user-agent로 대략만 구분.
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  const os = /iPhone|iPad|iPod/.test(s)
    ? "아이폰"
    : /Android/.test(s)
      ? "안드로이드"
      : /Windows/.test(s)
        ? "윈도우"
        : /Macintosh|Mac OS X/.test(s)
          ? "맥"
          : /Linux/.test(s)
            ? "리눅스"
            : "";
  const browser = /SamsungBrowser/.test(s)
    ? "삼성 인터넷"
    : /KAKAOTALK/i.test(s)
      ? "카카오톡"
      : /NAVER/.test(s)
        ? "네이버"
        : /Edg\//.test(s)
          ? "엣지"
          : /Whale/.test(s)
            ? "웨일"
            : /CriOS|Chrome\//.test(s)
              ? "크롬"
              : /Firefox|FxiOS/.test(s)
                ? "파이어폭스"
                : /Safari/.test(s)
                  ? "사파리"
                  : "";
  return [os, browser].filter(Boolean).join(" ") || "이 브라우저";
}
