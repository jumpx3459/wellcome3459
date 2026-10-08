import type { MouseEvent, KeyboardEvent } from "react";
import CountdownBadge from "@/components/CountdownBadge";
import NoPhotoPlaceholder from "@/components/NoPhotoPlaceholder";
import { rem } from "@/lib/rem";

// 매물 카드 이미지 영역 — /deals 목록·회원 홈(넓은 카드)의 실매물·예시 카드 공용 (2026-09-29).
// 배지 위치 고정: 할인율 왼쪽 위, 남은 시간(또는 "마감됨") 오른쪽 위.
// 예시 카드는 레이아웃은 같고 회색 톤으로만 구분 ("예시" 라벨은 카드 본문 쪽).
// 사진이 있으면 4:3(2026-09-29, 예전 16:9), 없으면 3:1로 낮춰서 빈 자리표시가 가격보다 커 보이지 않게.
export default function DealCardMedia({
  image,
  alt,
  category,
  discountPct,
  closesAt,
  closed = false,
  example = false,
  videoUrl = null,
  imageCount = 0,
  onMediaClick,
  className = "",
  eager = false,
  ratio = "4/3",
  tag = null,
}: {
  image?: string | null;
  alt: string;
  category: string;
  discountPct: number; // 반올림된 정수, 0 이하면 배지 없음
  closesAt?: string;
  closed?: boolean;
  example?: boolean;
  videoUrl?: string | null;
  imageCount?: number;
  onMediaClick?: (e: MouseEvent) => void; // 회원 홈: 사진 눌러 크게 보기
  className?: string;
  eager?: boolean; // 첫 화면에 보이는 카드만 바로 불러오기 — 나머지는 스크롤할 때(lazy)
  ratio?: string; // 사진이 있을 때 가로:세로 — 기본 4/3, /deals 카드는 1/1(2026-10-04 v2)
  tag?: string | null; // 사진 위 왼쪽 아래 오버레이(카테고리·시즌 태그) — 반투명 네이비 바탕 흰 글자
}) {
  const clickable = !!image && !!onMediaClick;
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: image ? ratio : "3/1" }}
      {...(clickable
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onMediaClick,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") onMediaClick!(e as unknown as MouseEvent);
            },
          }
        : {})}
    >
      {image ? (
        <img
          src={image}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="w-full h-full object-cover"
          style={{ filter: closed ? "grayscale(40%)" : example ? "grayscale(30%)" : "none" }}
        />
      ) : (
        <NoPhotoPlaceholder category={category} muted={closed || example} />
      )}
      {image && videoUrl && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,.25)" }}>
          <span style={{ fontSize: rem(30), color: "#fff" }}>▶</span>
        </span>
      )}
      {/* 아래 줄: 왼쪽 태그 · 오른쪽 사진 장수 — 한 줄(flex)에 두어 큰 글자·긴 태그에서도 겹치지 않음(태그가 말줄임으로 줄어듦).
          2026-10-08 4b-1: 장수는 "1/N" 대신 "📷 N장", 2장 이상일 때만 */}
      {(tag || (image && imageCount > 1)) && (
        <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2 pointer-events-none">
          {tag && (
            <div
              className="min-w-0 rounded-full font-bold text-white truncate"
              style={{ background: "rgba(11,37,64,0.74)", fontSize: rem(13), lineHeight: 1.3, padding: "3px 10px" }}
              data-media-tag
            >
              {tag}
            </div>
          )}
          {image && imageCount > 1 && (
            <span
              className="ml-auto flex-shrink-0 rounded font-bold text-white whitespace-nowrap"
              style={{ fontSize: rem(13), lineHeight: 1.3, padding: "3px 7px", background: "rgba(0,0,0,.5)" }}
              data-photo-count
            >
              📷 {imageCount}장
            </span>
          )}
        </div>
      )}
      {!closed && discountPct > 0 && (
        <div
          className="absolute top-2 left-2 font-black text-white rounded-full pointer-events-none"
          style={{ background: example ? "rgba(107,116,128,0.78)" : "rgba(226,81,0,0.78)", fontSize: rem(20), lineHeight: 1.2, padding: "2px 10px" }}
        >
          -{discountPct}%
        </div>
      )}
      <div className="absolute top-2 right-2 pointer-events-none">
        {closed ? (
          <span className="font-bold text-white bg-gray500 rounded-full shadow" style={{ fontSize: rem(16), padding: "2px 10px" }}>마감됨</span>
        ) : closesAt ? (
          <div className="rounded-full shadow" style={{ background: "rgba(255,255,255,0.94)" }}>
            <CountdownBadge closesAt={closesAt} tone={example ? "muted" : "urgent"} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
