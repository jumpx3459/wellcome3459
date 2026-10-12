// 인증 문자 Hook 단위 시험 — src/lib/sms/{otpText,webhookSignature,send}.ts (2026-10-12 feat/solapi-sms-hook)
// 실행: node --experimental-strip-types scripts/sms-hook-test.mts   (Node 24 — 별도 패키지 없음, 실제 발송·운영 접속 없음: fetch는 전부 가짜)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const t = await import(pathToFileURL(join(root, "src/lib/sms/otpText.ts")).href);
const w = await import(pathToFileURL(join(root, "src/lib/sms/webhookSignature.ts")).href);
const s = await import(pathToFileURL(join(root, "src/lib/sms/send.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

// ── 번호 변환
eq(t.toKoreanMobile("821012345678"), "01012345678", "8210… → 010…");
eq(t.toKoreanMobile("+821012345678"), "01012345678", "+8210… → 010…");
eq(t.toKoreanMobile("01012345678"), "01012345678", "010… 그대로");
eq(t.toKoreanMobile("+14155550123"), null, "미국 번호 거부");
eq(t.toKoreanMobile("82101234567"), null, "자릿수 모자람 거부");
eq(t.toKoreanMobile("8210123456789"), null, "자릿수 넘침 거부");
eq(t.toKoreanMobile("821112345678"), null, "011 옛 번호 거부");
eq(t.toKoreanMobile(undefined), null, "번호 없음 거부");

// ── 문구
const text = t.buildOtpText("123456");
eq(text, "[덤핑점핑] 인증번호 123456\n\n@www.dumpingjumping.com #123456", "문구 = Supabase 템플릿");
eq(t.OTP_SMS_TEMPLATE, "[덤핑점핑] 인증번호 {otp}\n\n@www.dumpingjumping.com #{otp}", "템플릿 상수");
const bytes = t.eucKrByteLength(text);
eq(bytes <= t.SMS_SINGLE_MAX_BYTES, true, `EUC-KR ${bytes}바이트 ≤ 90(단문)`);
eq(t.eucKrByteLength("가a"), 3, "바이트 계산(한글 2·ASCII 1)");

// ── Hook 서명 (standard-webhooks 공개 시험 값)
const SECRET = "v1,whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const TS = "1614265330";
const BODY = '{"test": 2432232314}';
eq(w.signWebhook(SECRET, ID, TS, BODY), "g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=", "공개 시험 값과 서명 일치");
const h = (sig: string) => ({ id: ID, timestamp: TS, signature: sig });
const good = "v1," + w.signWebhook(SECRET, ID, TS, BODY);
eq(w.verifyWebhook(SECRET, h(good), BODY, 1614265330).ok, true, "정상 서명 통과");
eq(w.verifyWebhook(SECRET, h("v1,bm90LWEtcmVhbC1zaWc= " + good), BODY, 1614265330).ok, true, "여러 서명 중 하나 맞으면 통과");
eq(w.verifyWebhook(SECRET, h(good), BODY.replace("2432232314", "2432232315"), 1614265330), { ok: false, reason: "bad_signature" }, "본문 위조 거부");
eq(w.verifyWebhook("v1,whsec_" + Buffer.from("other-secret").toString("base64"), h(good), BODY, 1614265330), { ok: false, reason: "bad_signature" }, "다른 비밀값 거부");
eq(w.verifyWebhook(SECRET, h(good), BODY, 1614265330 + 301), { ok: false, reason: "too_old_or_new" }, "5분 1초 지남 거부");
eq(w.verifyWebhook(SECRET, h(good), BODY, 1614265330 - 301), { ok: false, reason: "too_old_or_new" }, "5분 1초 앞섬 거부");
eq(w.verifyWebhook(SECRET, h(good), BODY, 1614265330 + 300).ok, true, "딱 5분은 통과");
eq(w.verifyWebhook(SECRET, { id: null, timestamp: TS, signature: good }, BODY, 1614265330), { ok: false, reason: "missing_headers" }, "헤더 없음 거부");

// ── 솔라피 인증 헤더 (RFC 4231 HMAC-SHA256 시험 2: key "Jefe", data "what do ya want for nothing?")
eq(
  s.solapiAuthHeader("NCSAYU7YDBXYORXC", "Jefe", "what do ya want ", "for nothing?"),
  "HMAC-SHA256 apiKey=NCSAYU7YDBXYORXC, date=what do ya want , salt=for nothing?, signature=5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  "signature = hex(HMAC(secret, date+salt)) 공개 시험 값",
);

// ── env
eq(s.readSmsEnv({}).missing, ["SEND_SMS_HOOK_SECRET", "SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER"], "필수 env 없음 → 이름 목록");
const baseEnv = { SEND_SMS_HOOK_SECRET: SECRET, SOLAPI_API_KEY: "K", SOLAPI_API_SECRET: "S", SOLAPI_SENDER: "070-4006-0890" };
eq(s.readSmsEnv(baseEnv).env?.twilio, null, "Twilio env 없으면 대체 없음");
eq(s.readSmsEnv(baseEnv).env?.solapi.sender, "07040060890", "발신번호 숫자만");
eq(
  s.readSmsEnv({ ...baseEnv, TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "T", TWILIO_MESSAGING_SERVICE_SID: "MG1" }).env?.twilio,
  { accountSid: "AC1", authToken: "T", messagingServiceSid: "MG1" },
  "Twilio Messaging Service 방식",
);
eq(s.maskPhone("01012345678"), "010-****-5678", "번호 가림");

// ── 대체 발송 (fetch 가짜)
const env = s.readSmsEnv({ ...baseEnv, TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "T", TWILIO_MESSAGING_SERVICE_SID: "MG1" }).env;
const json = (status: number, obj: unknown) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const SOLAPI_OK = { groupInfo: { status: "SENDING" }, messageList: [{ statusCode: "2000", messageId: "M1" }], failedMessageList: [] };
const SOLAPI_FAIL = { messageList: [], failedMessageList: [{ statusCode: "3040", statusMessage: "등록되지 않은 발신번호입니다." }] };

function fakeFetch(solapi: "ok" | "fail" | "http500" | "hang", twilio: "ok" | "fail") {
  const calls: { url: string; body: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    if (url.includes("solapi")) {
      if (solapi === "hang")
        return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
      if (solapi === "http500") return json(500, { errorCode: "InternalError" });
      return json(200, solapi === "ok" ? SOLAPI_OK : SOLAPI_FAIL);
    }
    return twilio === "ok" ? json(201, { sid: "SM1", status: "queued" }) : json(400, { code: 21211, message: "invalid" });
  }) as unknown as typeof fetch;
  return { f, calls, twilioCalls: () => calls.filter((c) => c.url.includes("twilio")).length };
}

const logs: string[] = [];
const log = (line: Record<string, unknown>) => logs.push(JSON.stringify(line));
const OTP = "987654";
const otpText = t.buildOtpText(OTP);

{
  const ff = fakeFetch("ok", "ok");
  const r = await s.sendOtpSms("01012345678", otpText, env, { fetch: ff.f, log });
  eq([r.ok, ff.twilioCalls()], [true, 0], "솔라피 성공 → Twilio 0회");
  const sent = JSON.parse(ff.calls[0].body);
  eq(sent, { messages: [{ to: "01012345678", from: "07040060890", text: otpText, type: "SMS" }] }, "솔라피 요청 본문");
}
{
  const ff = fakeFetch("fail", "ok");
  const r = await s.sendOtpSms("01012345678", otpText, env, { fetch: ff.f, log });
  eq([r.ok, ff.twilioCalls(), r.attempts.map((a: { code: string }) => a.code)], [true, 1, ["3040", "201"]], "솔라피 실패 코드 → Twilio 1회");
  const form = new URLSearchParams(ff.calls[1].body);
  eq([form.get("To"), form.get("MessagingServiceSid"), form.get("Body") === otpText], ["+821012345678", "MG1", true], "Twilio 요청 +82·Messaging Service");
}
{
  const ff = fakeFetch("http500", "ok");
  const r = await s.sendOtpSms("01012345678", otpText, env, { fetch: ff.f, log });
  eq([r.ok, ff.twilioCalls(), r.attempts[0].code], [true, 1, "InternalError"], "솔라피 HTTP 500(errorCode) → Twilio 1회");
}
{
  const ff = fakeFetch("hang", "ok");
  const keepAlive = setInterval(() => {}, 1000); // AbortSignal.timeout 타이머는 프로세스를 붙잡지 않아서
  const r = await s.sendOtpSms("01012345678", otpText, env, { fetch: ff.f, log, solapiTimeoutMs: 50 });
  clearInterval(keepAlive);
  eq([r.ok, ff.twilioCalls(), r.attempts[0].code], [true, 1, "timeout"], "솔라피 제한 시간 초과 → Twilio 1회");
}
{
  const ff = fakeFetch("fail", "fail");
  const r = await s.sendOtpSms("01012345678", otpText, env, { fetch: ff.f, log });
  eq([r.ok, ff.twilioCalls(), r.attempts[1].code], [false, 1, "21211"], "둘 다 실패 → ok false(경로는 500)");
}
{
  const ff = fakeFetch("fail", "ok");
  const noTw = s.readSmsEnv(baseEnv).env;
  const r = await s.sendOtpSms("01012345678", otpText, noTw, { fetch: ff.f, log });
  eq([r.ok, ff.twilioCalls(), r.attempts.length], [false, 0, 1], "Twilio env 없음 → 대체 건너뜀");
}
eq(s.SOLAPI_TIMEOUT_MS + s.TWILIO_TIMEOUT_MS < 5000, true, `제한 시간 합 ${s.SOLAPI_TIMEOUT_MS + s.TWILIO_TIMEOUT_MS}ms < Hook 5초`);

// ── 로그
const all = logs.join("\n");
eq(all.includes(OTP), false, `로그 ${logs.length}줄에 인증번호 없음`);
eq(all.includes("01012345678") || all.includes("+821012345678"), false, "로그에 전체 번호 없음");
eq(all.includes("010-****-5678"), true, "로그에 가린 번호");
eq(logs.every((l) => /"provider":"(solapi|twilio)"/.test(l)), true, "모든 줄에 발송 업체");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
