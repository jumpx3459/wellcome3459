import Link from "next/link";
import type { ReactNode } from "react";
import { rem } from "@/lib/rem";

// 한 줄 알림판 (2026-10-13 대표 확정 숫자) — 지금은 /deals "찾습니다" 1개만. 전체가 링크 하나.
// 높이 44px 고정(로딩·문구가 바뀌어도 아래 목록이 밀리지 않음) · 본문은 한 줄, 넘치면 말줄임.
// items가 여러 개여도 지금은 첫 개만 고정 표시 — 로테이션(오른쪽→왼쪽 5초)은 공개 후 모집·긴급 공지를 붙일 때 추가.
export type NoticeItem = {
  tag: string;
  tagBg: string;
  tagColor: string;
  body: ReactNode;
  href: string;
};

export default function NoticeBoard({ items }: { items: NoticeItem[] }) {
  const item = items[0];
  if (!item) return null;
  return (
    <Link
      href={item.href}
      className="flex items-center rounded-xl"
      style={{ height: 44, background: "#FFFFFF", border: "1px solid #cbd5e1", borderRadius: 12, padding: "0 12px", gap: 8 }}
      data-notice-board
    >
      <span
        className="flex-shrink-0 whitespace-nowrap"
        style={{ fontSize: 12, fontWeight: 800, background: item.tagBg, color: item.tagColor, padding: "2px 7px", borderRadius: 6 }}
      >
        {item.tag}
      </span>
      <span
        className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ fontSize: rem(15), fontWeight: 600, color: "#1A1F26" }}
        data-notice-body
      >
        {item.body}
      </span>
      <span aria-hidden className="flex-shrink-0" style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1 }}>
        ›
      </span>
    </Link>
  );
}
