import { NextResponse } from "next/server";
import { buildOtpText, toKoreanMobile } from "@/lib/sms/otpText";
import { readSmsEnv, sendOtpSms } from "@/lib/sms/send";
import { verifyWebhook } from "@/lib/sms/webhookSignature";

// Supabase Auth "Send SMS Hook" (2026-10-12 feat/solapi-sms-hook): 인증 문자를 솔라피 국내 발신번호로 보내고,
// 솔라피가 실패하면 Twilio로 대신 보낸다. Supabase 대시보드에서 Hook을 켜기 전에는 아무도 부르지 않음.
// 응답 형식(공식 문서): 성공 200 {} / 실패 { error: { http_code, message } }. 5초 안에 답해야 함.
// 429·503은 Supabase가 재시도(문자 중복 발송 위험)하므로 쓰지 않는다.
// 전환·되돌리기 순서는 docs/ops/solapi-cutover.md.
export const runtime = "nodejs";

function hookError(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

export async function POST(request: Request) {
  const body = await request.text();

  const { env, missing } = readSmsEnv(process.env);
  if (!env) {
    console.error("sms-hook env missing", missing.join(","));
    return hookError(500, "SMS hook is not configured");
  }

  const verified = verifyWebhook(
    env.hookSecret,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    body,
  );
  if (!verified.ok) {
    console.warn("sms-hook signature rejected", verified.reason);
    return hookError(401, "Invalid webhook signature");
  }

  let payload: { user?: { phone?: unknown }; sms?: { otp?: unknown } };
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError(400, "Invalid JSON body");
  }
  const otp = payload.sms?.otp;
  if (typeof otp !== "string" || !/^\d{4,10}$/.test(otp)) return hookError(400, "Invalid OTP");
  const to = toKoreanMobile(payload.user?.phone);
  if (!to) return hookError(400, "Only Korean mobile numbers (010) are supported");

  const result = await sendOtpSms(to, buildOtpText(otp), env);
  if (!result.ok) return hookError(500, "Failed to send SMS");
  return NextResponse.json({});
}
