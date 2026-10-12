"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import BusinessFooter from "@/components/BusinessFooter";
import LoginRequired from "@/components/LoginRequired";
import MyHeadTop from "@/components/MyHeadTop";
import ReferralPartnerSection from "@/components/ReferralPartnerSection";
import { useReferralShare } from "@/lib/useReferralShare";
import { MY_DESC, MY_HEAD_BG, MY_HEAD_NAME, MY_HEAD_SUB } from "@/lib/myText";

// 하단 "공유" 탭 (2026-10-12 feat/my-menu-share) — 예전 MY 안 점핑파트너 구역(/mypage#referral)을 따로 뗀 화면.
// 비회원은 MY와 같은 로그인 안내.
export default function SharePage() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [auth, setAuth] = useState<"loading" | "member" | "guest">(isSupabaseConfigured ? "loading" : "guest");
  const s = useReferralShare(memberId);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setMemberId(data.user.id);
        setAuth("member");
      } else setAuth("guest");
    });
  }, []);

  if (auth === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen text-gray500" style={MY_DESC}>
        불러오는 중...
      </main>
    );
  }
  if (auth === "guest") return <LoginRequired returnTo="/share" />;

  return (
    <main className="flex flex-col min-h-screen bg-white">
      <div className="px-5 pt-5 pb-5 text-white" style={MY_HEAD_BG}>
        <MyHeadTop caption="공유" />
        <h1 style={MY_HEAD_NAME}>🤝 점핑파트너</h1>
        <p className="mt-1" data-share-count style={MY_HEAD_SUB}>
          추천 회원 {s.referrals.length}명
        </p>
      </div>
      <div className="flex-1 px-5 py-5 flex flex-col gap-6">
        <ReferralPartnerSection s={s} />
        <BusinessFooter className="-mx-5 -mb-5" />
      </div>
    </main>
  );
}
