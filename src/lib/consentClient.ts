import { supabase } from "@/lib/supabase";
import { authFetch } from "@/lib/authFetch";
import { consentNotice, isDealAlertVersionCurrent, type ConsentSource, type ConsentType } from "@/lib/consent";

// 화면 쪽 동의 조회·저장 (2026-09-30). 저장은 /api/consents(서버가 토큰에서 회원 id 결정).

export type ConsentState = Partial<Record<ConsentType, { agreed: boolean; createdAt: string }>>;

// 동의 상태가 바뀌면(알림 켜기 시트·MY 토글·재동의 시트) 다른 화면 조각이 다시 읽도록 알림
export const CONSENT_CHANGED_EVENT = "dj:consent-changed";
// 동의/철회 직후 안내 문구 — AppShell의 ConsentGate가 받아서 잠깐 띄움(화면 이동해도 유지)
export const CONSENT_NOTICE_EVENT = "dj:consent-notice";

// 내 타입별 최신 동의. 조회 실패(로그인 안 함·테이블 없음 등)는 null — 호출하는 쪽은 "모름"으로 취급
export async function fetchMyConsents(): Promise<ConsentState | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("member_consent_latest")
    .select("consent_type, agreed, created_at, terms_version")
    .eq("member_id", userId);
  if (error) {
    console.warn("[consent] 조회 실패", error.message);
    return null;
  }
  const state: ConsentState = {};
  for (const row of data ?? []) {
    // F-3b: 매물 알림 동의는 최신값이 agreed=true여도 버전이 현재보다 낮으면 "동의 안 함"(재동의 필요)으로 취급
    const agreed = row.consent_type === "deal_alert_ad" ? Boolean(row.agreed) && isDealAlertVersionCurrent(row.terms_version) : Boolean(row.agreed);
    state[row.consent_type as ConsentType] = { agreed, createdAt: row.created_at };
  }
  return state;
}

export async function saveConsents(
  consents: { type: ConsentType; agreed: boolean }[],
  source: ConsentSource
): Promise<{ ok: true; recordedAt: string } | { ok: false }> {
  try {
    const res = await authFetch("/api/consents", { json: { consents, source } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false };
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
    return { ok: true, recordedAt: data.recordedAt };
  } catch {
    return { ok: false };
  }
}

export function showConsentNotice(message: string | null) {
  if (!message || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONSENT_NOTICE_EVENT, { detail: message }));
}

// 매물 알림·카카오 소식 동의/철회 결과를 안내 (여러 개면 한 줄씩)
export function announceConsents(consents: { type: ConsentType; agreed: boolean }[], recordedAt: string) {
  const lines = consents.map((c) => consentNotice(c.type, c.agreed, recordedAt)).filter(Boolean);
  if (lines.length) showConsentNotice(lines.join("\n"));
}
