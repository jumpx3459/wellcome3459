"use client";

import Link from "next/link";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle, UI_CARD_TITLE, UI_DESC } from "@/lib/uiText";
import ContactLinks from "@/components/ContactLinks";

// 판매 신청 비회원 안내 (2026-09-30) — 판매 신청·사진 업로드가 회원 전용이 되면서 /sell 폼 대신 보여줌.
// 로그인·가입 후 /sell로 돌아옴(returnTo). 작성 중이던 내용은 /sell이 sessionStorage로 복원.
// 문의 경로는 고객센터 공용 ContactLinks(카카오톡 채널 채팅·전화·이메일, 2026-09-30 커밋 D).

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
        <ContactLinks className="mt-2.5" />
      </div>
    </div>
  );
}
