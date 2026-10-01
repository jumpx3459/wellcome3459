// 공개 API 호출 횟수 제한 (2026-10-01 F-1) — 서버 인스턴스 메모리 기준(인스턴스가 여러 개면 인스턴스마다 따로 셈).
// notify-lead·quick-interest가 같이 씀. 키는 "용도:값" 형태로 구분(예: "qi-ip:1.2.3.4").
const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

// limit번까지 허용, 넘으면 true(이번 호출은 세지 않음)
export function overLimit(key: string, limit: number, windowMs = DEFAULT_WINDOW_MS): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
