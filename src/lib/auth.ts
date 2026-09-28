import { supabase, isSupabaseConfigured } from "./supabase";
import { debugLog } from "./debugLog"; // TEMP DEBUG — "Invalid API key" 원인(레이트리밋 vs 실제 키 오류) 확정용, 확인되면 제거

// 카카오 로그인 대신 휴대폰 SMS OTP만 사용합니다 — 애초 supabase/schema.sql
// 1번 섹션 주석("휴대폰 인증 기반, Supabase Auth phone 사용")이 원래 의도했던
// 방식으로 복귀하는 것이기도 하고, 점프엑스(JUMP X)도 전화번호를 서비스 간
// 식별자로 쓰기 때문에 두 서비스의 인증 방식을 일치시키는 목적도 있습니다.
// 패턴은 jumpx-luxury-redesign의 src/lib/auth.ts를 이 프로젝트(별도 Supabase
// 프로젝트) 스키마에 맞게 이식한 것입니다.
//
// 실제로 문자를 받으려면 Supabase 대시보드 → Authentication → Providers →
// Phone에서 SMS 프로바이더(Twilio 등)를 먼저 연결해야 합니다. 연결 전에는
// signInWithOtp() 호출이 에러를 반환합니다.

/** "010-1234-5678" / "01012345678" 등 다양한 입력을 "+821012345678" 형태로 정규화 */
export function toE164Phone(input: string): string {
  const digitsOnly = input.replace(/[^0-9]/g, "");
  const withoutLeadingZero = digitsOnly.replace(/^0/, "");
  return `+82${withoutLeadingZero}`;
}

/** 어떤 형식이 와도 국내 형식 숫자("01012345678")로. members.phone은 가입 경로에 따라
 * "01012345678"(signup 저장값)·"+821012345678"·"821012345678"이 섞여 있음.
 * 2026-09-29 버그: 예전 fromE164Phone은 항상 앞에 0을 붙여서 이미 0으로 시작하는 값이
 * "001034413459"가 됐음(buy/sell 연락처 자동 입력). */
export function toLocalPhone(input: string | null | undefined): string {
  const digits = (input ?? "").replace(/[^0-9]/g, "");
  if (digits.startsWith("82")) return `0${digits.slice(2).replace(/^0+/, "")}`;
  if (digits.startsWith("00")) return `0${digits.replace(/^0+/, "")}`; // 이미 잘못 저장된 "0010…" 방어
  return digits;
}

/** 화면 표시용 "010-1234-5678" (10자리는 "011-123-4567"). 형식이 안 맞으면 숫자만 반환. */
export function formatKoreanPhone(input: string | null | undefined): string {
  const d = toLocalPhone(input);
  if (/^01\d{9}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (/^01\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

/** 연락처(매물 등록·구매 희망) 검증 — 휴대폰 + 사무실 번호 허용 (2026-09-29).
 * 로그인/가입 OTP는 휴대폰만 되므로 계속 isValidKoreanPhone을 쓸 것.
 *   휴대폰 01X + 7~8자리 / 서울 02 + 7~8자리 / 지역번호 031~064 + 7~8자리 /
 *   인터넷전화 070 + 8자리 / 대표번호 15xx·16xx·18xx + 4자리 */
export function isValidContactPhone(input: string | null | undefined): boolean {
  const d = toLocalPhone(input);
  return (
    /^01[016789]\d{7,8}$/.test(d) ||
    /^02\d{7,8}$/.test(d) ||
    /^0(3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/.test(d) ||
    /^070\d{8}$/.test(d) ||
    /^1[568]\d{6}$/.test(d)
  );
}

/** 연락처 표시용: "010-1234-5678" / "02-1234-5678" / "031-123-4567" / "1588-1234" */
export function formatContactPhone(input: string | null | undefined): string {
  const d = toLocalPhone(input);
  if (/^1[568]\d{6}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (/^02\d{7,8}$/.test(d)) return `02-${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  if (/^0\d{2}\d{7,8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
  return d;
}

/** @deprecated toLocalPhone 사용. 기존 호출부 호환용. */
export const fromE164Phone = toLocalPhone;

/** 국내 휴대폰 번호 형식 검증 (01[0-9] + 8~9자리, 총 10~11자리). sendOtp()의 형식
 * 검증과 동일 규칙을 공유해서, 폼 입력 단계의 UI 검증과 실제 API 게이트가 어긋나지
 * 않게 한다. */
export function isValidKoreanPhone(input: string): boolean {
  return /^01[0-9]{8,9}$/.test(input.replace(/[^0-9]/g, ""));
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface OtpRateLimitResult {
  allowed: boolean;
  reason?: "COOLDOWN" | "HOURLY_LIMIT";
  retry_after_seconds?: number;
}

/** supabase/schema.sql의 check_and_log_otp_request()가 돌려주는 차단 사유를 안내 문구로 변환 */
function formatOtpRateLimitMessage(result: OtpRateLimitResult): string {
  const seconds = result.retry_after_seconds ?? 0;
  if (result.reason === "COOLDOWN") {
    return `잠시 후 다시 시도해주세요. ${seconds}초 후에 인증번호를 다시 요청할 수 있어요.`;
  }
  if (result.reason === "HOURLY_LIMIT") {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `인증번호 요청이 너무 많아요. ${minutes}분 후에 다시 시도해주세요.`;
  }
  return "지금은 인증번호를 요청할 수 없어요. 잠시 후 다시 시도해주세요.";
}

/** 1단계: 휴대폰 번호로 SMS 인증번호 발송 (요청 전 phone별 rate limit 확인 —
 * 어뷰징으로 인한 SMS 비용 폭탄 방지, otp_request_log/check_and_log_otp_request 참고) */
export async function sendOtp(phoneInput: string): Promise<Result<null>> {
  if (!isValidKoreanPhone(phoneInput)) {
    return { ok: false, error: "휴대폰 번호를 정확히 입력해주세요." };
  }
  if (!isSupabaseConfigured || !supabase) {
    // Supabase 미설정 환경(로컬 데모)에서는 인증 자체를 생략합니다.
    return { ok: true, data: null };
  }

  const phoneE164 = toE164Phone(phoneInput);

  const { data: rateLimit, error: rateLimitError } = await supabase.rpc(
    "check_and_log_otp_request",
    { p_phone: phoneE164 }
  );
  if (rateLimitError) {
    debugLog(`[sendOtp] check_and_log_otp_request RPC error code=${rateLimitError.code} message=${rateLimitError.message}`);
    return { ok: false, error: rateLimitError.message };
  }
  if (!(rateLimit as OtpRateLimitResult)?.allowed) {
    debugLog(`[sendOtp] app-level rate limit blocked: reason=${(rateLimit as OtpRateLimitResult)?.reason} retryAfter=${(rateLimit as OtpRateLimitResult)?.retry_after_seconds}`);
    return { ok: false, error: formatOtpRateLimitMessage(rateLimit as OtpRateLimitResult) };
  }

  const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
  if (error) {
    debugLog(`[sendOtp] signInWithOtp error status=${error.status} code=${error.code} name=${error.name} message=${error.message}`);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

/** 2단계: 인증번호 확인. 성공하면 Supabase가 세션(auth.users)을 발급합니다 —
 * members 행 생성/갱신은 이 함수가 아니라 signup 페이지의 submit()이 카테고리·
 * 지역 등 나머지 정보와 함께 한 번에 upsert합니다(중복 upsert 방지). */
export async function verifyOtp(
  phoneInput: string,
  token: string
): Promise<Result<{ id: string; phone: string }>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }
  if (!token) {
    return { ok: false, error: "인증번호를 입력해주세요." };
  }

  const phoneE164 = toE164Phone(phoneInput);
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneE164,
    token,
    type: "sms",
  });
  if (error || !data.user) {
    // 실패 이력 기록 — 로깅 자체가 실패해도 원래 에러 응답은 그대로 사용자에게 보여줍니다.
    await supabase.rpc("log_otp_verify_result", { p_phone: phoneE164, p_success: false });
    return { ok: false, error: error?.message ?? "인증번호가 올바르지 않아요. 다시 확인해주세요." };
  }

  await supabase.rpc("log_otp_verify_result", { p_phone: phoneE164, p_success: true });

  return { ok: true, data: { id: data.user.id, phone: phoneE164 } };
}
