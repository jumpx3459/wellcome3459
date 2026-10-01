"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { UI_CARD_TITLE, UI_DESC } from "@/lib/uiText";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { useBackToClose } from "@/lib/useBackToClose";

// 2026-09-29: "견적함 · 준비중" 자리를 "곧 오픈" 예고 카드로. 실제 견적함은 아직 없음
// (features.ts QUOTES_ENABLED = false). 오픈 알림 신청은 feature_waitlist에 기록
// (member_id + feature unique — 중복 신청 불가, role = 받은/보낸 견적 중 어떻게 쓸지).
// 날짜·일정, 확정 안 된 기능(자동 인식 등) 문구는 넣지 않는다.
const FEATURE = "quotes";
type Role = "receiver" | "sender";

const POINTS = [
  "카톡·문자로 받은 견적서를 캡처 그대로 저장",
  "상품명으로 검색하고 지난 가격과 비교",
  "보낸 견적서도 거래처별로 정리",
];

export default function QuotesTeaserCard({ memberId }: { memberId: string | null }) {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  // 2026-10-01 PR-C: 열려 있으면 안드로이드 뒤로가기 = 이것만 닫기 (src/lib/useBackToClose.ts)
  useBackToClose(open, () => setOpen(false));
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId || !supabase) return;
    supabase
      .from("feature_waitlist")
      .select("id")
      .eq("member_id", memberId)
      .eq("feature", FEATURE)
      .maybeSingle()
      .then(({ data }) => setJoined(Boolean(data)));
  }, [memberId]);

  const join = async (role: Role) => {
    if (!memberId || !supabase || joined || busy) return;
    setBusy(role);
    setError(null);
    const { error: insertError } = await supabase
      .from("feature_waitlist")
      .insert({ member_id: memberId, feature: FEATURE, role });
    // 23505 = 이미 신청함(unique) — 신청된 것으로 처리
    if (!insertError || insertError.code === "23505") setJoined(true);
    else setError("신청에 실패했어요. 잠시 후 다시 시도해주세요.");
    setBusy(null);
  };

  const roleBtn = (role: Role, label: string) => (
    <button
      type="button"
      onClick={() => join(role)}
      disabled={busy !== null}
      className={`flex-1 ${BTN_CLASS}`}
      style={btnStyle("primary")}
    >
      {busy === role ? "신청 중…" : label}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-white border border-gray200 rounded-2xl flex items-center gap-3 text-left"
        style={{ padding: "14px 16px" }}
      >
        <span className="leading-none flex-shrink-0" style={{ fontSize: rem(26) }} aria-hidden>
          📋
        </span>
        <span className="flex-1 min-w-0">
          <span className="block" style={UI_CARD_TITLE}>내 견적함</span>
          <span className="block mt-0.5" style={UI_DESC}>받은·보낸 견적서, 가격 변동까지 한눈에</span>
        </span>
        <span
          className="flex-shrink-0 rounded-full font-bold"
          style={{ fontSize: rem(14), padding: "4px 10px", background: "#FDEEE8", color: "#C2410C" }}
        >
          {joined ? "✓ 신청함" : "곧 오픈"}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,.5)" }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="내 견적함 오픈 알림"
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl"
            style={{ padding: "26px 20px calc(20px + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-black text-center" style={{ fontSize: rem(20), color: "#0B2540" }}>
              📋 내 견적함이 곧 열려요
            </p>
            <ul className="mt-4 flex flex-col gap-2" style={{ fontSize: rem(15), color: "#1F2937" }}>
              {POINTS.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden style={{ color: "#C2410C" }}>·</span>
                  <span>{t}</span>
                </li>
              ))}
              <li className="flex gap-2 font-bold">
                <span aria-hidden>🔒</span>
                <span>나만 볼 수 있어요</span>
              </li>
            </ul>

            {!memberId ? (
              <>
                <p className="mt-5 text-center" style={{ fontSize: rem(15), color: "#1A1F26" }}>가입하면 오픈 알림을 받을 수 있어요</p>
                <Link
                  href="/signup"
                  className={`w-full mt-3 ${BTN_CLASS}`}
                  style={btnStyle("primary")}
                >
                  무료로 가입하기
                </Link>
              </>
            ) : joined ? (
              <div
                className="mt-5 text-center font-black rounded-2xl"
                style={{ minHeight: 56, lineHeight: "56px", fontSize: rem(16), background: "#E8F8EC", color: "#1D8A44" }}
              >
                ✓ 오픈하면 알려드릴게요
              </div>
            ) : (
              <>
                <p className="mt-5 text-center font-bold" style={{ fontSize: rem(16), color: "#1F2937" }}>어떻게 쓰실 건가요?</p>
                <div className="flex gap-2 mt-2.5">
                  {roleBtn("receiver", "받은 견적 보관")}
                  {roleBtn("sender", "보낸 견적 관리")}
                </div>
              </>
            )}
            {error && <p className="mt-2 text-center" style={{ fontSize: rem(14), color: "#C2410C" }}>{error}</p>}
            <button type="button" onClick={() => setOpen(false)} className="mt-3 w-full" style={{ minHeight: 44, fontSize: rem(15), color: "#6B7480" }}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
