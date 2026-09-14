"use client";

import { useRef, type ReactNode, type WheelEvent } from "react";

/**
 * 가로 스크롤 칩 목록을 감싸는 래퍼.
 * PC(마우스) 사용자를 위해 좌우 화살표 버튼과, 세로 휠 스크롤을
 * 가로 스크롤로 변환하는 기능을 추가한다. 모바일 터치 스와이프는
 * 그대로 동작(변경 없음).
 */
export default function CategoryScroller({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    // 세로 스크롤이 가로 스크롤보다 뚜렷할 때만 가로 스크롤로 변환
    // (트랙패드의 자연스러운 가로 스크롤은 그대로 둠)
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY;
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="왼쪽으로 스크롤"
        onClick={() => scrollByAmount(-220)}
        className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-7 h-7 rounded-full bg-white border border-gray200 shadow text-navy text-sm"
      >
        ‹
      </button>
      <div ref={scrollRef} onWheel={handleWheel} className={className}>
        {children}
      </div>
      <button
        type="button"
        aria-label="오른쪽으로 스크롤"
        onClick={() => scrollByAmount(220)}
        className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-7 h-7 rounded-full bg-white border border-gray200 shadow text-navy text-sm"
      >
        ›
      </button>
    </div>
  );
}
