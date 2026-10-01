"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { mockCategories, categoryIcons } from "@/lib/mockData";
import { FORM_CHIP_FONT_SIZE } from "@/components/FormField";
import { rem } from "@/lib/rem";

// sell·buy 카테고리 칩 (2026-09-29) — 줄바꿈으로 18개가 다 펼쳐지면 약 9줄이라 기본은 2줄만 보이고
// "더보기"로 펼침. 줄 수는 화면 폭에 따라 달라서 실제 높이로 판단(2줄 안에 다 들어가면 버튼 없음).

// neutral: 매물 폼(/sell) — 선택을 주황 대신 회색 테두리+채움으로 (2026-10-01, 주황은 필수·주 버튼·오류에만)
export default function CategoryChips({ value, onPick, neutral }: { value: string; onPick: (c: string) => void; neutral?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [twoRowHeight, setTwoRowHeight] = useState<number | null>(null);
  const [overflows, setOverflows] = useState(false);
  // 2026-10-01: 접힌 상태(2줄)에서 가려진 칩은 Tab으로 못 가게 — 예전엔 안 보이는 칩에 포커스가 가며 칩 상자가 스크롤됐음
  const [visibleCount, setVisibleCount] = useState(mockCategories.length);

  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const first = box?.firstElementChild as HTMLElement | null;
      if (!box || !first) return;
      const rowGap = parseFloat(getComputedStyle(box).rowGap) || 0; // gap-1.5 = 0.375rem (루트 18px → 6.75px)
      const h = Math.ceil(first.getBoundingClientRect().height * 2 + rowGap);
      setTwoRowHeight(h);
      setOverflows(box.scrollHeight > h + 1);
      const top = box.getBoundingClientRect().top;
      setVisibleCount([...box.children].filter((el) => el.getBoundingClientRect().bottom - top <= h + 1).length);
    };
    measure();
    // 폭이 바뀌면(화면 회전·접혀 있던 묶음이 펼쳐짐 등) 다시 잼
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div>
      <div
        ref={boxRef}
        className="flex flex-wrap gap-1.5 overflow-hidden"
        style={{ maxHeight: open || twoRowHeight === null ? undefined : twoRowHeight }}
      >
        {mockCategories.map((c, i) => {
          const picked = value === c;
          const hidden = !open && overflows && i >= visibleCount;
          return (
            <button
              key={c}
              type="button"
              tabIndex={hidden ? -1 : undefined}
              aria-hidden={hidden || undefined}
              onClick={() => onPick(picked ? "" : c)}
              className="flex items-center gap-1 rounded-full whitespace-nowrap"
              style={{
                padding: "9px 13px",
                fontSize: FORM_CHIP_FONT_SIZE,
                fontWeight: 700,
                background: "#fff",
                border: picked ? (neutral ? "2px solid #6B7480" : "2px solid var(--color-brandOrange)") : "1.5px solid #E4E7EB",
                ...(picked && neutral ? { background: "#F3F4F6" } : {}),
                color: "#1A1F26",
              }}
            >
              <span>{categoryIcons[c]}</span>
              {c}
            </button>
          );
        })}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1.5 font-bold"
          style={{ fontSize: rem(15), color: "#4B5563", minHeight: 44 }}
        >
          {open ? "접기 ▴" : `더보기 ▾ (전체 ${mockCategories.length}개)`}
        </button>
      )}
    </div>
  );
}
