// TEMP DEBUG — 세션 소실 버그 진단용. React state 대신 localStorage에 직접 써서
// 컴포넌트 리마운트/네비게이션 사이에도 로그가 안 끊기게 한다. 원인 확인되면
// 이 파일과 DebugPanel, 그리고 각 페이지의 debugLog() 호출부를 전부 제거할 것.
const KEY = "dj_debug_log";
const EVENT = "dj-debug-log";

export function debugLog(message: string) {
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const ts = new Date().toISOString().slice(11, 19);
    existing.push(`[${ts}] ${message}`);
    while (existing.length > 30) existing.shift();
    localStorage.setItem(KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function readDebugLog(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function clearDebugLog() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export const DEBUG_LOG_EVENT = EVENT;
