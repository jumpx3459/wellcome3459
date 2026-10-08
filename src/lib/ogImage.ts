// 공유 미리보기(og) 기본 이미지 (2026-10-08 4b-1) — 1200×630, 흰 바탕에 로고(public/images/logo-og.png) 높이 460px 가운데.
// ?v=3: 카카오톡·CDN이 예전 이미지(logo-og.png 888×772)를 들고 있지 않게 주소를 바꿈. 이미 공유된 링크는 카카오 공유 디버거에서 초기화.
// 루트 layout과, 사진 없는 매물 상세(자식 openGraph가 부모를 통째로 덮어써 기본 이미지가 사라짐)에서 같이 씀.
export const DEFAULT_OG_IMAGE = { url: "/images/og-1200x630.png?v=3", width: 1200, height: 630, alt: "덤핑점핑" };
