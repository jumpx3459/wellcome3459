import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/siteUrl";

// 프로덕션 배포를 xxx.vercel.app(dumpingjumping.vercel.app, wellcome3459.vercel.app, 배포별
// 해시 주소)으로 연 페이지 이동은 정식 주소로 308 — 그 주소로 공유·구독이 퍼지는 걸 막는다.
// - 프리뷰 배포(VERCEL_ENV=preview)는 PR 확인용이라 그대로 둔다.
// - /sw.js는 제외: 서비스워커 스크립트 요청이 리다이렉트되면 업데이트가 실패해서, 이미
//   vercel.app에서 구독한 기기가 새 sw.js(알림 클릭 시 정식 주소로 여는 버전)를 못 받는다.
// - /api는 제외: 그 기기의 sw.js가 부르는 /api/notification-click 등 fetch가 교차 출처
//   리다이렉트로 깨지지 않게.
export function proxy(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return;
  if (request.method !== "GET" && request.method !== "HEAD") return;

  const host = (request.headers.get("host") ?? "").split(":")[0];
  if (!host.endsWith(".vercel.app")) return;

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, SITE_URL);
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/((?!api/|_next/|sw\\.js$).*)"],
};
