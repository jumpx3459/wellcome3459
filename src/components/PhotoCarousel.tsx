"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { rem } from "@/lib/rem";

// 매물 상세 히어로 사진 (2026-09-29) — 화면 폭 전체 1:1, 옆으로 넘기기(scroll-snap), 오른쪽 아래 "1/N".
// 사진을 누르면 onOpen(index) → PhotoViewer 전체 화면. 첫 장만 바로 불러오고 나머지는 lazy.
export type PhotoCarouselHandle = { scrollToIndex: (i: number) => void };

const PhotoCarousel = forwardRef<
  PhotoCarouselHandle,
  { images: string[]; alt: string; index: number; onIndexChange: (i: number) => void; onOpen: (i: number) => void; overlay?: ReactNode }
>(function PhotoCarousel({ images, alt, index, onIndexChange, onOpen, overlay }, ref) {
  const trackRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    scrollToIndex: (i: number) => {
      const tr = trackRef.current;
      if (tr) tr.scrollTo({ left: i * tr.clientWidth, behavior: "smooth" });
    },
  }));

  return (
    <div className="relative w-full" style={{ aspectRatio: "1/1" }} data-hero>
      <div
        ref={trackRef}
        className="absolute inset-0 flex"
        style={{ overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
        onScroll={() => {
          const tr = trackRef.current;
          if (!tr) return;
          const i = Math.round(tr.scrollLeft / tr.clientWidth);
          if (i !== index) onIndexChange(i);
        }}
      >
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`사진 ${i + 1} 크게 보기`}
            className="relative flex-shrink-0 w-full h-full"
            style={{ scrollSnapAlign: "center" }}
          >
            <img
              src={src}
              alt={i === 0 ? alt : `${alt} 사진 ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
      {overlay}
      <div
        className="absolute bottom-3 right-3 inline-flex items-center gap-1 font-bold text-white rounded-full pointer-events-none"
        style={{ fontSize: rem(14), padding: "3px 10px", background: "rgba(0,0,0,0.55)" }}
        data-hero-counter
      >
        {images.length > 1 ? `${index + 1} / ${images.length}` : "🔍 확대"}
      </div>
    </div>
  );
});

export default PhotoCarousel;
