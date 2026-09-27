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
