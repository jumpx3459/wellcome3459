"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { rem } from "@/lib/rem";

// 매물 상세 히어로 사진 (2026-09-29) — 화면 폭 전체 1:1, 옆으로 넘기기(scroll-snap), 오른쪽 아래 "1/N".
// 사진을 누르면 onOpen(index) → PhotoViewer 전체 화면. 첫 장만 바로 불러오고 나머지는 lazy.
// 2026-10-09 PR 4a(상세 첫 화면 B안): 비율을 ratio로(상세는 3:2), 사진 아래 점(현재 장 표시·누르면 그 장으로) — 썸네일 줄 대신.
//   오른쪽 아래 칩은 "1/N"(띄어쓰기 없음), 1장이면 예전처럼 "🔍 확대". 점은 사진 안 아래 가운데(흰 점 — 첫 화면 세로 공간 절약)
export type PhotoCarouselHandle = { scrollToIndex: (i: number) => void };

const PhotoCarousel = forwardRef<
  PhotoCarouselHandle,
  { images: string[]; alt: string; index: number; onIndexChange: (i: number) => void; onOpen: (i: number) => void; overlay?: ReactNode; ratio?: string }
>(function PhotoCarousel({ images, alt, index, onIndexChange, onOpen, overlay, ratio = "1/1" }, ref) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollToIndex = (i: number) => {
    const tr = trackRef.current;
    if (tr) tr.scrollTo({ left: i * tr.clientWidth, behavior: "smooth" });
  };
  useImperativeHandle(ref, () => ({ scrollToIndex }));

  return (
    <div className="relative w-full" style={{ aspectRatio: ratio }} data-hero>
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
        {images.length > 1 ? `${index + 1}/${images.length}` : "🔍 확대"}
      </div>
    {images.length > 1 && (
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center" style={{ bottom: 8, gap: 2 }} data-hero-dots>
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              onIndexChange(i);
              scrollToIndex(i);
            }}
            aria-label={`사진 ${i + 1} 보기`}
            aria-current={i === index ? "true" : undefined}
            className="flex items-center justify-center"
            style={{ width: 14, height: 14 }}
          >
            <span className="block rounded-full" style={{ width: i === index ? 16 : 6, height: 6, background: i === index ? "#fff" : "rgba(255,255,255,0.55)", boxShadow: "0 0 3px rgba(0,0,0,.35)", transition: "width .15s" }} />
          </button>
        ))}
      </div>
    )}
    </div>
  );
});

export default PhotoCarousel;
