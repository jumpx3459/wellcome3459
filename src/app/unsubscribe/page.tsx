"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { authFetch } from "@/lib/authFetch";
import { clearReturningMember } from "@/lib/returningMember";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 2026-09-28 보안 수정: 예전엔 전화번호만 입력하면 그 번호의 회원을 바로 삭제했음.
// 이제 로그인 필수 + "알림 끄기"(푸시 구독만 삭제)와 "회원 탈퇴"(확인 단계 필수)를 분리.

// 이 기기의 브라우저 구독도 같이 해제 — 남겨두면 마이페이지 알림 카드가 다시 저장해버림
async function unsubscribeThisDevice() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {}
}

export default function UnsubscribePage() {
  const [token, setToken] = useState<string | null | undefined>(undefined); // undefined = 확인 중
  const [busy, setBusy] = useState<"push_off" | "withdraw" | null>(null);
  const [done, setDone] = useState<"push_off" | "withdraw" | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setToken(null);
      return;
    }
    // 로그인 여부 판단용으로만 씀 — 실제 요청 토큰은 authFetch가 호출 직전에 최신으로 받음
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const run = async (action: "push_off" | "withdraw") => {
    if (!token || busy) return;
    setError(null);
    setBusy(action);
    try {
      const res = await authFetch("/api/unsubscribe", { json: { action, confirm: action === "withdraw" ? true : undefined } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      await unsubscribeThisDevice();
      if (action === "withdraw") {
        clearReturningMember(); // 재방문 화면 신호(로그인 기록·방식)도 지움
        // 탈퇴는 서버(/api/unsubscribe)가 auth 계정을 이미 지워 모든 기기 세션이 무효 — 여기선 이 기기 저장소만 비움
        await supabase?.auth.signOut({ scope: "local" });
      }
      setDone(action);
    } catch {
      setError("처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(null);
    }
  };

  if (done) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-5xl mb-4">👋</div>
        <h1 className="font-display text-2xl text-navy mb-2">
          {done === "withdraw" ? "탈퇴가 완료됐어요" : "알림을 껐어요"}
        </h1>
        <p className="text-gray500 text-base leading-relaxed">
          {done === "withdraw"
            ? "등록된 개인정보를 삭제했어요. 언제든 다시 가입하실 수 있어요."
            : "더 이상 푸시 알림이 발송되지 않아요. 마이페이지에서 언제든 다시 켤 수 있어요."}
        </p>
        <Link href={done === "withdraw" ? "/" : "/mypage"} className="mt-6 text-orange font-bold underline">
          {done === "withdraw" ? "홈으로" : "마이페이지로"}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen px-6 py-10">
      <h1 className="font-display text-2xl text-navy mb-2">알림 해지 · 탈퇴</h1>

      {token === undefined ? null : !token ? (
        <div className="rounded-2xl p-5 mt-2" style={{ background: "#F5F6F8" }}>
          <p className="text-base leading-relaxed" style={{ color: "#1A1F26" }}>
            본인 확인을 위해 로그인한 뒤 이용할 수 있어요.
          </p>
          <Link
            href="/login?returnTo=/unsubscribe"
            className={`w-full mt-4 ${BTN_CLASS}`}
            style={btnStyle("primary")}
          >
            로그인하기
          </Link>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: "#6B7480" }}>
            로그인이 어려우면 고객센터(<Link href="/support" className="underline">문의하기</Link>)로 삭제를 요청해주세요.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl p-5 mt-2" style={{ border: "1px solid #E4E7EB" }}>
            <h2 className="font-bold text-navy text-lg">알림만 끄기</h2>
            <p className="text-base leading-relaxed mt-1" style={{ color: "#6B7480" }}>
              모든 기기의 푸시 알림을 끕니다. 회원 정보와 알림 조건은 그대로 남아요.
            </p>
            <button
              onClick={() => run("push_off")}
              disabled={busy !== null}
              className={`w-full mt-4 ${BTN_CLASS}`}
              style={btnStyle("secondary")}
            >
              {busy === "push_off" ? "처리 중..." : "알림 끄기"}
            </button>
          </section>

          <section className="rounded-2xl p-5 mt-4" style={{ border: "1px solid #E4E7EB" }}>
            <h2 className="font-bold text-navy text-lg">회원 탈퇴</h2>
            <p className="text-base leading-relaxed mt-1" style={{ color: "#6B7480" }}>
              회원 정보, 알림 조건, 관심 매물, 쪽지가 모두 삭제되고 되돌릴 수 없어요.
            </p>
            <label className="flex items-start gap-2 mt-4 text-base" style={{ color: "#1A1F26" }}>
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmWithdraw}
                onChange={(e) => setConfirmWithdraw(e.target.checked)}
              />
              위 내용을 확인했고, 탈퇴하겠습니다.
            </label>
            <button
              onClick={() => run("withdraw")}
              disabled={!confirmWithdraw || busy !== null}
              className={`w-full mt-4 ${BTN_CLASS}`}
              // 탈퇴는 되돌릴 수 없어 보조 버튼 모양 + 빨강 계열(주황은 주 버튼 전용), 확인 전엔 흐리게
              style={{ ...btnStyle("secondary"), color: "#DC2626", border: "1.5px solid #FCA5A5", opacity: !confirmWithdraw ? 0.4 : 1 }}
            >
              {busy === "withdraw" ? "처리 중..." : "회원 탈퇴하기"}
            </button>
          </section>
        </>
      )}

      {error && <div className="text-base text-orange font-medium mt-4">{error}</div>}

      <div className="mt-auto pt-16 flex flex-col items-center text-center">
        <img
          src="/images/manager.png"
          alt="점핑매니저"
          className="w-40 h-40 rounded-2xl object-contain bg-white mb-4"
        />
        <p className="text-sm text-gray500 leading-relaxed">
          떠나셔도 괜찮아요. 언제든 다시 오시면{" "}
          <br className="hidden sm:inline" />
          점핑매니저가 반갑게 맞아드릴게요.
        </p>
      </div>
    </main>
  );
}
