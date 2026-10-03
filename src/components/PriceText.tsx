// 2026-10-03: 가격 글자 — "128,000원/박스"를 숫자("128,000")·단위("원/박스") 두 덩어리로.
// 각 덩어리는 끊기지 않고(whitespace-nowrap), 자리가 모자랄 때만 숫자와 단위 사이에서 줄바꿈(<wbr>). 자리가 있으면 한 줄.
// 감싸는 요소에는 whitespace-nowrap을 걸지 말 것(걸면 사이 줄바꿈도 막혀 카드 밖으로 넘침). 홈 카드·/deals 목록·상세 공통.
export default function PriceText({ text }: { text: string }) {
  const i = text.indexOf("원");
  if (i <= 0) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <>
      <span className="whitespace-nowrap">{text.slice(0, i)}</span>
      <wbr />
      <span className="whitespace-nowrap">{text.slice(i)}</span>
    </>
  );
}
