// 웹푸시 발송 결과로 구독을 지울지 (2026-10-09 4a) — sendPush.ts·단위 시험(scripts/push-gone-test.mts) 공용, 다른 모듈 import 없음.
// 404 Not Found·410 Gone = 브라우저에서 구독이 영구 해지됨 → 구독 행 삭제.
// 403(VAPID 키 불일치)은 삭제하지 않고 기록만 — 환경변수를 잘못 바꾸면 정상 구독이 한꺼번에 지워질 수 있어서(대표 결정).
//   매물 푸시는 notification_logs.error_code에 403이 그대로 남음. 그 밖(429·5xx·네트워크)도 유지하고 다음 발송에서 다시 시도.
export function pushStatusCode(e: unknown): number | null {
  const code = (e as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" ? code : null;
}

export function isGoneSubscription(e: unknown): boolean {
  const code = pushStatusCode(e);
  return code === 404 || code === 410;
}

export function isKeyMismatch(e: unknown): boolean {
  return pushStatusCode(e) === 403;
}
