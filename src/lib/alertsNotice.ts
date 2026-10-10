// 회원 홈 "🔕 알림이 꺼져 있어요" 안내를 띄울지 (2026-10-09 PR 4a) — 화면(useAlertsOffNotice)·단위 시험(scripts/alerts-notice-test.mts) 공용, import 없음.
// 확실히 꺼진 경우에만 true, 모르면 false(아무것도 안 띄움).
//   · 이 기기 상태(getPushState): "denied"(권한 거부)·"off"(권한 전이거나 이 기기 구독 없음) → 꺼짐
//   · "subscribed"(이 기기 구독 있음): 서버가 "알림 끔"(push_opt_out)이라고 하거나, 매물 알림 동의가 없음·옛 버전(consent false) → 꺼짐.
//     서버 조회 실패·동의 조회 전·서버에 이 기기가 아직 저장 안 됨(저장 중일 수 있음)은 모름 → false
//   · 알림 자체가 안 되는 환경(인앱·아이폰 홈 화면 추가 전·미지원 브라우저·정식 주소 아님)은 기존 안내(InAppBanner·AlertGapCard)에 맡김 → false
//   · 상태 확인 전(null) → false
export type PushKind = "subscribed" | "inapp" | "ios_needs_install" | "denied" | "off" | "unsupported" | "noncanonical";
export type PushServerStatus = { thisDeviceSaved: boolean; optedOut: boolean } | null;

export function alertsOffNotice(kind: PushKind | null, consent: boolean | null, server: PushServerStatus): boolean {
  if (kind === null) return false;
  if (kind === "denied" || kind === "off") return true;
  if (kind !== "subscribed") return false;
  if (server?.optedOut) return true;
  if (consent === false) return true;
  return false;
}
