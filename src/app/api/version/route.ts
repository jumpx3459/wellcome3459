import { NextResponse } from "next/server";

// 2026-10-06: 지금 배포의 커밋 값 — 열려 있는 화면(UpdateBanner)이 자기 값과 비교해 "새 버전이 있어요" 띠를 띄움. 캐시 금지.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.APP_BUILD_SHA || "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
