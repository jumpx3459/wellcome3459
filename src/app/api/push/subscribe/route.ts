import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCanonicalHost } from "@/lib/siteUrl";

// 푸시 구독 저장. 비정식 주소(xxx.vercel.app 등)에서 만든 구독은 알림 클릭 시 그 주소로
// 열리므로 Origin이 정식 주소/localhost가 아니면 거부한다 (src/lib/siteUrl.ts 참고).
// 회원 id는 body가 아니라 access token에서 꺼낸다 — 예전엔 body의 memberId를 그대로 믿어서
// 아무나 남의 회원 id로 자기 기기를 등록해 그 회원의 알림을 받아볼 수 있었음.
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).hostname : null;
  } catch {}
  if (!originHost || !isCanonicalHost(originHost)) {
    return NextResponse.json({ error: "정식 주소에서만 알림을 켤 수 있어요." }, { status: 403 });
  }

  const { accessToken, subscription } = await req.json();
  if (!accessToken || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // 프로덕션에서 env가 빠졌는데 성공처럼 보이면 구독이 조용히 사라지므로 에러로 처리
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "인증이 만료됐어요." }, { status: 401 });
  }

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      member_id: userData.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
