"use client";

import Link from "next/link";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle, UI_CARD_TITLE, UI_DESC } from "@/lib/uiText";

// 판매 신청 비회원 안내 (2026-09-30) — 판매 신청·사진 업로드가 회원 전용이 되면서 /sell 폼 대신 보여줌.
// 로그인·가입 후 /sell로 돌아옴(returnTo). 작성 중이던 내용은 /sell이 sessionStorage로 복원.
// 문의 경로는 지금 있는 카카오톡 채널(덤핑점핑-점프엑스)만 — 별도 1:1 상담 창구·전화번호는 아직 없음.
const KAKAO_CHANNEL_HOME_URL = "https://pf.kakao.com/_xcFZrX";

export default function SellGuestNotice() {
  return (
    <div className="flex-1 px-5 py-6 flex flex-col gap-4">
      <div className="rounded-2xl text-center" style={{ background: "#fff", border: "1.5px solid #E4E7EB", padding: "24px 18px" }}>
        <img src="/images/manager.png" alt="점핑매니저" className="mx-auto rounded-xl bg-white" style={{ width: 88, height: 88, objectFit: "contain" }} />
        <p className="mt-3" style={{ ...UI_CARD_TITLE, fontSize: rem(19) }}>판매 신청은 회원만 할 수 있어요</p>
        <p className="mt-1.5 leading-relaxed" style={{ ...UI_DESC, fontSize: rem(16) }}>휴대폰 인증 1분이면 가입할 수 있어요</p>
        <Link href={`/login?returnTo=${encodeURIComponent("/sell")}`} className={`${BTN_CLASS} w-full mt-5`} style={btnStyle("primary")}>
          로그인·가입
        </Link>
      </div>

      <div className="rounded-2xl" style={{ background: "#F5F6F8", padding: "14px 16px" }}>
        <p className="font-medium" style={{ fontSize: rem(15), color: "#1A1F26" }}>가입이 어려우면 점핑매니저에게 문의하세요</p>
        <a
          href={KAKAO_CHANNEL_HOME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-white"
          style={{ border: "1px solid #E4E7EB", padding: "11px 14px" }}
        >
          <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, background: "#FEE500", fontSize: rem(16) }}>💬</span>
          <span className="flex-1 min-w-0 font-bold" style={{ fontSize: rem(15), color: "#1A1F26" }}>카카오톡 채널로 문의하기</span>
          <span className="flex-shrink-0" style={{ color: "#6B7480" }}>›</span>
        </a>
      </div>
    </div>
  );
}
