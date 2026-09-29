import { NextRequest, NextResponse } from "next/server";
import { sendDealPush } from "@/lib/sendPush";
import { checkAdminAuth } from "@/lib/adminAuth";

// 이 라우트는 매물이 새로 등록될 때 호출되어, 해당 카테고리·지역을 구독한
// 회원의 기기에 "직접" 알림을 띄웁니다. 카카오 알림톡 같은 중간 채널 없이
// Web Push API로 브라우저/PWA에 바로 전달됩니다 (알라미와 동일한 방식).
//
// 참고: /admin에서 매물을 등록하면 이 로직이 자동으로 호출되므로, 수동 호출은
// 재발송이 필요한 경우에만 사용하면 됩니다.
// 2026-09-30: 관리자 인증 필수 — 예전엔 인증이 없어 매물 id만 알면 누구나 구독자 전원에게 재발송 가능했음.

export async function POST(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { dealId } = await req.json();
  if (!dealId) {
    return NextResponse.json({ error: "dealId가 필요합니다." }, { status: 400 });
  }

  const result = await sendDealPush(dealId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result);
}
