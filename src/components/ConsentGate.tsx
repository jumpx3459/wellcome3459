"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { CONSENT_TEXT } from "@/lib/consent";
import { CONSENT_CHANGED_EVENT, CONSENT_NOTICE_EVENT, announceConsents, fetchMyConsents, saveConsents } from "@/lib/consentClient";
import { clearReturningMember } from "@/lib/returningMember";
import ConsentSheet from "@/components/ConsentSheet";

// 2026-09-30: (1) 기존 회원 재동의 — 로그인했는데 tos·privacy 최신 동의 기록이 없으면 시트(필수 2 + 선택 2).
// 필수를 동의할 때까지 닫을 수 없고, 동의하지 않으면 서비스 이용 불가 안내 + 로그아웃·탈퇴 경로.
// (2) 동의/철회 직후 안내 — consentClient.showConsentNotice가 보낸 문구를 잠깐 띄움. AppShell에 있어서
// 가입 완료 직후 화면이 바뀌어도 안내가 남는다.
// 동의 조회가 실패하면(테이블 없음·네트워크) 시트를 띄우지 않는다 — 막는 쪽으로 틀리면 회원이 앱을 못 씀.

// 가입 중·약관 읽기·탈퇴·관리자·소개 화면에선 시트를 띄우지 않음
const EXCLUDED = ["/signup", "/login", "/terms", "/privacy", "/unsubscribe", "/admin", "/en", "/p/"];

export default function ConsentGate() {
  const pathname = usePathname() ?? "";
  const [needsReconsent, setNeedsReconsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return setNeedsReconsent(false);
    // 회원 행이 없으면(휴대폰 인증만 하고 가입 미완료) 대상 아님 — 동의 저장도 FK로 실패함
    const { data: member } = await supabase.from("members").select("id").eq("id", userId).maybeSingle();
    if (!member) return setNeedsReconsent(false);
    const state = await fetchMyConsents();
    if (!state) return;
    setNeedsReconsent(!state.tos?.agreed || !state.privacy?.agreed);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") check();
    });
    // 가입 화면 등 다른 곳에서 동의를 저장하면 다시 확인
    const onChanged = () => check();
    window.addEventListener(CONSENT_CHANGED_EVENT, onChanged);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener(CONSENT_CHANGED_EVENT, onChanged);
    };
  }, [check]);

  useEffect(() => {
    const onNotice = (e: Event) => setNotice((e as CustomEvent<string>).detail);
    window.addEventListener(CONSENT_NOTICE_EVENT, onNotice);
    return () => window.removeEventListener(CONSENT_NOTICE_EVENT, onNotice);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const submit = async (values: Record<string, boolean>) => {
    setBusy(true);
    setError(null);
    const consents = (["tos", "privacy", "deal_alert_ad", "kakao_marketing"] as const).map((type) => ({ type, agreed: Boolean(values[type]) }));
    const r = await saveConsents(consents, "reconsent");
    setBusy(false);
    if (!r.ok) {
      setError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setNeedsReconsent(false);
    // 선택 항목은 동의한 것만 안내 (처음 받는 동의라 "철회"는 없음)
    announceConsents(consents.filter((c) => c.agreed), r.recordedAt);
  };

  const logout = async () => {
    if (!supabase) return;
    clearReturningMember();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    window.location.replace("/");
  };

  const excluded = EXCLUDED.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));

  return (
    <>
      {needsReconsent && !excluded && (
        <ConsentSheet
          title="약관 동의가 필요해요"
          desc="덤핑점핑 약관이 정리되어 한 번만 다시 동의를 받고 있어요."
          showAll
          items={[
            { type: "tos", required: true, label: CONSENT_TEXT.tos.label, href: CONSENT_TEXT.tos.href },
            { type: "privacy", required: true, label: CONSENT_TEXT.privacy.label, href: CONSENT_TEXT.privacy.href },
            { type: "deal_alert_ad", required: false, label: CONSENT_TEXT.deal_alert_ad.label, desc: CONSENT_TEXT.deal_alert_ad.desc },
            { type: "kakao_marketing", required: false, label: CONSENT_TEXT.kakao_marketing.label, desc: CONSENT_TEXT.kakao_marketing.desc },
          ]}
          primaryLabel="동의하고 계속하기"
          busy={busy}
          error={error}
          onSubmit={submit}
          footer={
            <p className="mt-3 text-center" style={{ fontSize: rem(14), color: "#6B7480", lineHeight: 1.6 }}>
              필수 항목에 동의하지 않으면 덤핑점핑 서비스를 이용할 수 없어요.
              <br />
              <button type="button" onClick={logout} className="font-bold underline" style={{ color: "#4B5563", minHeight: 44 }}>
                로그아웃
              </button>
              <span aria-hidden> · </span>
              <a href="/unsubscribe" className="font-bold underline" style={{ color: "#4B5563" }}>
                탈퇴하기
              </a>
            </p>
          }
        />
      )}
      {notice && (
        <div
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-4 pointer-events-none"
          style={{ bottom: "calc(var(--nav-bottom, 0px) + 16px)" }}
        >
          <div
            className="text-white font-bold rounded-2xl shadow-lg text-center"
            style={{ background: "rgba(11,37,64,0.94)", padding: "12px 16px", fontSize: rem(14), lineHeight: 1.5, whiteSpace: "pre-line" }}
          >
            {notice}
          </div>
        </div>
      )}
    </>
  );
}
