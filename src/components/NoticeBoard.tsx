import Link from "next/link";
import type { ReactNode } from "react";
import { rem } from "@/lib/rem";

// 한 줄 알림판 (2026-10-13 대표 확정 숫자) — 표시용. 전체가 링크 하나.
// 높이 44px 고정(로딩·문구가 바뀌어도 아래 목록이 밀리지 않음) · 본문은 한 줄, 넘치면 말줄임.
// 2026-11-02: 회전(6초)·집계는 PartnerBoard가 맡고, 여기는 받은 items[0] 한 개만 그림(external이면 새 창 링크, onClick은 클릭 기록용).
export type NoticeItem = {
  tag: string;
  tagBg: string;
  tagColor: string;
  body: ReactNode;
  href: string;
  external?: boolean;
  onClick?: () => void;
};

export default function NoticeBoard({ items }: { items: NoticeItem[] }) {
  const item = items[0];
  if (!item) return null;
  const className = "flex items-center rounded-xl";
  const style = { height: 44, background: "#FFFFFF", border: "1px solid #cbd5e1", borderRadius: 12, padding: "0 12px", gap: 8 } as const;
  const inner = (
    <>
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
    </>
  );
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={item.onClick} className={className} style={style} data-notice-board>
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.href} onClick={item.onClick} className={className} style={style} data-notice-board>
      {inner}
    </Link>
  );
}
