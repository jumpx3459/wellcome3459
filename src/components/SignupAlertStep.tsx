"use client";

import { useState, type CSSProperties } from "react";
import { DEAL_ALERT_DESC } from "@/lib/consent";
import { announceConsents, saveConsents } from "@/lib/consentClient";
import { getPushState, savePushSubscription, subscribeToPush } from "@/lib/pushClient";
import { rem } from "@/lib/rem";

// 가입 직후 매물 알림 선택 화면 (2026-11-03 feat/signup-alert-step) — 가입 2단계 동의 상자에서 매물 알림 줄을 빼고 여기서 한 번 묻는다.
// 가입(회원 행·필수 동의·카테고리)은 이미 끝난 상태. [새 매물 알림 받기] = 동의 저장 → 저장 확인 후 같은 클릭 안에서 권한 요청·구독(pushClient 그대로).
// [다음에 할게요] = 아무 행도 저장하지 않음(미응답) — 두 버튼은 같은 크기·진하기(거절을 숨기거나 흐리게 하지 않음). 동의 문구·버전은 consent.ts 그대로.
const PRIMARY: CSSProperties = { minHeight: 52, background: "#0B2540", color: "#fff", border: "1.5px solid #0B2540", fontWeight: 800 };
const SECONDARY: CSSProperties = { minHeight: 52, background: "#fff", color: "#1F2937", border: "1.5px solid #9CA3AF", fontWeight: 800 };
const BTN = "w-full rounded-2xl flex items-center justify-center disabled:opacity-60";

export const alertStepSummary = (n: number) =>
  n > 0 ? `선택하신 관심 품목 ${n}개의 새 매물을 바로 알려드려요` : "관심 품목을 고르면 맞는 매물을 알려드려요";

export default function SignupAlertStep({
  categoryCount,
  onDone,
  showToast,
}: {
  categoryCount: number;
  /** 홈(또는 returnTo)으로 이동 — 부모가 정함 */
  onDone: () => void;
  showToast: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 토스트 1줄을 잠깐 보여 준 뒤 이동(이동하면 화면이 바뀌어 토스트가 사라지므로)
  const toastThenGo = async (message: string) => {
    showToast(message);
    await new Promise((r) => setTimeout(r, 1600));
    onDone();
  };

  const agree = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const consents = [{ type: "deal_alert_ad" as const, agreed: true }];
    const saved = await saveConsents(consents, "signup");
    if (!saved.ok) {
      // 동의 저장 실패 — 화면 유지(홈으로 안 감), 다시 누를 수 있음
      setError("동의를 저장하지 못했어요. 잠시 후 다시 눌러주세요.");
      setBusy(false);
      return;
    }
    announceConsents(consents, saved.recordedAt);
    try {
      // 인앱·아이폰 미설치·미지원·정식 주소 아님은 권한 요청 없이 동의만 — 홈의 안내 카드(AlertGapCard)가 이유를 알려줌
      const state = await getPushState();
      if (state.status === "inapp" || state.status === "ios_needs_install" || state.status === "unsupported" || state.status === "noncanonical") {
        onDone();
        return;
      }
      const r = await subscribeToPush();
      if (r.status === "subscribed") {
        if (r.subscription.endpoint) {
          const sv = await savePushSubscription(r.subscription, { explicit: true }); // 직접 [받기]를 누른 명시적 선택
          if (sv !== "saved") {
            await toastThenGo("알림 등록에 실패했어요. MY에서 다시 켤 수 있어요");
            return;
          }
        }
        onDone();
        return;
      }
      if (r.status === "denied") {
        await toastThenGo("브라우저 알림이 차단돼 있어요. MY에서 다시 켤 수 있어요");
        return;
      }
      onDone();
    } catch {
      await toastThenGo("알림을 켜지 못했어요. MY에서 다시 켤 수 있어요");
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-white" data-signup-alert-step>
      <div className="flex-1" style={{ padding: "56px 22px calc(32px + var(--nav-bottom, 0px))" }}>
        <div className="flex items-center justify-center rounded-full mx-auto" style={{ width: 64, height: 64, background: "#FDEEE8", fontSize: rem(30) }} aria-hidden>
          🔔
        </div>
        <h1 className="font-display text-center mt-4" style={{ fontSize: rem(23), color: "#0B2540", letterSpacing: "-0.02em", lineHeight: 1.35 }}>
          새 매물이 올라오면 바로 알려드릴까요?
        </h1>
        <p className="mt-3" style={{ fontSize: rem(15), color: "#4B5563", lineHeight: 1.65 }} data-alert-step-desc>
          {DEAL_ALERT_DESC}
        </p>
        <div className="rounded-2xl mt-4" style={{ background: "#F5F6F8", padding: "14px 16px" }} data-alert-step-summary>
          <span className="font-bold" style={{ fontSize: rem(15), color: "#0B2540", lineHeight: 1.5 }}>
            {alertStepSummary(categoryCount)}
          </span>
        </div>
        {error && (
          <p className="mt-3 font-medium" role="alert" style={{ fontSize: rem(14), color: "#B42318" }} data-alert-step-error>
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2.5 mt-6">
          <button type="button" onClick={agree} disabled={busy} className={BTN} style={{ ...PRIMARY, fontSize: rem(16) }} data-alert-step-yes>
            {busy ? "저장 중…" : "새 매물 알림 받기"}
          </button>
          <button type="button" onClick={onDone} disabled={busy} className={BTN} style={{ ...SECONDARY, fontSize: rem(16) }} data-alert-step-no>
            다음에 할게요
          </button>
        </div>
        <p className="mt-3 text-center" style={{ fontSize: rem(14), color: "#4B5563", lineHeight: 1.55 }}>
          MY에서 언제든 켜고 끌 수 있어요
        </p>
      </div>
    </main>
  );
}
