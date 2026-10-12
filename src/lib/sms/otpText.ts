// 인증 문자 문구·번호 변환 (2026-10-12 feat/solapi-sms-hook) — /api/auth/sms-hook에서 씀.
// 순수 함수만(다른 파일 import 없음) — scripts/sms-hook-test.mts가 node로 바로 불러 시험.

/** Supabase 대시보드 SMS 템플릿과 같은 문구. {otp} 두 군데. 바꾸면 90바이트(EUC-KR 단문) 시험도 같이 확인. */
export const OTP_SMS_TEMPLATE = "[덤핑점핑] 인증번호 {otp}\n\n@www.dumpingjumping.com #{otp}";

export function buildOtpText(otp: string): string {
  return OTP_SMS_TEMPLATE.replaceAll("{otp}", otp);
}

/** EUC-KR 기준 바이트 수(단문 SMS 90바이트 판정용): ASCII 1바이트, 그 밖(한글 등) 2바이트. */
export function eucKrByteLength(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) < 0x80 ? 1 : 2;
  return n;
}

export const SMS_SINGLE_MAX_BYTES = 90;

/**
 * Supabase user.phone("8210…" / "+8210…", E.164) → 국내 휴대폰 "010…" 11자리.
 * 한국 010 휴대폰이 아니면 null(해외 번호·자릿수 틀림·011 등 옛 번호).
 */
export function toKoreanMobile(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const digits = phone.trim().replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  let local: string;
  // "82010…"(국가번호 뒤 0을 안 뺀 입력)도 받아 줌
  if (digits.startsWith("82")) local = digits.startsWith("820") ? digits.slice(2) : "0" + digits.slice(2);
  else if (digits.startsWith("010")) local = digits;
  else return null;
  return /^010\d{8}$/.test(local) ? local : null;
}
