"use client";

import { useRef, useState, type ReactNode } from "react";
import { rem } from "@/lib/rem";
import { LIST_CARD_BAND_BG } from "@/components/admin/cardTitle";

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
  flash = false,
  badges,
}: {
  /** 제목 옆 건수 알약 배지 — 조치형 건수 1건 이상 = orange, 0건·총계형 = gray(건수 계산은 부르는 쪽 기존 기준 그대로) */
  badges?: { text: string; tone: "orange" | "gray"; testId?: string }[];
  /** "조치 필요" 클릭으로 이동했을 때 테두리를 잠깐 강조(globals.css [data-flash]) */
  flash?: boolean;
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

  // 2026-10-24 제목 줄: 연한 남색 띠(카드 가장자리까지, PC 카드는 위쪽 모서리 둥글기 맞춤) + 건수 알약 배지 + 큰 [접기] 영역.
  // 카드 안쪽 여백(p-4 / px-5)을 음수 여백으로 상쇄해 띠를 가장자리까지 늘림 — 부르는 쪽 className으로 PC 카드(p-4)·모바일(px-5)을 구분
  const bleed = /\bp-4\b/.test(className) ? "-mx-4 -mt-4 px-4 rounded-t-2xl" : /\bpx-5\b/.test(className) ? "-mx-5 px-5" : "";
  const BADGE = { orange: { background: "#FFEDD5", color: "#9A3412" }, gray: { background: "#E5E7EB", color: "#374151" } } as const;
  const header = (
    <span className="min-w-0 flex items-center gap-x-2 gap-y-1 flex-wrap">
      {title}
      {badges && badges.length > 0 && (
        <span className="flex items-center gap-1.5 flex-wrap" data-card-badges>
          {badges.map((b) => (
            <span
              key={b.text}
              className="inline-flex items-center rounded-full font-bold whitespace-nowrap"
              style={{ fontSize: rem(14), padding: "2px 10px", ...BADGE[b.tone] }}
              data-card-badge={b.tone}
              data-testid={b.testId}
            >
              {b.text}
            </span>
          ))}
        </span>
      )}
    </span>
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
    <Wrapper id={id} data-flash={flash ? "1" : undefined} className={`${className} min-w-0 overflow-x-clip`}>
      <div ref={headerRef} className={`${bleed} py-2`} style={{ scrollMarginTop: 12, background: LIST_CARD_BAND_BG }} data-card-band>
        {onToggle ? (
          <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-left" style={{ minHeight: 44 }} data-card-toggle>
            {header}
            <span
              className="font-bold flex-shrink-0 flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44, fontSize: rem(14), color: "#3730A3" }}
            >
              {isOpen ? "접기 ▲" : "펼치기 ▼"}
            </span>
          </button>
        ) : (
          <div className="flex items-center" style={{ minHeight: 44 }}>
            {header}
          </div>
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
