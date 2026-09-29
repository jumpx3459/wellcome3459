"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { mockCategories, categoryIcons } from "@/lib/mockData";
import { FORM_CHIP_FONT_SIZE } from "@/components/FormField";
import { rem } from "@/lib/rem";

// sell·buy 카테고리 칩 (2026-09-29) — 줄바꿈으로 18개가 다 펼쳐지면 약 9줄이라 기본은 2줄만 보이고
// "더보기"로 펼침. 줄 수는 화면 폭에 따라 달라서 실제 높이로 판단(2줄 안에 다 들어가면 버튼 없음).

export default function CategoryChips({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [twoRowHeight, setTwoRowHeight] = useState<number | null>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const first = box?.firstElementChild as HTMLElement | null;
      if (!box || !first) return;
      const rowGap = parseFloat(getComputedStyle(box).rowGap) || 0; // gap-1.5 = 0.375rem (루트 18px → 6.75px)
      const h = Math.ceil(first.getBoundingClientRect().height * 2 + rowGap);
      setTwoRowHeight(h);
      setOverflows(box.scrollHeight > h + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div>
      <div
        ref={boxRef}
        className="flex flex-wrap gap-1.5 overflow-hidden"
        style={{ maxHeight: open || twoRowHeight === null ? undefined : twoRowHeight }}
      >
        {mockCategories.map((c) => {
          const picked = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onPick(picked ? "" : c)}
              className="flex items-center gap-1 rounded-full whitespace-nowrap"
              style={{
                padding: "9px 13px",
                fontSize: FORM_CHIP_FONT_SIZE,
                fontWeight: 700,
                background: "#fff",
                border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
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
