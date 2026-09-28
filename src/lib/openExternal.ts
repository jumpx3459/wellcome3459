// 인앱 브라우저에서 현재 페이지를 외부 브라우저로 연다. 현재 URL을 그대로 넘겨서 ?ref= 등
// 쿼리(추천 실적)가 유지된다.
//   카카오톡(Android·iOS 공통): kakaotalk://web/openExternal
//   그 밖의 Android 인앱: Chrome intent
//   그 밖의 iOS 인앱: 여는 방법이 없음 → null/false (호출부에서 "··· 메뉴 → Safari로 열기" + 링크 복사 안내)

// 이동할 주소만 계산 (UA·URL만으로 결정되는 순수 함수 — 검증하기 쉽게 분리)
export function buildExternalUrl(url: string, ua: string): string | null {
  if (/KAKAOTALK/i.test(ua)) {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  }
  if (/Android/i.test(ua)) {
    const u = new URL(url);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  return null;
}

// 버튼 문구 — 40~60대 기준으로 "외부 브라우저" 대신 실제 앱 이름으로.
//   Android 인앱 → "크롬으로 열기" / iPhone 카톡 → "사파리로 열기" / iPhone 기타 인앱 → null(자동 열기 불가)
export type ExternalTarget = { label: string; browser: "크롬" | "사파리" } | null;

export function externalTarget(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): ExternalTarget {
  if (/Android/i.test(ua)) return { label: "크롬으로 열기", browser: "크롬" };
  if (/KAKAOTALK/i.test(ua)) return { label: "사파리로 열기", browser: "사파리" };
  return null;
}

export function openExternal(url: string = window.location.href): boolean {
  const target = buildExternalUrl(url, navigator.userAgent);
  if (!target) return false;
  window.location.href = target;
  return true;
}

// 링크 복사 — 인앱 웹뷰는 clipboard API가 막혀 있는 경우가 있어 execCommand로 한 번 더 시도
export async function copyCurrentUrl(url: string = window.location.href): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
