"use client";

import { useRef, useState, type ReactNode } from "react";

// 2026-10-02 (PR-C1): 관리자 대시보드 목록 카드 공통 틀 — 예전엔 카드마다 maxHeight 480 + overflow-y-auto라
// 카드 안에서 따로 스크롤해야 했음. 이제 안쪽 스크롤 없이 페이지 흐름대로 길어지고, 기본 limit건만 보이다
// [전체 보기 (n건)] → 전체, [줄이기] → 다시 limit건 + 카드 제목이 화면 밖이면 제목으로 스크롤.
// 가로 넘침은 overflow-x: clip으로 막음(overflow-x-auto·hidden은 세로 축까지 auto로 바뀌어 다시 안쪽 스크롤이 생김).
export default function AdminListCard<T>({
  id,
  as = "div",
  className,
  title,
  open,
  onToggle,
  toolbar,
  after,
  items,
  renderItem,
  empty,
  listClassName,
  limit = 5,
}: {
  id?: string;
  as?: "div" | "section";
  className: string;
  title: ReactNode;
  /** open·onToggle을 안 주면 접기 없이 항상 펼친 카드 (진행 중인 매물) */
  open?: boolean;
  onToggle?: () => void;
  /** 펼쳤을 때 목록 위에 붙는 검색·필터 등 */
  toolbar?: ReactNode;
  /** 목록 아래에 붙는 것 (회원 목록 자체 더보기) */
  after?: ReactNode;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** 목록이 비었을 때 (불러오는 중 표시 포함) */
  empty?: ReactNode;
  /** 목록을 따로 감쌀 때의 클래스 — 없으면 카드 바로 아래에 줄지어 놓임 */
  listClassName?: string;
  /** null이면 줄이기 없이 전부 (회원 목록처럼 자체 더보기가 있는 카드) */
  limit?: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const Wrapper = as;
  const isOpen = open ?? true;
  const collapsible = limit != null && items.length > limit;
  const visible = collapsible && !showAll ? items.slice(0, limit) : items;

  const shrink = () => {
    setShowAll(false);
    // 줄어든 뒤 위치 기준으로 판단 — 제목이 화면 밖(위로 지나감)일 때만 제목으로 이동
    requestAnimationFrame(() => {
      const el = headerRef.current;
      if (!el) return;
      const { top, bottom } = el.getBoundingClientRect();
      if (top < 0 || bottom > window.innerHeight) el.scrollIntoView({ block: "start" });
    });
  };

  const header = (
    <span className="min-w-0">{title}</span>
  );

  const footer = collapsible ? (
    <button
      type="button"
      onClick={showAll ? shrink : () => setShowAll(true)}
      className="w-full text-sm font-bold text-navy border-2 border-gray200 rounded-xl py-2.5"
    >
      {showAll ? "줄이기 ▲" : `전체 보기 (${items.length}건)`}
    </button>
  ) : null;

  return (
    <Wrapper id={id} className={`${className} min-w-0 overflow-x-clip`}>
      <div ref={headerRef} style={{ scrollMarginTop: 12 }}>
        {onToggle ? (
          <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-left">
            {header}
            <span className="text-sm font-bold text-gray500 flex-shrink-0">{isOpen ? "접기 ▲" : "펼치기 ▼"}</span>
          </button>
        ) : (
          header
        )}
      </div>
      {isOpen && (
        <>
          {toolbar}
          {items.length === 0 && empty}
          {listClassName ? (
            (visible.length > 0 || footer) && (
              <div className={listClassName}>
                {visible.map(renderItem)}
                {footer}
              </div>
            )
          ) : (
            <>
              {visible.map(renderItem)}
              {footer}
            </>
          )}
          {after}
        </>
      )}
    </Wrapper>
  );
}
