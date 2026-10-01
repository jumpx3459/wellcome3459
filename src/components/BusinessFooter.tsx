"use client";

import { useState } from "react";
import Link from "next/link";
import { rem } from "@/lib/rem";
import { BUSINESS_INFO, SERVICE_ROLE_NOTICE, mailHref, telHref } from "@/lib/businessInfo";

// 운영 사업자 정보 푸터 (2026-09-30 커밋 D → 2026-10-01 커밋 J 당근 스타일).
//   1줄 "점프엑스 주식회사 사업자 정보 >"(누르면 펼침, 펼치면 화살표가 아래로) · 펼침: 대표·주소·사업자등록번호·
//   통신판매업 신고번호(null이면 숨김)·고객센터(+카카오톡 채널)·이메일·개인정보 보호책임자·호스팅 서비스 제공자 ·
//   항상 보임: 통신판매중개자 고지 · 링크 줄. 값은 businessInfo.ts에서만. 상호는 첫 줄로 충분, QR 없음.
// 2026-10-01: 옅은 회색 배경을 콘텐츠 폭 전체에 + 상단 구분선 + 위아래 24px. 부모의 좌우 여백은 부르는 쪽이 음수 여백(className)으로 넘김.
//   bottomSpace = 하단 고정 CTA(비회원 홈 "덤핑매물 무료 알림받기") 높이만큼 아래 여백. 하단 탭·안전 영역은 AppShell이 이미 비워 둠.
// 글자색: 회색 배경(#F2F4F6) 위 13px라 #5B6470(대비 약 5.6:1) — 예전 #6B7480(약 4.4:1)에서 한 단계 진하게.
const FOOTER_BG = "#F2F4F6";
const FOOTER_TEXT = "#5B6470";
export default function BusinessFooter({ className = "", bottomSpace }: { className?: string; bottomSpace?: number | string }) {
  const [open, setOpen] = useState(false);
  const b = BUSINESS_INFO;
  const rows: [string, React.ReactNode][] = [
    ["대표", b.ceo],
    ["주소", b.address],
    ["사업자등록번호", b.bizRegNo],
    ...(b.mailOrderNo ? ([["통신판매업 신고번호", b.mailOrderNo]] as [string, React.ReactNode][]) : []),
    [
      "고객센터",
      <span key="cs" className="inline-flex flex-wrap gap-x-1.5">
        <a href={telHref(b.tel)} className="underline underline-offset-2">{b.tel}</a>
        <span aria-hidden>|</span>
        <a href={b.kakaoChannel.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          카카오톡 채널 {b.kakaoChannel.searchId}
        </a>
      </span>,
    ],
    ["이메일", <a key="mail" href={mailHref(b.email)} className="underline underline-offset-2">{b.email}</a>],
    // 개인정보 보호책임자 연락처는 고객센터·이메일과 같아 이름만
    ["개인정보 보호책임자", b.privacyOfficer],
    // 사이버몰 운영자 표시 항목
    ["호스팅 서비스 제공자", b.hosting],
  ];

  return (
    <footer
      className={className}
      style={{
        fontSize: rem(13),
        color: FOOTER_TEXT,
        lineHeight: 1.6,
        background: FOOTER_BG,
        borderTop: "1px solid #E4E7EB",
        padding: `24px 20px calc(24px + ${typeof bottomSpace === "number" ? `${bottomSpace}px` : bottomSpace ?? "0px"})`,
      }}
      data-business-footer
    >
      {/* 2026-10-01: 첫 줄 오른쪽 끝에 점프엑스 심볼(높이 28px, 링크 없음) — 펼치기 버튼은 글자 폭만큼만이라 터치 영역이 로고와 안 겹침.
          좁은 화면에서 상호 줄이 길어지면 버튼 글자가 줄바꿈되고 로고는 오른쪽에 그대로(겹치지 않음) */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 font-bold text-left min-w-0"
          style={{ fontSize: rem(13), color: "#4B5563", padding: "4px 0" }}
        >
          <span className="min-w-0">점프엑스 주식회사 사업자 정보</span>
          <span
            aria-hidden
            className="inline-block flex-shrink-0"
            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", fontSize: rem(15), lineHeight: 1 }}
          >
            ›
          </span>
        </button>
        {/* 2026-10-01: 심볼 + "JumpX Inc." 한 묶음(높이 28px, 링크 없음). 글자는 로고 파랑 계열, 이미지 속 영문·태그라인 없음 */}
        <span className="flex-shrink-0 inline-flex items-center gap-1.5 select-none" style={{ height: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 1x/2x 원본 그대로(투명 PNG, 대표 제공), 최적화 불필요한 작은 심볼 */}
          <img
            src="/brand/jumpx-symbol-56.png"
            srcSet="/brand/jumpx-symbol-56.png 1x, /brand/jumpx-symbol-112.png 2x"
            alt="점프엑스 주식회사"
            width={38}
            height={28}
            style={{ height: 28, width: "auto" }}
            draggable={false}
          />
          <span aria-hidden className="font-bold whitespace-nowrap" style={{ fontSize: rem(14), color: "#1C5FAE", letterSpacing: "-0.01em" }}>
            JumpX Inc.
          </span>
        </span>
      </div>

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
