"use client";

import Link from "next/link";
import { rem } from "@/lib/rem";
import type { LoginMethod } from "@/lib/returningMember";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 재방문 회원 화면 (2026-09-29) — 로그아웃 상태로 돌아온 기존 회원에게 가입 온보딩 대신.
// 판별은 page.tsx(src/lib/returningMember.ts).
// 2026-10-05: /login과 같은 구성 — 위는 남색 머리 영역(/login 머리와 같은 도트 그라디언트·여백, 값 복사 — /login은 수정 안 함),
// 아래는 흰 배경(캐릭터 가운데 · 주황 [로그인] · 하단 링크). 흰 영역이 화면 맨 아래까지 참.
const LOGIN_LABEL: Record<LoginMethod, string> = {
  password: "비밀번호로 로그인",
  otp: "인증번호로 로그인",
};

// 하단 링크 공통 — 글자 15px 이상, 터치 높이 44px 이상(흰 배경용 색: #0B2540 · #5B6470 모두 대비 4.5:1 이상)
// 첫 방문 화면(OnboardingIntro)도 같은 값을 씀
export const LINK_BASE = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "0 10px",
  fontSize: rem(15),
  textDecoration: "underline",
  textUnderlineOffset: 4,
  background: "none",
  border: "none",
} as const;

export default function ReturningMemberIntro({
  method,
  pushActive,
  onBrowse,
}: {
  method: LoginMethod | null;
  pushActive: boolean;
  onBrowse: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      style={{ overflowY: "auto" }}
      role="dialog"
      aria-modal="true"
      aria-label="다시 오셨네요"
    >
      {/* 머리 영역 — 내용만큼의 높이(화면 비율 아님). 상태바 자리(--sat)까지 남색 */}
      <div
        className="flex-shrink-0 text-white"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
          paddingTop: "var(--sat)",
        }}
      >
        <div className="mx-auto w-full max-w-md" style={{ padding: "20px 22px 22px" }}>
          <div className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto block" />
          </div>
          <h1 className="font-display text-2xl mt-3 leading-[1.4]" style={{ wordBreak: "keep-all" }}>
            <span style={{ color: "var(--color-brandOrange)" }}>다시 오셨네요!</span>
            <br />
            로그인하면 내 조건 매물을 볼 수 있어요
          </h1>
          {pushActive && (
            <p
              className="mt-3 inline-flex items-center gap-1.5 rounded-full font-bold"
              style={{ fontSize: rem(15), background: "rgba(255,255,255,.14)", padding: "7px 13px", color: "rgba(255,255,255,.95)" }}
            >
              <span style={{ color: "#5EEAD4" }}>✔</span> 새 매물 알림은 계속 받고 있어요
            </p>
          )}
        </div>
      </div>

      {/* 흰 영역 — 화면 맨 아래까지. 아래부터: 하단 24px → 링크(44) → 22px → [로그인](52) → 12px → 캐릭터.
          캐릭터 = min(240px, 남는 높이 − 위 여백 16px), 남는 공간은 캐릭터 위에만 생김(2026-10-05 되돌림) */}
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col" style={{ padding: "0 22px calc(24px + var(--sab))", minHeight: 0 }}>
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <div className="absolute flex items-end justify-center" style={{ top: 16, left: 0, right: 0, bottom: 0 }}>
            <img
              src="/images/manager-cut.png"
              alt="점핑매니저"
              style={{ height: 240, maxHeight: "100%", width: "auto", maxWidth: "100%", objectFit: "contain" }}
            />
          </div>
        </div>

        <div className="flex flex-col flex-shrink-0" style={{ marginTop: 12 }}>
          <Link href="/login" className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
            {method ? LOGIN_LABEL[method] : "로그인"}
          </Link>
          <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 22 }}>
            <Link href="/signup" style={{ ...LINK_BASE, color: "#0B2540", fontWeight: 700 }}>
              처음이신가요? 가입하기
            </Link>
            <span aria-hidden style={{ color: "#9AA3AD", fontSize: rem(15) }}>·</span>
            <button type="button" onClick={onBrowse} style={{ ...LINK_BASE, color: "#5B6470", fontWeight: 600 }}>
              둘러보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
