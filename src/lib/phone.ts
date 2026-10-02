// 전화번호 공용 유틸 (2026-10-02) — 저장·비교는 normalizePhone, 화면 표시는 formatPhone, 남에게 보이는 번호는 maskPhone.
// 서버·브라우저 어디서나 쓸 수 있게 다른 모듈을 import하지 않는다(auth.ts는 supabase 클라이언트를 끌고 옴).
// members.phone은 E1(2026-10-02 운영 실행) 이후 인증 번호를 kpi_norm_phone으로 바꾼 "010…" 숫자만 형식 — normalizePhone 결과와 같음.

/** 저장·비교용: 숫자만 남기고 "+82 10-…"·"8210…"은 국내 형식 "010…"으로.
 * 82 접두는 "+82"로 시작하거나 숫자 11~12자리일 때만 국가번호로 봄 — 입력 중인 "82…"(짧은 값)는 그대로. */
export function normalizePhone(v: string | null | undefined): string {
  const raw = (v ?? "").replace(/[^0-9]/g, "");
  const intl = (v ?? "").trim().startsWith("+82") || /^82\d{9,10}$/.test(raw);
  return intl ? `0${raw.slice(2).replace(/^0+/, "")}` : raw;
}

/** 표시용: "010-1234-5678" · 옛 10자리 "011-123-4567" · "02-1234-5678" · "031-123-4567" · "1588-1234".
 * 형식을 알 수 없으면(마스킹된 값 등) 원문 그대로. */
export function formatPhone(v: string | null | undefined): string {
  const d = normalizePhone(v);
  if (/^1[568]\d{6}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (/^02\d{7,8}$/.test(d)) return `02-${d.slice(2, -4)}-${d.slice(-4)}`;
  if (/^0[1-9]\d{8,9}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, -4)}-${d.slice(-4)}`;
  return v ?? "";
}

/** 남에게 보이는 번호: 가운데 자리만 가림 "010-****-5678" · "011-***-4567". 형식을 알 수 없으면 "비공개". */
export function maskPhone(v: string | null | undefined): string {
  const parts = formatPhone(v).split("-");
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) return "비공개";
  return `${parts[0]}-${"*".repeat(parts[1].length)}-${parts[2]}`;
}
