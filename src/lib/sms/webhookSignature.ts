// Supabase Auth Hook 서명 검증 (Standard Webhooks 방식, 2026-10-12 feat/solapi-sms-hook).
// 헤더 webhook-id / webhook-timestamp(초) / webhook-signature("v1,<base64>" 여러 개면 공백 구분).
// 서명 = base64(HMAC-SHA256(key, `${id}.${timestamp}.${body}`)), key = 비밀값 "v1,whsec_" 뒤를 base64 디코드한 바이트.
// 패키지(standardwebhooks) 없이 node:crypto로 직접 — 의존성 늘리지 않으려고. 순수 함수(다른 파일 import 없음).
import { createHmac, timingSafeEqual } from "node:crypto";

/** 허용 시각 차(초) — standard-webhooks 라이브러리 기본값과 같은 ±5분 */
export const WEBHOOK_TOLERANCE_SEC = 5 * 60;

/** "v1,whsec_xxx" / "whsec_xxx" / "xxx" 어느 쪽이든 base64 부분만 디코드 */
export function webhookSecretKey(secret: string): Buffer {
  return Buffer.from(secret.trim().replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
}

export function signWebhook(secret: string, id: string, timestamp: string, body: string): string {
  return createHmac("sha256", webhookSecretKey(secret)).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export type WebhookVerifyResult = { ok: true } | { ok: false; reason: "missing_headers" | "bad_timestamp" | "too_old_or_new" | "bad_signature" };

export function verifyWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): WebhookVerifyResult {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(nowSec - Number(timestamp)) > WEBHOOK_TOLERANCE_SEC) return { ok: false, reason: "too_old_or_new" };

  const expected = Buffer.from(signWebhook(secret, id, timestamp, body), "base64");
  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",", 2);
    if (version !== "v1" || !sig) continue;
    const got = Buffer.from(sig, "base64");
    if (got.length === expected.length && timingSafeEqual(got, expected)) return { ok: true };
  }
  return { ok: false, reason: "bad_signature" };
}
