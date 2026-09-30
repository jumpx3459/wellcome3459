"use client";

import { useState } from "react";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { rem } from "@/lib/rem";
import { BUSINESS_INFO, SERVICE_ROLE_NOTICE, mailHref, telHref } from "@/lib/businessInfo";

// 운영 사업자 정보 푸터 (2026-09-30, 커밋 D) — 기본 접힘, 링크 줄(이용약관 · 개인정보처리방침 · English)은 항상 보임.
// 페이지 본문 흐름 맨 아래에 두므로 하단 탭·FloatingCTA 여백은 각 페이지의 기존 하단 여백이 맡는다.
export default function BusinessFooter({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const b = BUSINESS_INFO;
  const rows: [string, React.ReactNode][] = [
    ["상호", b.companyName],
    ["대표", b.ceo],
    ["사업자등록번호", b.bizRegNo],
    ...(b.mailOrderNo ? ([["통신판매업 신고번호", b.mailOrderNo]] as [string, React.ReactNode][]) : []),
    ["주소", b.address],
    [
      "고객센터",
      <span key="cs" className="inline-flex flex-wrap gap-x-1.5">
        <a href={telHref(b.tel)} className="underline underline-offset-2">{b.tel}</a>
        <span aria-hidden>|</span>
        <a href={mailHref(b.email)} className="underline underline-offset-2">{b.email}</a>
        <span aria-hidden>|</span>
        <a href={b.kakaoChannel.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          카카오톡 채널 {b.kakaoChannel.searchId} (채팅 상담)
        </a>
      </span>,
    ],
    ["개인정보 보호책임자", b.privacyOfficer],
    ["호스팅 제공자", b.hosting],
  ];

  return (
    <footer className={`w-full ${className}`} style={{ fontSize: rem(13), color: "#6B7480", lineHeight: 1.6 }} data-business-footer>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="font-bold"
        style={{ fontSize: rem(13), color: "#4B5563", padding: "4px 0" }}
      >
        점프엑스 주식회사 사업자 정보 {open ? "▴" : "▾"}
      </button>

      {open && (
        <div className="mt-1.5">
          <dl className="grid gap-y-0.5" style={{ gridTemplateColumns: "auto 1fr", columnGap: 10 }}>
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="whitespace-nowrap">{k}</dt>
                <dd className="m-0 min-w-0 break-words" style={{ color: "#4B5563" }}>{v}</dd>
              </div>
            ))}
          </dl>
          {/* 1280px 이상(xl)에서만 채널 QR — 휴대폰에선 링크를 바로 누르면 되므로 숨김. 기존 추천 QR과 같은 생성 방식 */}
          <div className="hidden xl:flex items-center gap-2.5 mt-2">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(b.kakaoChannel.url)}`}
              alt={`카카오톡 채널 ${b.kakaoChannel.searchId} 채팅 상담 QR`}
              width={80}
              height={80}
              loading="lazy"
              className="rounded-md bg-white"
              style={{ border: "1px solid #E4E7EB" }}
            />
            <span>휴대폰 카메라로 찍으면 카카오톡 채널 채팅 상담으로 연결돼요</span>
          </div>
          <p className="mt-2">{SERVICE_ROLE_NOTICE}</p>
        </div>
      )}

      <nav className="mt-1.5 flex flex-wrap items-center gap-x-2" aria-label="약관·정책">
        <Link href="/terms" className="underline underline-offset-2">이용약관</Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="font-bold underline underline-offset-2" style={{ color: "#1A1F26" }}>개인정보처리방침</Link>
        <span aria-hidden>·</span>
        <Link href="/en" hrefLang="en" lang="en" className="underline underline-offset-2">English</Link>
      </nav>
    </footer>
  );
}
