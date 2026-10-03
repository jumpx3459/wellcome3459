"use client";

import { useEffect, useState } from "react";
import { UI_CARD_TITLE, UI_DESC, UI_META } from "@/lib/uiText";
import { rem } from "@/lib/rem";
import { CONSENT_CHANGED_EVENT, announceConsents, fetchMyConsents, saveConsents, type ConsentState } from "@/lib/consentClient";
import { formatConsentDate, type ConsentType } from "@/lib/consent";

// 2026-09-30: MY 수신 동의 토글 — 바꿀 때마다 member_consents에 새 행(source mypage).
// 매물 알림을 철회하면 발송 대상에서만 빠지고(sendDealPush·sendNoticePush), 기기 푸시 구독은 그대로 둔다.
const ROWS: { type: ConsentType; title: string; desc: string }[] = [
  { type: "deal_alert_ad", title: "매물 알림 수신 동의", desc: "광고성 정보 · 관심 조건 재고 매물과 폐업·정리 부동산·설비 소식을 앱 푸시로 알려드려요" },
  { type: "kakao_marketing", title: "카카오톡 채널 소식 수신 동의", desc: "광고성 정보 · 공지·이벤트 소식" },
];

export default function ConsentToggles() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [saving, setSaving] = useState<ConsentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => fetchMyConsents().then((c) => c && setState(c));
    load();
    window.addEventListener(CONSENT_CHANGED_EVENT, load);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, load);
  }, []);

  // 조회 실패(테이블 없음 등)면 카드를 숨김 — 저장도 안 되는 토글을 보여주지 않음
  if (!state) return null;

  const toggle = async (type: ConsentType) => {
    if (saving) return;
    const next = !state[type]?.agreed;
    setSaving(type);
    setError(null);
    const consents = [{ type, agreed: next }];
    const r = await saveConsents(consents, "mypage");
    setSaving(null);
    if (!r.ok) {
      setError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setState((s) => ({ ...s, [type]: { agreed: next, createdAt: r.recordedAt } }));
    announceConsents(consents, r.recordedAt);
  };

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3.5" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
      {ROWS.map((row) => {
        const cur = state[row.type];
        const on = Boolean(cur?.agreed);
        return (
          <button
            key={row.type}
            type="button"
            onClick={() => toggle(row.type)}
            disabled={saving !== null}
            className="w-full flex items-center gap-3 disabled:opacity-60"
            aria-pressed={on}
          >
            <span className="flex-1 min-w-0 text-left">
              <span className="block" style={UI_CARD_TITLE}>{row.title}</span>
              <span className="block mt-0.5" style={UI_DESC}>{row.desc}</span>
              {cur && (
                <span className="block mt-0.5" style={UI_META}>
                  {formatConsentDate(cur.createdAt)} {on ? "동의" : "미동의"}
                </span>
              )}
            </span>
            <span className="flex-shrink-0 rounded-full relative" style={{ width: 42, height: 24, background: on ? "var(--color-brandOrange)" : "#E4E7EB", transition: "background 0.15s" }}>
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 18, height: 18, top: 3, left: on ? 21 : 3, transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}
              />
            </span>
          </button>
        );
      })}
      {error && <p className="font-medium" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>{error}</p>}
    </div>
  );
}
