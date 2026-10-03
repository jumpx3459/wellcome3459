// 로그인·가입 후 돌아갈 주소(returnTo) 검증 (2026-10-03). 쿼리스트링으로 들어온 값은 누구나 만들 수 있어서,
// 그대로 router.push 하면 외부 주소로 보내는 링크를 만들 수 있다(오픈 리다이렉트).
// 같은 출처의 "/"로 시작하는 경로만 통과 — 쿼리(?autoInterest=1&ref=)·해시(#alerts)는 그대로 유지.
// "//host"·"/\host"(브라우저가 외부 주소로 해석), 스킴(https:·javascript:), 제어문자(탭·줄바꿈 등)는 null.
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || raw[0] !== "/") return null;
  if (raw[1] === "/" || raw[1] === "\\") return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    if (new URL(raw, "http://returnto.invalid").origin !== "http://returnto.invalid") return null;
  } catch {
    return null;
  }
  return raw;
}

/** 현재 경로(+쿼리)를 /signup·/login 링크의 returnTo로 붙인 주소. 현재 경로가 검증을 못 넘으면 returnTo 없이. */
export function withReturnTo(base: "/signup" | "/login", current: string, extra = ""): string {
  // 홈("/")은 기본 도착지(/deals)와 달라질 게 없고, /signup·/login 자신으로 돌아오면 고리가 되므로 붙이지 않음
  const skip = current === "/" || /^\/(signup|login)(\/|\?|#|$)/.test(current);
  const safe = skip ? null : safeReturnTo(current);
  const params = [safe ? `returnTo=${encodeURIComponent(safe)}` : "", extra].filter(Boolean).join("&");
  return params ? `${base}?${params}` : base;
}
