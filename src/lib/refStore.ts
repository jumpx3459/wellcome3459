// 추천 코드(?ref=CODE) 기기 저장 (2026-10-07).
// 예전엔 /signup·매물 상세·파트너 페이지가 URL의 ref만 읽어서, /?ref=CODE로 들어온 뒤 홈 CTA·재방문 링크·하단 탭·로그인↔가입 링크로
// 가면 ref가 사라져 추천 실적이 누락됐음. → 어떤 페이지든 ?ref=가 있으면 기기에 30일 저장(최근 링크 우선),
// 가입은 URL ref가 있으면 그것, 없으면 저장값을 쓰고, 가입 성공 시 지움. 저장소가 막혀 있으면(try/catch) 조용히 건너뜀.
const KEY = "dj_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidRefCode(code: string | null | undefined): code is string {
  return typeof code === "string" && CODE_RE.test(code);
}

/** 주소의 쿼리(?ref=CODE)가 올바른 코드면 저장(덮어씀 = 최근 링크 우선). 저장했으면 true */
export function saveRefFromSearch(search: string): boolean {
  try {
    const code = new URLSearchParams(search).get("ref");
    if (!isValidRefCode(code)) return false;
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** 저장된 ref (30일 지났거나 깨졌으면 지우고 null) */
export function getSavedRef(now: number = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (!isValidRefCode(v.code as string) || typeof v.at !== "number" || now - v.at > TTL_MS || v.at > now + 60_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return v.code as string;
  } catch {
    return null;
  }
}

export function clearSavedRef(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** 가입에 쓸 ref — URL ref 우선, 없으면 저장값 */
export function resolveSignupRef(urlRef: string | null | undefined): string | null {
  return isValidRefCode(urlRef) ? urlRef : getSavedRef();
}

/** 주소에 ref가 없고 저장값이 있으면 붙여서 돌려줌(외부 브라우저로 넘길 때) */
export function withSavedRef(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("ref")) {
      const saved = getSavedRef();
      if (saved) u.searchParams.set("ref", saved);
    }
    return u.toString();
  } catch {
    return url;
  }
}
