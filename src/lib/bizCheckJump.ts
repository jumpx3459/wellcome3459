// 2026-10-04 fix/business-check-shortcut — "사업자 조회 바로가기"(매물 등록 폼·수정 카드)와 판매 신청 카드 [사업자 조회]가 쓰는 이동 함수.
// 대상은 BusinessCheckSection 맨 바깥 div의 id(항상 렌더됨 — 접히는 카드가 아님). PC 3단에서는 같은 화면 안에 이미 보일 수 있어
// 스크롤만으로는 눌러도 반응이 없는 것처럼 보였음 → 이동하면서 테두리를 잠깐 강조한다.
export const BIZ_CHECK_ID = "business-check";

/** 사업자 조회 섹션으로 스크롤하고 잠깐 강조. 섹션이 없으면 false */
export function scrollToBizCheck(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(BIZ_CHECK_ID);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.style.transition = "box-shadow 0.25s";
  el.style.boxShadow = "0 0 0 3px #E25100";
  window.setTimeout(() => {
    el.style.boxShadow = "";
  }, 1800);
  return true;
}
