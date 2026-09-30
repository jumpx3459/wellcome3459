"use client";

import { useState } from "react";
import Link from "next/link";
import { rem } from "@/lib/rem";
import { BUSINESS_INFO, SERVICE_ROLE_NOTICE, mailHref, telHref } from "@/lib/businessInfo";

// 운영 사업자 정보 푸터 (2026-09-30 커밋 D → 2026-10-01 커밋 J 당근 스타일).
//   1줄 "점프엑스 주식회사 사업자 정보 >"(누르면 펼침, 펼치면 화살표가 아래로) · 펼침: 대표·주소·사업자등록번호·
//   통신판매업 신고번호(null이면 숨김)·고객센터·이메일 · 항상 보임: 통신판매중개자 고지 · 링크 줄. 값은 businessInfo.ts.
// 페이지 본문 흐름 맨 아래에 두므로 하단 탭·FloatingCTA 여백은 각 페이지의 기존 하단 여백이 맡는다.
export default function BusinessFooter({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const b = BUSINESS_INFO;
  const rows: [string, React.ReactNode][] = [
    ["대표", b.ceo],
    ["주소", b.address],
    ["사업자등록번호", b.bizRegNo],
    ...(b.mailOrderNo ? ([["통신판매업 신고번호", b.mailOrderNo]] as [string, React.ReactNode][]) : []),
    ["고객센터", <a key="tel" href={telHref(b.tel)} className="underline underline-offset-2">{b.tel}</a>],
    ["이메일", <a key="mail" href={mailHref(b.email)} className="underline underline-offset-2">{b.email}</a>],
  ];

  return (
    <footer className={`w-full ${className}`} style={{ fontSize: rem(13), color: "#6B7480", lineHeight: 1.6 }} data-business-footer>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 font-bold"
        style={{ fontSize: rem(13), color: "#6B7480", padding: "4px 0" }}
      >
        점프엑스 주식회사 사업자 정보
        <span
          aria-hidden
          className="inline-block"
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", fontSize: rem(15), lineHeight: 1 }}
        >
          ›
        </span>
      </button>

      {open && (
        <dl className="mt-1 flex flex-col gap-0.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap gap-x-1.5">
              <dt className="whitespace-nowrap">{k}</dt>
              <dd className="m-0 min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-2">{SERVICE_ROLE_NOTICE}</p>

      <nav className="mt-1.5 flex flex-wrap items-center gap-x-2" aria-label="약관·정책">
        <Link href="/terms" className="underline underline-offset-2">이용약관</Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="font-bold underline underline-offset-2" style={{ color: "#4B5563" }}>개인정보처리방침</Link>
        <span aria-hidden>·</span>
        <Link href="/en" hrefLang="en" lang="en" className="underline underline-offset-2">English</Link>
      </nav>
    </footer>
  );
}
