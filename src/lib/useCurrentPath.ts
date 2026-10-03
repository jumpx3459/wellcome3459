"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** 지금 보는 경로 + 쿼리 (해시 제외) — /signup·/login 링크의 returnTo로 쓴다 (src/lib/safeReturnTo.ts withReturnTo).
 * useSearchParams를 쓰므로 이 훅을 쓰는 컴포넌트는 Suspense 안에 있어야 한다(빌드 시 정적 생성 오류 방지). */
export function useCurrentPath(): string {
  const pathname = usePathname() ?? "/";
  const qs = useSearchParams()?.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
