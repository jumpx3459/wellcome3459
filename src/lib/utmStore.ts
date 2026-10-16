// SNS 유입 경로(?utm_source=&utm_medium=&utm_campaign=) 기기 저장 (2026-10-15) — src/lib/refStore.ts와 같은 모양.
// 첫 방문 주소의 UTM을 기기에 30일 저장하고, 가입 성공 때 members에 한 번 기록한 뒤 지움.
// 첫 접촉 기준: 유효한 값이 이미 저장돼 있으면 덮어쓰지 않음(만료된 뒤에만 새로 저장).
// 허용 값만 저장(나머지는 버림) — source는 목록, medium은 social, campaign은 소문자·숫자·_·- 1~32자.
// 모든 저장소 접근은 try/catch — 막혀 있어도 화면·가입 동작에 영향 없음.
const KEY = "dj_utm";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const UTM_SOURCES = ["blog", "youtube", "insta", "kakao_ch", "kakao_open", "cafe", "band", "linkedin"] as const;
export const UTM_MEDIUMS = ["social"] as const;
const CAMPAIGN_RE = /^[a-z0-9_-]{1,32}$/;

export type SavedUtm = { source: string; medium: string | null; campaign: string | null };

export function isValidUtmSource(v: unknown): v is string {
  return typeof v === "string" && (UTM_SOURCES as readonly string[]).includes(v);
}
export function isValidUtmMedium(v: unknown): v is string {
  return typeof v === "string" && (UTM_MEDIUMS as readonly string[]).includes(v);
}
export function isValidUtmCampaign(v: unknown): v is string {
  return typeof v === "string" && CAMPAIGN_RE.test(v);
}

/** 저장된 UTM (30일 지났거나 깨졌으면 지우고 null) */
export function getSavedUtm(now: number = Date.now()): SavedUtm | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { s?: unknown; m?: unknown; c?: unknown; at?: unknown };
    if (!isValidUtmSource(v.s) || typeof v.at !== "number" || now - v.at > TTL_MS || v.at > now + 60_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return {
      source: v.s,
      medium: isValidUtmMedium(v.m) ? v.m : null,
      campaign: isValidUtmCampaign(v.c) ? v.c : null,
    };
  } catch {
    return null;
  }
}

/** 주소의 쿼리에서 허용 값만 뽑음. utm_source가 허용 값이 아니면 null(medium·campaign만으로는 저장 안 함) */
export function parseUtmFromSearch(search: string): SavedUtm | null {
  try {
    const p = new URLSearchParams(search);
    const source = p.get("utm_source");
    if (!isValidUtmSource(source)) return null;
    const medium = p.get("utm_medium");
    const campaign = p.get("utm_campaign");
    return {
      source,
      medium: isValidUtmMedium(medium) ? medium : null,
      campaign: isValidUtmCampaign(campaign) ? campaign : null,
    };
  } catch {
    return null;
  }
}

/** 주소에 허용된 UTM이 있고 저장된 유효한 값이 없을 때만 저장(첫 접촉 유지). 저장했으면 true */
export function saveUtmFromSearch(search: string, now: number = Date.now()): boolean {
  try {
    const utm = parseUtmFromSearch(search);
    if (!utm) return false;
    if (getSavedUtm(now)) return false;
    localStorage.setItem(KEY, JSON.stringify({ s: utm.source, m: utm.medium, c: utm.campaign, at: now }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedUtm(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** members에 보낼 컬럼 값(가입 INSERT 때만 씀). 없으면 빈 객체 */
export function savedUtmColumns(now: number = Date.now()): { utm_source?: string; utm_medium?: string; utm_campaign?: string } {
  const u = getSavedUtm(now);
  if (!u) return {};
  return {
    utm_source: u.source,
    ...(u.medium ? { utm_medium: u.medium } : {}),
    ...(u.campaign ? { utm_campaign: u.campaign } : {}),
  };
}

/** 주소에 utm_* 가 하나도 없고 저장값이 있으면 붙여서 돌려줌(외부 브라우저로 넘길 때) */
export function withSavedUtm(url: string): string {
  try {
    const u = new URL(url);
    const has = ["utm_source", "utm_medium", "utm_campaign"].some((k) => u.searchParams.has(k));
    if (!has) {
      const saved = getSavedUtm();
      if (saved) {
        u.searchParams.set("utm_source", saved.source);
        if (saved.medium) u.searchParams.set("utm_medium", saved.medium);
        if (saved.campaign) u.searchParams.set("utm_campaign", saved.campaign);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}
