// 인라인 style의 글자 크기를 rem으로 쓰기 위한 헬퍼. 디자인 값(px)을 그대로 넘기면
// 루트 글자 크기 기준 rem으로 바꿔준다 — 사용자가 브라우저/OS 글자 크기를 키우면 같이 커짐
// (px 고정값은 따라가지 않았음).
// 기준: globals.css의 html { font-size: 112.5% } → 기본 브라우저(16px)에서 1rem = 18px.
// 루트 크기를 바꾸면 ROOT_PX도 같이 바꿀 것.
const ROOT_PX = 18;

// 2026-09-28: 모바일 최소 글씨 — 보조 문구 13px 이상 (그보다 작게 넘겨도 13px로 올림)
export const MIN_TEXT_PX = 13;

export function rem(px: number): string {
  return `${+(Math.max(px, MIN_TEXT_PX) / ROOT_PX).toFixed(4)}rem`;
}
