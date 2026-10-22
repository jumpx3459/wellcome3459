// 인증 문자 발송: 솔라피(국내 발신 070) → 실패하면 Twilio 대체 (2026-10-12 feat/solapi-sms-hook).
// Supabase Send SMS Hook은 5초 안에 답해야 해서(공식 문서 "complete in 5 seconds") 솔라피 2.5초 + Twilio 1.8초로 자름.
// 로그: 인증번호·문구는 절대 남기지 않음 — 발송 업체·가린 번호·결과 코드·걸린 시간만. DB 기록 없음.
// 순수 함수(다른 파일 import 없음, fetch·log·시각·salt는 주입 가능) — scripts/sms-hook-test.mts가 node로 바로 불러 시험.
import { createHmac, randomBytes } from "node:crypto";

export const SOLAPI_TIMEOUT_MS = 2500;
export const TWILIO_TIMEOUT_MS = 1800;
export const SOLAPI_SEND_URL = "https://api.solapi.com/messages/v4/send-many/detail";

export type SolapiConfig = { apiKey: string; apiSecret: string; sender: string };
/** Supabase 기존 Twilio 설정과 같은 Messaging Service SID 방식이 기본, 없으면 From 번호 */
export type TwilioConfig = { accountSid: string; authToken: string; messagingServiceSid?: string; from?: string };
export type SmsEnv = { hookSecret: string; solapi: SolapiConfig; twilio: TwilioConfig | null };

/** 필수 env(Hook 비밀값·솔라피 3개)가 하나라도 없으면 missing에 이름을 담아 돌려줌. Twilio는 선택. */
export function readSmsEnv(env: Record<string, string | undefined>): { env: SmsEnv; missing: [] } | { env: null; missing: string[] } {
  const need = ["SEND_SMS_HOOK_SECRET", "SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER"] as const;
  const missing = need.filter((k) => !env[k]?.trim());
  if (missing.length) return { env: null, missing };
  const v = (k: string) => env[k]?.trim() || undefined;
  const sid = v("TWILIO_ACCOUNT_SID");
  const token = v("TWILIO_AUTH_TOKEN");
  const mss = v("TWILIO_MESSAGING_SERVICE_SID");
  const from = v("TWILIO_FROM");
  return {
    env: {
      hookSecret: v("SEND_SMS_HOOK_SECRET")!,
      solapi: { apiKey: v("SOLAPI_API_KEY")!, apiSecret: v("SOLAPI_API_SECRET")!, sender: v("SOLAPI_SENDER")!.replace(/\D/g, "") },
      twilio: sid && token && (mss || from) ? { accountSid: sid, authToken: token, messagingServiceSid: mss, from } : null,
    },
    missing: [],
  };
}

/** 로그용 번호 가림: 01012345678 → 010-****-5678 */
export function maskPhone(local: string): string {
  const d = local.replace(/\D/g, "");
  return d.length >= 8 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : "***";
}

/** 솔라피 HMAC-SHA256 인증 헤더 — signature = hex(HMAC-SHA256(apiSecret, date + salt)), date는 ISO 8601 */
export function solapiAuthHeader(apiKey: string, apiSecret: string, date: string, salt: string): string {
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export type SendResult = { ok: boolean; provider: "solapi" | "twilio"; code: string; ms: number };
export type SendDeps = {
  fetch?: typeof fetch;
  now?: () => number;
  /** ISO 시각(솔라피 date) — 시험에서 고정 */
  isoNow?: () => string;
  salt?: () => string;
  solapiTimeoutMs?: number;
  /** 솔라피 응답 모양 진단 로그(값 없음) — sendOtpSms가 로그 한 줄로 남김 */
  shape?: (s: { keys: string; messageList: string }) => void;
  twilioTimeoutMs?: number;
};

function errCode(e: unknown): string {
  const name = (e as { name?: string })?.name;
  return name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error";
}

/** 솔라피 단문 1건. 성공 = HTTP 2xx + 실패 목록(failedMessageList, 없으면 빈 배열로 봄)이 비어 있음.
 *  2026-10-22: 예전엔 messageList[0].statusCode === "2000"도 요구했는데, 실제 응답엔 그 값이 없어 발송이 됐는데도 실패로 판정돼
 *  Twilio 대체 → 500이 났음(Hook 500). statusCode는 있으면 로그용 code로만 남기고 판정에는 쓰지 않는다.
 *  접수 단계 거절(예: 3040 미등록 발신번호)은 솔라피가 failedMessageList에 담아 준다. */
export async function sendSolapi(to: string, text: string, cfg: SolapiConfig, deps: SendDeps = {}): Promise<SendResult> {
  const f = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const t0 = now();
  const date = deps.isoNow?.() ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const salt = deps.salt?.() ?? randomBytes(16).toString("hex");
  try {
    const res = await f(SOLAPI_SEND_URL, {
      method: "POST",
      headers: { Authorization: solapiAuthHeader(cfg.apiKey, cfg.apiSecret, date, salt), "Content-Type": "application/json" },
      // type SMS 고정 — 90바이트를 넘으면 장문으로 바뀌지 않고 거절(단문 요금 유지)
      body: JSON.stringify({ messages: [{ to, from: cfg.sender, text, type: "SMS" }] }),
      signal: AbortSignal.timeout(deps.solapiTimeoutMs ?? SOLAPI_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as {
      failedMessageList?: { statusCode?: string }[] | null;
      messageList?: { statusCode?: string }[] | Record<string, { statusCode?: string }> | null;
      errorCode?: string;
    } | null;
    const failed = Array.isArray(json?.failedMessageList) ? json.failedMessageList : [];
    const list = json?.messageList && typeof json.messageList === "object" ? Object.values(json.messageList) : [];
    const msgCode = failed[0]?.statusCode ?? list[0]?.statusCode;
    const ok = res.ok && failed.length === 0;
    // 진단용 — 응답 모양만(최상위 키 이름 + messageList 타입). 번호·문구·인증번호·groupId 같은 값은 남기지 않음
    deps.shape?.({
      keys: json && typeof json === "object" ? Object.keys(json).join(",") : "none",
      messageList: Array.isArray(json?.messageList) ? "array" : json?.messageList && typeof json.messageList === "object" ? "object" : "none",
    });
    return { ok, provider: "solapi", code: msgCode ?? json?.errorCode ?? (ok ? "accepted" : `http_${res.status}`), ms: now() - t0 };
  } catch (e) {
    return { ok: false, provider: "solapi", code: errCode(e), ms: now() - t0 };
  }
}

/** Twilio REST Messages API 1건(To는 +82 형식). 성공 = HTTP 2xx. */
export async function sendTwilio(to: string, text: string, cfg: TwilioConfig, deps: SendDeps = {}): Promise<SendResult> {
  const f = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const t0 = now();
  const form = new URLSearchParams({ To: "+82" + to.replace(/^0/, ""), Body: text });
  if (cfg.messagingServiceSid) form.set("MessagingServiceSid", cfg.messagingServiceSid);
  else if (cfg.from) form.set("From", cfg.from);
  try {
    const res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(deps.twilioTimeoutMs ?? TWILIO_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as { code?: number } | null;
    return { ok: res.ok, provider: "twilio", code: res.ok ? String(res.status) : String(json?.code ?? `http_${res.status}`), ms: now() - t0 };
  } catch (e) {
    return { ok: false, provider: "twilio", code: errCode(e), ms: now() - t0 };
  }
}

export type SmsLog = (line: Record<string, string | number | boolean>) => void;

/** 솔라피 → 실패하면 Twilio(설정돼 있을 때만). 시도마다 한 줄 로그(번호는 가림, 문구·인증번호 없음). */
export async function sendOtpSms(
  to: string,
  text: string,
  env: Pick<SmsEnv, "solapi" | "twilio">,
  deps: SendDeps & { log?: SmsLog } = {},
): Promise<{ ok: boolean; attempts: SendResult[] }> {
  const log: SmsLog = deps.log ?? ((line) => console.log("sms-hook", JSON.stringify(line)));
  const masked = maskPhone(to);
  const attempts: SendResult[] = [];

  let shape: { keys: string; messageList: string } | null = null;
  const s = await sendSolapi(to, text, env.solapi, { ...deps, shape: (v) => (shape = v) });
  attempts.push(s);
  log({ provider: s.provider, to: masked, ok: s.ok, code: s.code, ms: s.ms, ...(shape ? { resp_keys: (shape as { keys: string }).keys, message_list: (shape as { messageList: string }).messageList } : {}) });
  if (s.ok) return { ok: true, attempts };

  if (!env.twilio) {
    log({ provider: "twilio", to: masked, skipped: true, code: "env_missing" });
    return { ok: false, attempts };
  }
  const t = await sendTwilio(to, text, env.twilio, deps);
  attempts.push(t);
  log({ provider: t.provider, to: masked, ok: t.ok, code: t.code, ms: t.ms });
  return { ok: t.ok, attempts };
}
