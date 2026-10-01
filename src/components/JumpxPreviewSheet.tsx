"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { JUMPX_SITE_URL } from "@/lib/features";
import { isInAppBrowser } from "@/lib/browserEnv";
import { openExternal } from "@/lib/openExternal";
import { getFreshAccessToken } from "@/lib/authFetch";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { useBackToClose } from "@/lib/useBackToClose";

// 매물 상세 "점프엑스에서 거래하기 · 오픈 준비 중" 바텀시트 (2026-09-29, JUMPX_PREVIEW_ENABLED).
// 점프엑스(jumpx.co.kr)는 아직 서비스 구축 중 — 둘러보기 링크 + 오픈 알림 신청(feature_waitlist, feature = "jumpx_open")만.
// 날짜·일정·수수료 등 확정 안 된 내용은 넣지 않는다.
const FEATURE = "jumpx_open";
export const JUMPX_PREVIEW_URL = `${JUMPX_SITE_URL}/?utm_source=dumpingjumping&utm_medium=deal_detail&utm_campaign=preview`;

// 카카오톡 등 인앱 브라우저는 새 탭이 막히거나 인앱 안에서 열려서 외부 브라우저로 (openExternal).
// 외부로 못 여는 환경(iPhone 기타 인앱)이면 그냥 새 탭 시도.
export function openJumpxPreview(): void {
  if (isInAppBrowser() && openExternal(JUMPX_PREVIEW_URL)) return;
  window.open(JUMPX_PREVIEW_URL, "_blank", "noopener,noreferrer");
}

// 둘러보기 클릭 기록 (bridge_interests, source = "preview") — 회원은 서버가 토큰으로 결정, 비회원은 null.
// fire-and-forget: 새 탭·외부 열기를 먼저 하고(팝업 차단 방지) 기록 실패는 무시.
function recordPreviewClick(dealId: string): void {
  getFreshAccessToken()
    .catch(() => null)
    .then((accessToken) =>
      fetch("/api/bridge-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, accessToken, source: "preview" }),
        keepalive: true, // 카카오 인앱은 외부 브라우저로 넘어가며 페이지가 떠날 수 있음
      }),
    )
    .catch(() => {});
}

export default function JumpxPreviewSheet({
  dealId,
  memberId,
  returnTo,
  onClose,
}: {
  dealId: string;
  memberId: string | null;
  returnTo: string; // 비로그인 → 로그인 후 돌아올 곳 (이 매물 상세)
  onClose: () => void;
}) {
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  // 2026-10-01 PR-C: 열려 있으면 안드로이드 뒤로가기 = 이것만 닫기 (src/lib/useBackToClose.ts)
  useBackToClose(true, onClose);
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

  const join = async () => {
    if (!memberId || !supabase || joined || busy) return;
    setBusy(true);
    setError(null);
    // role은 견적함(받은/보낸)용 칸이라 여기선 비움 (null 허용)
    const { error: insertError } = await supabase.from("feature_waitlist").insert({ member_id: memberId, feature: FEATURE });
    // 23505 = 이미 신청함(unique) — 신청된 것으로 처리
    if (!insertError || insertError.code === "23505") setJoined(true);
    else setError("신청에 실패했어요. 잠시 후 다시 시도해주세요.");
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,.5)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="점프엑스 오픈 준비 중"
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl"
        style={{ padding: "26px 20px calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-black" style={{ fontSize: rem(20), color: "#0B2540", lineHeight: 1.4 }}>
          점프엑스는 지금 서비스 구축 중이에요
        </p>
        <p className="mt-2.5" style={{ fontSize: rem(16), color: "#374151", lineHeight: 1.6 }}>
          곧 이 매물 같은 재고를 점프엑스에서 입찰·경매로 거래할 수 있어요. 지금은 둘러보기만 가능해요.
        </p>

        <button
          type="button"
          onClick={() => {
            openJumpxPreview();
            recordPreviewClick(dealId);
          }}
          className={`w-full mt-5 ${BTN_CLASS}`}
          style={btnStyle("secondary")}
        >
          점프엑스 둘러보기 ↗
        </button>

        {!memberId ? (
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className={`w-full mt-2.5 ${BTN_CLASS}`}
            style={btnStyle("primary")}
          >
            로그인하고 오픈 알림 받기
          </Link>
        ) : joined ? (
          <div
            className="mt-2.5 text-center font-black rounded-2xl"
            style={{ minHeight: 52, lineHeight: "52px", fontSize: rem(16), background: "#E8F8EC", color: "#1D8A44" }}
          >
            ✓ 신청 완료 · 오픈하면 알려드릴게요
          </div>
        ) : (
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className={`w-full mt-2.5 ${BTN_CLASS}`}
            style={btnStyle("primary")}
          >
            {busy ? "신청 중…" : "오픈 알림 받기"}
          </button>
        )}
        {error && (
          <p className="mt-2 text-center" style={{ fontSize: rem(14), color: "#C2410C" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full text-center font-bold mt-3"
          style={{ minHeight: 44, fontSize: rem(15), color: "#6B7480" }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
