// 2026-10-03: 가격 글자 — 금액·단위를 덩어리로 나눠 각 덩어리는 끊기지 않게(whitespace-nowrap), 자리가 모자랄 때만 덩어리 사이에서 줄바꿈.
// 감싸는 요소에는 whitespace-nowrap을 걸지 말 것(걸면 사이 줄바꿈도 막혀 카드 밖으로 넘침). 홈 카드·/deals 목록·상세 공통.
// 2026-10-08 4b-1 수정: "원"은 금액 쪽에 붙임 — 줄바꿈은 단위("(일괄)"·"/kg") 앞에서만.
//   "1억 2,000만원(일괄)" → [1억] [2,000만원] | [(일괄)]  ·  "30,000원/kg" → [30,000원] | [/kg]
//   금액 안에서는 억·만 사이 띄어쓰기에서만 줄바꿈 허용(숫자 중간은 안 끊김). 한 줄에 들어가면 한 줄.
import { Fragment } from "react";

export function splitPriceText(text: string): { amount: string[]; unit: string } | null {
  const i = text.indexOf("원");
  if (i <= 0) return null;
  return { amount: text.slice(0, i + 1).split(" ").filter(Boolean), unit: text.slice(i + 1) };
}

export default function PriceText({ text }: { text: string }) {
  const parts = splitPriceText(text);
  if (!parts) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <>
      {parts.amount.map((g, k) => (
        <Fragment key={k}>
          {k > 0 && " "}
          <span className="whitespace-nowrap">{g}</span>
        </Fragment>
      ))}
      {parts.unit && (
        <>
          <wbr />
          <span className="whitespace-nowrap">{parts.unit}</span>
        </>
      )}
    </>
  );
}
