"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { MY_CARD_TITLE, MY_DESC, myBtnStyle } from "@/lib/myText"; // MY 전용 글자 크기 (2026-10-12)
import { useBackToClose } from "@/lib/useBackToClose";
import { useAlertsOnState } from "@/lib/useAlertsOn";

// 2026-09-29: "견적함 · 준비중" 자리를 "곧 오픈" 예고 카드로. 실제 견적함은 아직 없음
// (features.ts QUOTES_ENABLED). 오픈 알림 신청은 feature_waitlist에 기록
// (member_id + feature unique — 중복 신청 불가, role = 견적을 받는 쪽/보내는 쪽 중 어느 쪽인지).
// 2026-10-14: 문구 교체(1단계 켜기) + 회원 홈에도 놓음(variant "home") — 홈·MY 모두 같은 신청 상태.
// 날짜·일정, 확정 안 된 기능(자동 인식·AI 등) 문구는 넣지 않는다.
const FEATURE = "quotes";
type Role = "receiver" | "sender";

// 같은 화면 안에서 한 곳이 신청하면 다른 카드도 "✓ 신청함" (다른 화면은 열릴 때 다시 읽음)
const JOINED_EVENT = "dj:quotes-waitlist-joined";

const SECTION_TITLE = { fontSize: rem(17.5), fontWeight: 800, color: "#0B2540" } as const;
const BODY = { fontSize: rem(16), color: "#1F2937", lineHeight: 1.55 } as const;

const WHO = [
  "견적을 받는 쪽(유통·도매·매장): 카톡·문자로 받은 견적을 모아 두고, 같은 상품의 지난 단가와 비교",
  "견적을 보내는 쪽(제조·수입사): 거래처별로 보낸 견적을 기록하고, 지난번 제시 가격 확인",
];
const FEATURES = [
  "견적 기록 — 상품명·거래처·단가·수량·날짜, 사진이나 파일 1장",
  "상품명으로 찾기",
  "같은 상품 단가 변화 한눈에 보기",
];
const SAFE = [
  "나만 보기: 입력한 견적은 본인만 볼 수 있어요. 다른 회원·판매자에게 공개되지 않아요.",
  "통계 등 다른 용도로 쓸 때는 따로 동의를 받아요.",
  "직접 입력하는 방식이에요. 오픈할 때 세부 기능은 달라질 수 있어요.",
];

// 신청 완료 아래 줄 — 푸시가 확실히 꺼져 있을 때만(null = 아직 모름 → 안 보임, 깜빡임 없게).
// 푸시 조회(useAlertsOnState)는 이 줄이 그려질 때만 일어나도록 따로 뺌
function AlertsHint() {
  const on = useAlertsOnState();
  if (on !== false) return null;
  return (
    <p className="mt-2 text-center" style={{ fontSize: rem(16), color: "#4B5563" }} data-quotes-alerts-hint>
      앱 알림을 켜 두면 바로 알려드려요
    </p>
  );
}

export default function QuotesTeaserCard({ memberId, variant = "my" }: { memberId: string | null; variant?: "my" | "home" }) {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  // 2026-10-01 PR-C: 열려 있으면 안드로이드 뒤로가기 = 이것만 닫기 (src/lib/useBackToClose.ts)
  useBackToClose(open, () => setOpen(false));
  const [role, setRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHome = variant === "home";
  const sheetBtn = isHome ? btnStyle : myBtnStyle;

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

  useEffect(() => {
    const onJoined = () => setJoined(true);
    window.addEventListener(JOINED_EVENT, onJoined);
    return () => window.removeEventListener(JOINED_EVENT, onJoined);
  }, []);

  const join = async () => {
    if (!memberId || !supabase || joined || busy || !role) return;
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase
      .from("feature_waitlist")
      .insert({ member_id: memberId, feature: FEATURE, role });
    // 23505 = 이미 신청함(unique) — 신청된 것으로 처리
    if (!insertError || insertError.code === "23505") {
      setJoined(true);
      window.dispatchEvent(new CustomEvent(JOINED_EVENT));
    } else setError("신청에 실패했어요. 잠시 후 다시 시도해주세요.");
    setBusy(false);
  };

  const roleBtn = (value: Role, label: string) => {
    const on = role === value;
    return (
      <button
        type="button"
        onClick={() => setRole(value)}
        aria-pressed={on}
        disabled={busy}
        data-quotes-role={value}
        className={`flex-1 ${BTN_CLASS}`}
        style={{
          ...sheetBtn("secondary"),
          ...(on ? { border: "2px solid #E25100", background: "#FFF7ED", color: "#C2410C" } : {}),
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-quotes-card={variant}
        className={`w-full bg-white flex items-center gap-3 text-left ${isHome ? "" : "border border-gray200 rounded-2xl"}`}
        style={isHome ? { padding: "14px 16px", borderRadius: 14, border: "1px solid #e2e8f0" } : { padding: "14px 16px" }}
      >
        <span className="leading-none flex-shrink-0" style={{ fontSize: rem(26) }} aria-hidden>
          📋
        </span>
        <span className="flex-1 min-w-0">
          {/* 2026-10-14: 알약을 제목 줄로(오른쪽 칸 없음 → 본문이 아이콘 옆 남은 폭 전부). 넘치면 줄바꿈(flex-wrap) — 제목은 말줄임 없이 한 덩어리 */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1" data-quotes-title-row>
            <span className="whitespace-nowrap" style={isHome ? { fontSize: rem(17), fontWeight: 800, color: "#0f1f3d" } : MY_CARD_TITLE}>내 견적함</span>
            <span
              className="flex-shrink-0 rounded-full font-bold whitespace-nowrap"
              style={{ fontSize: rem(15), padding: "4px 10px", background: joined ? "#E8F8EC" : "#FDEEE8", color: joined ? "#1D8A44" : "#C2410C" }}
              data-quotes-pill
            >
              {joined ? "✓ 신청함" : "준비 중"}
            </span>
          </span>
          <span className="block mt-0.5" style={isHome ? { fontSize: rem(15), color: "#64748b", lineHeight: 1.45 } : MY_DESC} data-quotes-desc>
            카톡·문자로 주고받은 견적, 한곳에 모아 단가를 비교하세요
          </span>
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
            className="w-full max-w-md bg-white rounded-t-3xl overflow-y-auto"
            style={{ padding: "26px 20px calc(20px + env(safe-area-inset-bottom))", maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-black text-center" style={{ fontSize: rem(22.5), color: "#0B2540" }}>
              내 견적함 (준비 중)
            </p>

            <p className="mt-5" style={SECTION_TITLE}>이런 분께 좋아요</p>
            <ul className="mt-1.5 flex flex-col gap-1.5" style={BODY}>
              {WHO.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden style={{ color: "#C2410C" }}>·</span>
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4" style={SECTION_TITLE}>할 수 있는 것 (오픈 예정)</p>
            <ol className="mt-1.5 flex flex-col gap-1.5" style={BODY}>
              {FEATURES.map((t, i) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden className="font-bold flex-shrink-0 whitespace-nowrap" style={{ color: "#C2410C", width: "1.5em" }} data-quotes-num>{i + 1}.</span>
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ol>

            <p className="mt-4" style={SECTION_TITLE}>안심하세요</p>
            <ul className="mt-1.5 flex flex-col gap-1.5" style={BODY}>
              {SAFE.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden style={{ color: "#C2410C" }}>·</span>
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>

            {!memberId ? (
              <>
                <p className="mt-5 text-center" style={{ fontSize: rem(17.5), color: "#1A1F26" }}>가입하면 오픈 알림을 받을 수 있어요</p>
                <Link
                  href="/signup"
                  className={`w-full mt-3 ${BTN_CLASS}`}
                  style={sheetBtn("primary")}
                >
                  무료로 가입하기
                </Link>
              </>
            ) : joined ? (
              <>
                <div
                  className="mt-5 text-center font-black rounded-2xl flex items-center justify-center"
                  style={{ minHeight: 56, padding: "12px 14px", lineHeight: 1.4, fontSize: rem(18), background: "#E8F8EC", color: "#1D8A44" }}
                  data-quotes-done
                >
                  신청됐어요. 오픈하면 알려드릴게요.
                </div>
                <AlertsHint />
              </>
            ) : (
              <>
                <p className="mt-5 font-bold" style={{ fontSize: rem(17.5), color: "#1F2937" }}>나는 주로 견적을</p>
                <div className="flex gap-2 mt-2">
                  {roleBtn("receiver", "받아요")}
                  {roleBtn("sender", "보내요")}
                </div>
                <button
                  type="button"
                  onClick={join}
                  disabled={busy || !role}
                  data-quotes-submit
                  className={`w-full mt-3 ${BTN_CLASS}`}
                  style={sheetBtn("primary")}
                >
                  {busy ? "신청 중…" : "오픈 알림 받기"}
                </button>
              </>
            )}
            {error && <p className="mt-2 text-center" style={{ fontSize: rem(16), color: "#C2410C" }}>{error}</p>}
            <button type="button" onClick={() => setOpen(false)} className="mt-3 w-full" style={{ minHeight: 48, fontSize: rem(17.5), color: "#6B7480" }}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
