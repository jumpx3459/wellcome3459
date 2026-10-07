// 인앱·iOS 판별 시험 — src/lib/browserEnv.ts (2026-10-07). 아이폰 카카오톡 인앱에서 [알림 켜기]가 보이면 안 되므로
// 실제 user agent 예시로 isInAppBrowser·isKakaoInApp·isIOS·getPushBlocker를 확인한다.
// 실행: node --experimental-strip-types scripts/browser-env-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "browser-env-"));
writeFileSync(join(dir, "browserEnv.ts"), readFileSync(join(root, "src/lib/browserEnv.ts"), "utf8"));
const env = await import(pathToFileURL(join(dir, "browserEnv.ts")).href);

type Env = { ua: string; platform?: string; touch?: number; standalone?: boolean };
const setEnv = ({ ua, platform = "iPhone", touch = 5, standalone = false }: Env) => {
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: ua, platform, maxTouchPoints: touch, standalone }, configurable: true });
  Object.defineProperty(globalThis, "window", { value: { matchMedia: () => ({ matches: false }) }, configurable: true });
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const ANDROID = "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko)";
const cases: { name: string; env: Env; inapp: boolean; kakao: boolean; ios: boolean; blocker: string | null }[] = [
  { name: "아이폰 카톡 10.4.5", env: { ua: `${IPHONE} Mobile/15E148 KAKAOTALK 10.4.5` }, inapp: true, kakao: true, ios: true, blocker: "inapp" },
  { name: "아이폰 카톡 iOS 18 · 25.x 버전", env: { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.1.0" }, inapp: true, kakao: true, ios: true, blocker: "inapp" },
  { name: "아이폰 카톡 최신(숫자 버전)", env: { ua: `${IPHONE} Mobile/15E148 KAKAOTALK 2510130` }, inapp: true, kakao: true, ios: true, blocker: "inapp" },
  { name: "아이폰 카톡 소문자 표기", env: { ua: `${IPHONE} Mobile/15E148 KakaoTalk 10.4.5` }, inapp: true, kakao: true, ios: true, blocker: "inapp" },
  { name: "아이패드 카톡", env: { ua: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5", platform: "iPad" }, inapp: true, kakao: true, ios: true, blocker: "inapp" },
  { name: "안드로이드 카톡", env: { ua: `${ANDROID}; wv) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 KAKAOTALK/2510130`, platform: "Linux armv8l" }, inapp: true, kakao: true, ios: false, blocker: "inapp" },
  { name: "아이폰 네이버 인앱", env: { ua: `${IPHONE} Mobile/15E148 Safari/604.1 NAVER(inapp; search; 1180; 12.8.0; 14PRO)` }, inapp: true, kakao: false, ios: true, blocker: "inapp" },
  { name: "아이폰 인스타그램", env: { ua: `${IPHONE} Mobile/15E148 Instagram 320.0.0.12.99 (iPhone14,2; iOS 17_4; ko_KR)` }, inapp: true, kakao: false, ios: true, blocker: "inapp" },
  { name: "아이폰 페이스북", env: { ua: `${IPHONE} Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0]` }, inapp: true, kakao: false, ios: true, blocker: "inapp" },
  { name: "아이폰 라인", env: { ua: `${IPHONE} Mobile/15E148 Safari Line/13.9.0` }, inapp: true, kakao: false, ios: true, blocker: "inapp" },
  { name: "아이폰 사파리(탭)", env: { ua: `${IPHONE} Version/17.4 Mobile/15E148 Safari/604.1` }, inapp: false, kakao: false, ios: true, blocker: "ios_needs_install" },
  { name: "아이폰 크롬(CriOS)", env: { ua: `${IPHONE} CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1` }, inapp: false, kakao: false, ios: true, blocker: "ios_needs_install" },
  { name: "아이폰 홈 화면 앱(standalone)", env: { ua: `${IPHONE} Mobile/15E148`, standalone: true }, inapp: false, kakao: false, ios: true, blocker: null },
  { name: "아이폰 사파리 '데스크톱 사이트'(MacIntel+터치)", env: { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", platform: "MacIntel", touch: 5 }, inapp: false, kakao: false, ios: true, blocker: "ios_needs_install" },
  { name: "맥 사파리(터치 없음)", env: { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", platform: "MacIntel", touch: 0 }, inapp: false, kakao: false, ios: false, blocker: null },
  { name: "안드로이드 크롬", env: { ua: `${ANDROID}) Chrome/120.0.6099.144 Mobile Safari/537.36`, platform: "Linux armv8l" }, inapp: false, kakao: false, ios: false, blocker: null },
];

let failed = 0;
for (const c of cases) {
  setEnv(c.env);
  const got = { inapp: env.isInAppBrowser(), kakao: env.isKakaoInApp(), ios: env.isIOS(), blocker: env.getPushBlocker() };
  const ok = got.inapp === c.inapp && got.kakao === c.kakao && got.ios === c.ios && got.blocker === c.blocker;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.name} → 인앱 ${got.inapp} · 카톡 ${got.kakao} · iOS ${got.ios} · 막는 이유 ${got.blocker}`);
}
console.log(failed ? `\n실패 ${failed}건` : "\n전부 통과");
process.exit(failed ? 1 : 0);
