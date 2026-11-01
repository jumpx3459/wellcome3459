import { getFreshAccessToken } from "@/lib/authFetch";
import { firstInSession, viewKey } from "@/lib/metricsCore";
import type { SlotId } from "@/lib/partnerSlots";

// 일별 합계 기록 — 클라이언트 (2026-10-30 feat/stats-foundation). 모두 fire-and-forget: 실패해도 화면·동작에 영향 없음.
// 이름·경로에 ad·banner·sponsor를 쓰지 않음(광고 차단 도구 회피).

/** POST + keepalive(이동·인앱 외부 열기 중에도 전송). 로그인 토큰이 있으면 Authorization — 서버가 회원·KPI 제외 판정 */
export function sendMetric(path: string, body: Record<string, unknown>): void {
  void (async () => {
    let token: string | null = null;
    try {
      token = await getFreshAccessToken();
    } catch {
      token = null; // 연결 문제 등 — 토큰 없이(비회원으로) 보냄
    }
    try {
      await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // 무시
    }
  })();
}

/** 제휴 칸 클릭 — 누른 순간 전송(이동 전) */
export function recordPartnerClick(slot: SlotId, partnerId: string): void {
  sendMetric("/api/metrics/slot", { slot, partnerId, kind: "click" });
}

/** 매물 상세 조회 1회 — 이 세션에서 같은 매물은 한 번만(엄격 모드 이중 실행도 같은 키로 막음) */
export function recordDealView(dealId: string): void {
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  if (!firstInSession(storage, viewKey(dealId))) return;
  sendMetric("/api/metrics/deal-view", { dealId });
}
