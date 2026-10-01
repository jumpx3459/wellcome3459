"use client";

import { useEffect, useRef, useState } from "react";
import { rem } from "@/lib/rem";
import { useBackToClose } from "@/lib/useBackToClose";

// 매물 사진 전체 화면 보기 (2026-09-29) — 옆으로 넘기기, "1/N", 두 손가락 확대(최대 4배)·확대 중 끌어서 이동,
// 두 번 탭하면 2.5배/원래대로, 닫기 버튼·Esc. 확대 중에는 옆 넘기기를 잠가 사진이 밀리지 않게.
const MAX_SCALE = 4;

function ZoomableImage({ src, alt, onZoomChange }: { src: string; alt: string; onZoomChange: (zoomed: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const lastTap = useRef(0);

  useEffect(() => {
    onZoomChange(t.scale > 1.01);
  }, [t.scale, onZoomChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pinch: { dist: number; scale: number } | null = null;
    let pan: { x: number; y: number; tx: number; ty: number } | null = null;
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const clampPos = (scale: number, x: number, y: number) => {
      const w = el.clientWidth, h = el.clientHeight;
      const mx = ((scale - 1) * w) / 2, my = ((scale - 1) * h) / 2;
      return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // 2026-09-30: 두 번째 손가락이 닿는 순간 막아야 가로 넘기기 스크롤이 먼저 잡혀
        // 이후 touchmove의 preventDefault가 무시되는(=핀치가 안 먹는) 경우를 피함
        if (e.cancelable) e.preventDefault();
        pinch = { dist: dist(e.touches[0], e.touches[1]), scale: tRef.current.scale };
        pan = null;
      } else if (e.touches.length === 1 && tRef.current.scale > 1.01) {
        pan = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: tRef.current.x, ty: tRef.current.y };
      }
    };
    const onMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const scale = Math.max(1, Math.min(MAX_SCALE, (pinch.scale * dist(e.touches[0], e.touches[1])) / pinch.dist));
        setT((cur) => ({ scale, ...clampPos(scale, cur.x, cur.y) }));
      } else if (pan && e.touches.length === 1) {
        e.preventDefault();
        const p = clampPos(tRef.current.scale, pan.tx + e.touches[0].clientX - pan.x, pan.ty + e.touches[0].clientY - pan.y);
        setT((cur) => ({ ...cur, ...p }));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
      if (e.touches.length === 0) {
        pan = null;
        if (tRef.current.scale < 1.05) setT({ scale: 1, x: 0, y: 0 });
      }
    };
    // iOS Safari: 페이지 전체 확대(gesture*)가 사진 확대 대신 잡히지 않게
    const onGesture = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("gesturestart", onGesture, { passive: false });
    el.addEventListener("gesturechange", onGesture, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("gesturestart", onGesture);
      el.removeEventListener("gesturechange", onGesture);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const toggleZoom = () => setT((cur) => (cur.scale > 1.01 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));

  return (
    <div
      ref={ref}
      data-zoomable
      className="w-full h-full flex items-center justify-center overflow-hidden"
      style={{ touchAction: t.scale > 1.01 ? "none" : "pan-x" }}
      onDoubleClick={toggleZoom}
      onTouchEnd={(e) => {
        if (e.touches.length > 0 || e.changedTouches.length !== 1) return;
        const now = Date.now();
        if (now - lastTap.current < 300) toggleZoom();
        lastTap.current = now;
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-full object-contain select-none"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transition: pinchTransition(t.scale) }}
      />
    </div>
  );
}
const pinchTransition = (scale: number) => (scale === 1 ? "transform 0.15s ease-out" : "none");

export default function PhotoViewer({
  images,
  alt,
  startIndex,
  onClose,
  onIndexChange,
}: {
  images: string[];
  alt: string;
  startIndex: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  // 2026-10-01 PR-C: 열려 있으면 안드로이드 뒤로가기 = 이것만 닫기 (src/lib/useBackToClose.ts)
  useBackToClose(true, onClose);
  // 2026-09-30: 열 때 2.5초 동안 가운데 흐린 확대 안내 (누르기·확대를 막지 않게 pointer-events 없음)
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const go = (d: number) => {
    const tr = trackRef.current;
    if (!tr) return;
    const next = Math.max(0, Math.min(images.length - 1, Math.round(tr.scrollLeft / tr.clientWidth) + d));
    tr.scrollTo({ left: next * tr.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const tr = trackRef.current;
    if (tr) tr.scrollLeft = startIndex * tr.clientWidth;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const tr = trackRef.current;
    if (!tr) return;
    const i = Math.round(tr.scrollLeft / tr.clientWidth);
    if (i !== index) {
      setIndex(i);
      setZoomed(false);
      onIndexChange?.(i);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000" }} role="dialog" aria-modal="true" aria-label="사진 전체 화면">
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: "calc(var(--sat) + 8px) 12px 8px 16px" }}>
        <span className="font-bold text-white" style={{ fontSize: rem(16) }} data-viewer-counter>
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex items-center justify-center text-white rounded-full"
          style={{ width: 44, height: 44, fontSize: rem(26), background: "rgba(255,255,255,0.12)" }}
        >
          ×
        </button>
      </div>
      <div
        aria-hidden
        data-zoom-hint
        className="absolute left-1/2 top-1/2 pointer-events-none rounded-full text-white font-bold whitespace-nowrap"
        style={{
          transform: "translate(-50%, -50%)",
          zIndex: 1,
          fontSize: rem(15),
          padding: "10px 18px",
          background: "rgba(0,0,0,0.55)",
          opacity: hint && !zoomed ? 1 : 0,
          transition: "opacity 0.4s ease-out",
        }}
      >
        🔍 두 손가락으로 확대
      </div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex-1 flex"
        style={{ overflowX: zoomed ? "hidden" : "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        {images.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full" style={{ scrollSnapAlign: "center" }}>
            <ZoomableImage src={src} alt={`${alt} 사진 ${i + 1}`} onZoomChange={i === index ? setZoomed : noop} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6 flex-shrink-0" style={{ padding: "8px 0 calc(var(--sab) + 14px)", minHeight: 64 }}>
        {images.length > 1 && (
          <button type="button" aria-label="이전 사진" onClick={() => go(-1)} disabled={index === 0} className="text-white rounded-full disabled:opacity-30" style={{ width: 48, height: 48, fontSize: rem(24), background: "rgba(255,255,255,0.12)" }}>
            ‹
          </button>
        )}
        <span className="text-white/70" style={{ fontSize: rem(14) }}>두 손가락으로 확대 · 두 번 탭</span>
        {images.length > 1 && (
          <button type="button" aria-label="다음 사진" onClick={() => go(1)} disabled={index === images.length - 1} className="text-white rounded-full disabled:opacity-30" style={{ width: 48, height: 48, fontSize: rem(24), background: "rgba(255,255,255,0.12)" }}>
            ›
          </button>
        )}
      </div>
    </div>
  );
}
const noop = () => {};
