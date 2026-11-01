"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rem } from "@/lib/rem";
import { JUMPX_WAITLIST_SLOT_ENABLED } from "@/lib/features";
import { hasMemberSession } from "@/lib/dealPriceAccess";
import { recordPartnerClick } from "@/lib/metrics";
import { nextRotationIndex } from "@/lib/metricsCore";
import { usePartnerImpression } from "@/lib/usePartnerImpression";
import { PARTNER_CHIP_LABEL, PARTNER_KAKAO_FRIEND_URL, partnerRotation, type PartnerItem, type SlotId } from "@/lib/partnerSlots";

// 제휴·안내 칸 (2026-11-01 feat/partner-card-slots) — 지금은 자사 안내 항목만 돌림(src/lib/partnerSlots.ts PARTNER_ITEMS).
// 노출은 절반 이상 1초(usePartnerImpression), 클릭은 누른 순간 기록(PR 1 집계). 터치 영역 44px 이상.
// 이름 규칙: 파일·클래스·id에 ad·track·banner·sponsor를 쓰지 않음(광고 차단 도구 회피).
export type PartnerVariant = "bar" | "card" | "inline";

const FEATURE = "jumpx_open"; // JumpxPreviewSheet와 같은 feature_waitlist 값

export default function PartnerCard({
  slot,
  variant,
  excludeIds,
}: {
  slot: SlotId;
  variant: PartnerVariant;
  excludeIds?: readonly string[]; // 지금 화면과 겹치는 항목 빼기(예: 판매 등록 완료 화면의 "판매 등록하기")
}) {
  const [item, setItem] = useState<PartnerItem | null>(null);
  const excludeKey = (excludeIds ?? []).join(",");

  useEffect(() => {
    let alive = true;
    hasMemberSession().then((member) => {
      if (!alive) return; // 엄격 모드 첫 실행은 취소 — 순번은 한 번만 올림
      const list = partnerRotation(member ? "member" : "guest", JUMPX_WAITLIST_SLOT_ENABLED, excludeKey ? excludeKey.split(",") : []);
      if (list.length === 0) return;
      let storage: Storage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }
      setItem(list[nextRotationIndex(storage, slot, list.length)]);
    });
    return () => {
      alive = false;
    };
  }, [slot, excludeKey]);

  if (!item) return null;
  return <PartnerCardView key={item.id} slot={slot} variant={variant} item={item} />;
}

function PartnerCardView({ slot, variant, item }: { slot: SlotId; variant: PartnerVariant; item: PartnerItem }) {
  const ref = useRef<HTMLDivElement>(null);
  usePartnerImpression(ref, slot, item.id);

  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const isWaitlist = item.action.type === "waitlist";

  // 이미 신청한 회원이면 처음부터 "신청 완료"
  useEffect(() => {
    if (!isWaitlist || !supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!.auth.getUser();
      if (!data.user) return;
      const { data: row } = await supabase!.from("feature_waitlist").select("id").eq("member_id", data.user.id).eq("feature", FEATURE).maybeSingle();
      if (alive && row) setJoined(true);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [isWaitlist]);

  const join = async () => {
    recordPartnerClick(slot, item.id);
    if (!supabase || joined || busy) return;
    setBusy(true);
    setError(false);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("no user");
      const { error: insertError } = await supabase.from("feature_waitlist").insert({ member_id: data.user.id, feature: FEATURE });
      // 23505 = 이미 신청함(unique) — 신청된 것으로 처리
      if (!insertError || insertError.code === "23505") setJoined(true);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const chip = (
    <span
      data-partner-chip
      className="inline-block font-bold rounded-full whitespace-nowrap bg-gray100 text-gray500"
      style={{ fontSize: rem(12), padding: "2px 8px", lineHeight: 1.4 }}
    >
      {PARTNER_CHIP_LABEL[item.chip]}
    </span>
  );

  const ctaLabel = isWaitlist ? (joined ? "✓ 신청 완료" : busy ? "신청 중…" : item.cta) : item.cta;
  const errorNote = error ? (
    <p className="mt-1" style={{ fontSize: rem(13), color: "#C2410C" }} data-partner-error>
      신청에 실패했어요. 잠시 후 다시 시도해주세요.
    </p>
  ) : null;

  // 눌렀을 때 동작 — 링크/카카오는 <a>/<Link>, 오픈 알림은 button
  const wrap = (className: string, style: React.CSSProperties, children: React.ReactNode) => {
    const common = { className, style, "data-partner-action": item.action.type } as const;
    if (item.action.type === "link") {
      return (
        <Link href={item.action.href} onClick={() => recordPartnerClick(slot, item.id)} {...common}>
          {children}
        </Link>
      );
    }
    if (item.action.type === "kakao") {
      return (
        <a href={PARTNER_KAKAO_FRIEND_URL} target="_blank" rel="noopener noreferrer" onClick={() => recordPartnerClick(slot, item.id)} {...common}>
          {children}
        </a>
      );
    }
    return (
      <button type="button" onClick={join} disabled={busy || joined} {...common}>
        {children}
      </button>
    );
  };

  const dataAttrs = { "data-partner-card": "", "data-slot": slot, "data-partner-id": item.id, "data-variant": variant } as const;

  if (variant === "bar") {
    return (
      <div ref={ref} {...dataAttrs}>
        {wrap(
          "w-full flex items-center gap-2 rounded-2xl bg-white text-left border border-gray200",
          { minHeight: 48, padding: "6px 14px" },
          <>
            {chip}
            <span className="flex-1 min-w-0 font-bold text-navy truncate" style={{ fontSize: rem(15) }}>
              {isWaitlist && joined ? "✓ 신청 완료 · 오픈하면 알려드릴게요" : item.title}
            </span>
            <span className="text-gray500 flex-shrink-0" style={{ fontSize: rem(15) }}>
              {isWaitlist ? (joined ? "" : busy ? "…" : "›") : "›"}
            </span>
          </>
        )}
        {errorNote}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div ref={ref} {...dataAttrs}>
        {wrap(
          "w-full flex items-center gap-2 text-left",
          { minHeight: 44, padding: "6px 2px" },
          <>
            {chip}
            <span className="flex-1 min-w-0" style={{ fontSize: rem(15), color: "#374151", lineHeight: 1.45 }}>
              <span className="font-bold text-navy">{item.title}</span>
              <span className="text-gray500"> · {isWaitlist && joined ? "신청 완료" : item.desc}</span>
            </span>
            <span className="font-bold flex-shrink-0 text-navy" style={{ fontSize: rem(14) }}>
              {ctaLabel} ›
            </span>
          </>
        )}
        {errorNote}
      </div>
    );
  }

  // card — 이미지 없는 카드
  return (
    <div ref={ref} {...dataAttrs} className="rounded-2xl border border-gray200 bg-white text-left" style={{ padding: "14px 16px" }}>
      <div className="mb-1.5">{chip}</div>
      <p className="font-black text-navy" style={{ fontSize: rem(17), lineHeight: 1.4 }}>
        {item.title}
      </p>
      <p className="mt-1 text-gray500" style={{ fontSize: rem(15), lineHeight: 1.5 }}>
        {item.desc}
      </p>
      {wrap(
        "w-full flex items-center justify-center text-center font-bold rounded-xl mt-3 border-2 border-navy text-navy bg-white disabled:opacity-60",
        { minHeight: 48, fontSize: rem(16), padding: "0 14px" },
        <>{ctaLabel}</>
      )}
      {errorNote}
    </div>
  );
}
