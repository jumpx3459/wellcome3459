// 공유 링크·QR·OG·사이트맵처럼 "밖으로 나가는 절대 URL"은 전부 이 값으로 만든다.
// window.location.origin이나 VERCEL_URL을 쓰면, 배포별 주소(xxx-hash.vercel.app)나
// dumpingjumping.vercel.app로 들어온 사람이 공유한 링크가 그 비정식 주소로 퍼진다.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dumpingjumping.com").replace(/\/+$/, "");

const CANONICAL_HOST = new URL(SITE_URL).hostname;

// 웹 푸시 구독은 구독한 주소(origin)의 서비스워커에 묶여서, 비정식 주소에서 구독한
// 기기는 알림을 누를 때마다 그 주소로 열린다 — 해시 배포 주소는 배포 시점 코드로
// 고정돼 나중에 고칠 수도 없어서, 애초에 정식 주소(개발 중엔 localhost)에서만 구독받는다.
export function isCanonicalHost(hostname: string): boolean {
  return hostname === CANONICAL_HOST || hostname === "localhost" || hostname === "127.0.0.1";
}
