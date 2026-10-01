// 2026-09-28: 뒤로가기(←) 버튼이 "히스토리가 있으면 router.back(), 없으면 홈"으로
// 판단할 때 window.history.length만 보면 안 됨 — 카카오톡 인앱 브라우저 등 외부에서
// 공유 링크로 바로 들어온 경우에도 웹뷰 자체 히스토리(리다이렉트/스크롤 복원 등)
// 때문에 history.length가 1보다 큰 경우가 흔해서, router.back()이 앱 밖(카카오톡)으로
// 튕겨나가는 문제가 있었음. 그래서 "이 세션에서 앱 안에서 실제로 페이지를 이동한
// 적이 있는지"를 sessionStorage에 직접 기록해서 판단함 — AppShell이 pathname이
// 바뀔 때마다(최초 진입 제외) markAppNavigation()을 호출.
const KEY = "dj_app_nav_depth";

export function markAppNavigation() {
  if (typeof window === "undefined") return;
  try {
    const current = Number(sessionStorage.getItem(KEY) || "0");
    sessionStorage.setItem(KEY, String(current + 1));
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) — 조용히 무시, hasAppHistory는 false로 폴백
  }
}

// 2026-09-28: depth가 이동할 때마다 증가만 하고 줄지 않으면, 공유 링크로 들어와 →
// 다른 화면 이동 → 브라우저/제스처 뒤로가기로 여러 번 돌아와 처음 화면까지 온 뒤
// 다시 ←를 누르면 depth가 여전히 0보다 커서 router.back()이 앱 밖으로 나가는
// 경계 사례가 있었음(로컬 세션 QA 지적). popstate(뒤로/앞으로 브라우저 버튼)가
// 발생할 때는 AppShell이 markAppBack()을 호출해 depth를 다시 줄임.
export function markAppBack() {
  if (typeof window === "undefined") return;
  try {
    const current = Number(sessionStorage.getItem(KEY) || "0");
    sessionStorage.setItem(KEY, String(Math.max(current - 1, 0)));
  } catch {
    // sessionStorage 접근 불가 — 조용히 무시
  }
}

// 앱 안에서 들어왔으면(이 세션 중 다른 화면에서 이동해온 경우) true — router.back()이 안전함.
// 공유 링크로 바로 들어온 첫 진입이면 false — 홈으로 보내는 게 안전함.
export function hasAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Number(sessionStorage.getItem(KEY) || "0") > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2026-10-01 PR-C: 안드로이드 뒤로가기 정리
// - 하단 탭·해시 이동(/mypage#referral 등)·로고(홈)는 기록을 쌓지 않음 — 홈에서 다른 탭으로 갈 때만 push(뒤로 = 홈),
//   탭끼리는 replace, 홈으로는 쌓인 만큼 되돌아감(history.go) → 홈에서 뒤로가기 = 앱 종료.
// - 매물 상세 진입 등 화면 "들어가기"는 그대로 push.
// "마지막 홈 기록 위에 쌓인 기록 수" — 없으면(공유 링크로 바로 들어와 홈을 안 거침) 홈은 replace로 엶.
const ABOVE_HOME_KEY = "dj_above_home";
const REPLACE_FLAG_KEY = "dj_nav_replace";

type RouterLike = { push: (href: string) => void; replace: (href: string) => void };

function getNum(key: string): number | null {
  try {
    const v = sessionStorage.getItem(key);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function setNum(key: string, n: number) {
  try {
    sessionStorage.setItem(key, String(Math.max(0, n)));
  } catch {}
}

// AppShell이 pathname이 바뀔 때마다 호출 — kind: push(링크·router.push) / pop(뒤로·앞으로) / replace(navReplace)
export function noteRouteChange(pathname: string, kind: "push" | "pop" | "replace" | "first") {
  if (kind === "push") markAppNavigation();
  if (kind === "pop") markAppBack();
  const above = getNum(ABOVE_HOME_KEY);
  if (pathname === "/") setNum(ABOVE_HOME_KEY, 0);
  else if (above !== null && kind === "push") setNum(ABOVE_HOME_KEY, above + 1);
  else if (above !== null && kind === "pop") setNum(ABOVE_HOME_KEY, above - 1);
}

// navReplace로 바뀐 이동인지(한 번만 읽음)
export function consumeReplaceFlag(): boolean {
  try {
    const v = sessionStorage.getItem(REPLACE_FLAG_KEY) === "1";
    sessionStorage.removeItem(REPLACE_FLAG_KEY);
    return v;
  } catch {
    return false;
  }
}

// 기록을 쌓지 않는 이동 — 경로가 바뀔 때만 표시(같은 화면 해시 이동은 AppShell이 모름)
export function navReplace(router: RouterLike, href: string) {
  try {
    if (new URL(href, window.location.href).pathname !== window.location.pathname) sessionStorage.setItem(REPLACE_FLAG_KEY, "1");
  } catch {}
  router.replace(href);
}

// 홈으로 — 홈 기록이 아래에 있으면 그만큼 되돌아가고, 없으면 지금 기록을 홈으로 바꿈
export function goHome(router: RouterLike) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/") return;
  const above = getNum(ABOVE_HOME_KEY);
  if (above !== null && above > 0) {
    // popstate는 한 번만 오니(AppShell이 1 줄임) 나머지만큼 미리 줄여 둠
    try {
      sessionStorage.setItem(KEY, String(Math.max(0, Number(sessionStorage.getItem(KEY) || "0") - (above - 1))));
    } catch {}
    window.history.go(-above);
  } else navReplace(router, "/");
}

// 하단 탭·해시 링크 공통 — 홈에서 나갈 때만 push, 탭끼리는 replace, 홈은 goHome
export function navTab(router: RouterLike, href: string) {
  if (typeof window === "undefined") return;
  if (href === "/") return goHome(router);
  if (window.location.pathname === "/" && !href.startsWith("/#")) router.push(href);
  else navReplace(router, href);
}
