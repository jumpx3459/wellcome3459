"use client";

import Link from "next/link";
import { rem } from "@/lib/rem";
import type { LoginMethod } from "@/lib/returningMember";

// 재방문 회원 화면 (2026-09-29) — 로그아웃 상태로 돌아온 기존 회원에게 가입 온보딩 대신.
// 판별은 page.tsx(src/lib/returningMember.ts). 레이아웃은 OnboardingIntro와 같이 배경은 전체 폭,
// 내용은 회원 화면 폭(max-w-md) 가운데.
const LOGIN_LABEL: Record<LoginMethod, string> = {
  password: "비밀번호로 로그인",
  otp: "인증번호로 로그인",
};

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
      className="fixed inset-0 z-50 text-white"
      style={{ background: "linear-gradient(155deg,#04101C 0%,#0B2540 58%,#14395C 100%)", overflowY: "auto" }}
      role="dialog"
      aria-modal="true"
      aria-label="다시 오셨네요"
    >
      <div className="mx-auto w-full max-w-md min-h-full flex flex-col justify-between" style={{ padding: "44px 26px 30px" }}>
        <div>
          <div className="bg-white rounded-2xl inline-block" style={{ padding: "10px 14px" }}>
            <img src="/images/logo.png" alt="덤핑점핑" style={{ height: 34, width: "auto", display: "block" }} />
          </div>
          <h1 className="font-display mt-8 leading-[1.45]" style={{ fontSize: rem(24), letterSpacing: "-0.02em", wordBreak: "keep-all" }}>
            <span style={{ color: "var(--color-brandOrange)" }}>다시 오셨네요!</span>
            <br />
            로그인하면 내 조건 매물을 볼 수 있어요
          </h1>
          {pushActive && (
            <p
              className="mt-4 inline-flex items-center gap-1.5 rounded-full font-bold"
              style={{ fontSize: rem(15), background: "rgba(255,255,255,.12)", padding: "7px 13px", color: "rgba(255,255,255,.92)" }}
            >
              <span style={{ color: "#5EEAD4" }}>✔</span> 새 매물 알림은 계속 받고 있어요
            </p>
          )}
        </div>

        <div className="flex flex-1 items-end justify-center" style={{ minHeight: 0, paddingBottom: 6, overflow: "hidden" }}>
          <img
            src="/images/manager-cut.png"
            alt="점핑매니저"
            style={{ height: "clamp(120px, 26vh, 220px)", width: "auto", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 14px 26px rgba(0,0,0,.5))" }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/login"
            className="block w-full text-center font-bold rounded-2xl"
            style={{ padding: "19px 0", background: "linear-gradient(135deg,#E25100,#FF6F0F)", fontSize: rem(18), boxShadow: "0 10px 24px rgba(226,81,0,.4)" }}
          >
            {method ? LOGIN_LABEL[method] : "로그인"}
          </Link>
          <div className="flex items-center justify-center gap-1" style={{ padding: "2px 10px 0" }}>
            <Link
              href="/signup"
              style={{ color: "rgba(255,255,255,.8)", fontSize: rem(13), fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 4, padding: 8 }}
            >
              처음이신가요? 알림 설정하기
            </Link>
            <span style={{ color: "rgba(255,255,255,.35)", fontSize: rem(13) }}>·</span>
            <button
              type="button"
              onClick={onBrowse}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.65)", fontSize: rem(13), fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 4, padding: 8 }}
            >
              둘러보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
