// 일별 합계 기록의 순수 부분 (2026-10-30 feat/stats-foundation) — 봇 거르기·세션 1회 키·한국 날짜. 다른 모듈 import 없음(단위 시험용).

// 봇·미리보기·자동화 도구 User-Agent. 카카오톡 인앱 실사용자 UA("KAKAOTALK 10.x")는 통과시키고 링크 미리보기 수집기(kakaotalk-scrap)만 거름.
// UA가 비어 있으면(브라우저는 항상 보냄) 도구 호출로 보고 거름.
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|headless|lighthouse/i;
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true;
  return BOT_RE.test(ua);
}

// 세션당 1회 키 (sessionStorage)
export const impressionKey = (slot: string, partnerId: string) => `pm:imp:${slot}:${partnerId}`;
export const viewKey = (dealId: string) => `pm:view:${dealId}`;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * 이 세션에서 처음이면 true(그리고 기록), 이미 했으면 false.
 * 저장소가 막혀 있으면(프라이빗 모드 등) 같은 화면 수명 안에서만 막도록 메모리 집합으로 대신함 — 새로고침하면 다시 셀 수 있으나 과다 집계는 막음.
 */
const memory = new Set<string>();
export function firstInSession(storage: StorageLike | null | undefined, key: string): boolean {
  if (memory.has(key)) return false;
  try {
    if (storage) {
      if (storage.getItem(key)) {
        memory.add(key);
        return false;
      }
      storage.setItem(key, "1");
    }
  } catch {
    // 저장소 접근 불가 — 메모리 집합만 사용
  }
  memory.add(key);
  return true;
}

/** 시험용: 메모리 집합 초기화 */
export function _resetMemoryForTest(): void {
  memory.clear();
}

const KST_MS = 9 * 3600e3;
/** 한국 날짜 YYYY-MM-DD */
export function kstDate(now: number = Date.now()): string {
  return new Date(now + KST_MS).toISOString().slice(0, 10);
}

/** 관리자 조회 기간 검증 — YYYY-MM-DD 두 값, from <= to, 최대 92일 */
export function parseRange(from: unknown, to: unknown): { from: string; to: string } | null {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof from !== "string" || typeof to !== "string" || !re.test(from) || !re.test(to)) return null;
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t) || f > t) return null;
  if (new Date(f).toISOString().slice(0, 10) !== from || new Date(t).toISOString().slice(0, 10) !== to) return null;
  if ((t - f) / 86400e3 > 91) return null;
  return { from, to };
}

// 회전 순번 (2026-11-01 feat/partner-card-slots) — 칸마다 세션당 순번을 올려 같은 화면에 다시 들어오면 다음 항목.
export const rotationKey = (slot: string) => `pm:rot:${slot}`;
const rotMemory = new Map<string, number>();
export function nextRotationIndex(storage: StorageLike | null | undefined, slot: string, n: number): number {
  if (!(n > 0)) return 0;
  const key = rotationKey(slot);
  let count = rotMemory.get(key) ?? 0;
  try {
    if (storage) {
      const raw = Number(storage.getItem(key));
      if (Number.isFinite(raw) && raw >= 0) count = Math.max(count, Math.floor(raw));
      storage.setItem(key, String(count + 1));
    }
  } catch {
    // 저장소 접근 불가 — 메모리 순번만 사용
  }
  rotMemory.set(key, count + 1);
  return count % n;
}
export function _resetRotationForTest(): void {
  rotMemory.clear();
}
