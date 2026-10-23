"use client";

import { useEffect, useRef, useState } from "react";
import { rem } from "@/lib/rem";
import { useBackToClose } from "@/lib/useBackToClose";

// 2026-10-23 관리자 매물 패널 사진 확대·영상 재생(라이트박스). 회원용 PhotoViewer(핀치 확대 중심)와 별개 — 영상 항목·대표 사진 표시·패널 Esc와 겹치지 않는 처리.
// - ←/→ 키·화살표 버튼, "3 / 9", 첫 사진 "대표 사진", 영상은 사진 다음에 같은 줄로 넘겨 봄
// - Esc·바깥 클릭 = 이 라이트박스만 닫힘. Esc는 window 캡처 단계에서 가로채 패널(버블 단계 Esc)과 dirty 상태에 영향 없음
// - 영상 재생 실패(onError·코덱 미지원) → 안내 + 원본 링크(파일 다운로드)
// - 안드로이드 뒤로가기는 이것만 닫음(useBackToClose)

export type LightboxItem = { type: "image" | "video"; src: string };

export default function AdminMediaLightbox({ items, startIndex, onClose }: { items: LightboxItem[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(Math.max(0, Math.min(items.length - 1, startIndex)));
  const [videoFailed, setVideoFailed] = useState<Record<string, boolean>>({});
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useBackToClose(true, onClose);

  const go = (d: number) => setIndex((i) => Math.max(0, Math.min(items.length - 1, i + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation(); // 패널의 Esc(window 버블)로 안 넘어감
        e.preventDefault();
        closeRef.current();
      } else if (e.key === "ArrowRight") {
        e.stopImmediatePropagation();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.stopImmediatePropagation();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey, true); // 캡처 단계 — 패널·폼의 keydown보다 먼저
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (items.length === 0) return null;
  const cur = items[index];
  const isLead = cur.type === "image" && items.slice(0, index).every((i) => i.type !== "image"); // 첫 사진 = 대표
  const btn = { width: 48, height: 48, fontSize: rem(24), background: "rgba(255,255,255,0.14)" } as const;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)", zIndex: 70 }}
      role="dialog"
      aria-modal="true"
      aria-label="사진·영상 크게 보기"
      onClick={onClose}
      data-media-lightbox
    >
      <div className="flex items-center justify-between px-5 flex-shrink-0" style={{ height: 56 }}>
        <div className="flex items-center gap-2 text-white font-bold" style={{ fontSize: rem(16) }}>
          <span data-lightbox-counter>
            {index + 1} / {items.length}
          </span>
          {isLead && (
            <span className="rounded-full font-bold" style={{ fontSize: rem(13), padding: "2px 10px", background: "#0B2540", color: "#fff" }} data-lightbox-lead>
              대표 사진
            </span>
          )}
          {cur.type === "video" && (
            <span className="rounded-full font-bold" style={{ fontSize: rem(13), padding: "2px 10px", background: "rgba(255,255,255,0.18)" }}>
              영상
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="크게 보기 닫기"
          className="text-white rounded-full"
          style={{ width: 40, height: 40, fontSize: rem(20), background: "rgba(255,255,255,0.14)" }}
          data-lightbox-close
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center gap-3 px-3 pb-5">
        {items.length > 1 ? (
          <button
            type="button"
            aria-label="이전"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            disabled={index === 0}
            className="text-white rounded-full flex-shrink-0 disabled:opacity-30"
            style={btn}
            data-lightbox-prev
          >
            ‹
          </button>
        ) : (
          <span style={{ width: 48 }} className="flex-shrink-0" />
        )}

        <div className="min-w-0 min-h-0 flex-1 h-full flex items-center justify-center">
          {cur.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.src} alt={`사진 ${index + 1}`} className="object-contain rounded-lg" style={{ maxWidth: "100%", maxHeight: "100%" }} onClick={(e) => e.stopPropagation()} data-lightbox-image />
          ) : videoFailed[cur.src] ? (
            <div className="rounded-xl text-center" style={{ background: "#fff", padding: "20px 24px", maxWidth: 420 }} onClick={(e) => e.stopPropagation()} data-video-error>
              <p className="font-bold" style={{ fontSize: rem(16), color: "#0B2540" }}>
                이 브라우저에서 재생할 수 없는 형식이에요
              </p>
              <a href={cur.src} download target="_blank" rel="noreferrer" className="inline-block mt-3 font-bold underline" style={{ fontSize: rem(15), color: "#0B2540" }}>
                파일 다운로드
              </a>
            </div>
          ) : (
            <video
              key={cur.src}
              src={cur.src}
              controls
              playsInline
              preload="metadata"
              className="rounded-lg bg-black"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
              onClick={(e) => e.stopPropagation()}
              onError={() => setVideoFailed((f) => ({ ...f, [cur.src]: true }))}
              data-lightbox-video
            />
          )}
        </div>

        {items.length > 1 ? (
          <button
            type="button"
            aria-label="다음"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            disabled={index === items.length - 1}
            className="text-white rounded-full flex-shrink-0 disabled:opacity-30"
            style={btn}
            data-lightbox-next
          >
            ›
          </button>
        ) : (
          <span style={{ width: 48 }} className="flex-shrink-0" />
        )}
      </div>
    </div>
  );
}
