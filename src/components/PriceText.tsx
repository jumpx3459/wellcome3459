// 2026-10-03: 가격 글자 — "128,000원/박스"를 숫자("128,000")·단위("원/박스") 두 덩어리로.
// 각 덩어리는 끊기지 않고(whitespace-nowrap), 자리가 모자랄 때만 숫자와 단위 사이에서 줄바꿈(<wbr>). 자리가 있으면 한 줄.
// 감싸는 요소에는 whitespace-nowrap을 걸지 말 것(걸면 사이 줄바꿈도 막혀 카드 밖으로 넘침). 홈 카드·/deals 목록·상세 공통.
// 2026-10-08 4b-1: 1억 이상 한글 표기("1억 2,000만원/박스", "1억 2,345만 6,789원")도 처음 나오는 "원"이 금액 끝이라
// 숫자 덩어리("1억 2,000만")는 띄어쓰기가 있어도 한 덩어리(nowrap) — 금액 중간에서 끊기지 않음. 나누기는 splitPriceText
export function splitPriceText(text: string): [string, string] | null {
  const i = text.indexOf("원");
  return i > 0 ? [text.slice(0, i), text.slice(i)] : null;
}

export default function PriceText({ text }: { text: string }) {
  const parts = splitPriceText(text);
  if (!parts) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <>
      <span className="whitespace-nowrap">{parts[0]}</span>
      <wbr />
      <span className="whitespace-nowrap">{parts[1]}</span>
    </>
  );
}
