"use client";

import { useEffect, useRef, useState } from "react";
import NoticeBoard, { type NoticeItem } from "@/components/NoticeBoard";
import { useBuyNoticeItem } from "@/components/BuyNoticeBoard";
import { hasMemberSession } from "@/lib/dealPriceAccess";
import { recordPartnerClick } from "@/lib/metrics";
import { usePartnerImpression } from "@/lib/usePartnerImpression";
import {
  BOARD_ROTATE_MS,
  BUY_NOTICE_ID,
  PARTNER_CHIP_LABEL,
  PARTNER_ITEMS,
  PARTNER_KAKAO_FRIEND_URL,
  boardSequence,
  type PartnerAudience,
  type SlotId,
} from "@/lib/partnerSlots";

// 알림판 (2026-11-02 feat/partner-board-rotation) — 위치에 묶이지 않는 한 줄(44px) 회전 칸. 슬롯 하나만 받음.
// 순서: "찾습니다" 알림(buy_notice)과 안내 항목을 번갈아(boardSequence), 항상 찾습니다에서 시작, 6초마다 다음.
// 멈춤: 화면에 절반 미만 보일 때 · 탭이 숨겨졌을 때 · 누르고 있거나 포커스가 있을 때 · 움직임 줄이기 설정(처음 항목 고정).
// 노출 기록: 항목마다 따로 마운트해 usePartnerImpression(절반 이상 1초, 세션당 슬롯×항목 1회) — 회전은 절반 이상 보일 때만 돌아 한 항목이 6초 연속 보임.
// 이름 규칙: 파일·클래스·id에 ad·track·banner·sponsor를 쓰지 않음(광고 차단 도구 회피).
export type BoardSlot = Extract<SlotId, "home_board_member" | "home_board_guest" | "deals_board">;

const TAG_STYLE = { tagBg: "#F5F6F8", tagColor: "#6B7480" } as const;

export default function PartnerBoard({ slot }: { slot: BoardSlot }) {
  const fixedAudience: PartnerAudience | null = slot === "home_board_member" ? "member" : slot === "home_board_guest" ? "guest" : null;
  const [sessionAudience, setSessionAudience] = useState<PartnerAudience | null>(null);
  const audience = fixedAudience ?? sessionAudience;
  const buyItem = useBuyNoticeItem();

  // /deals는 회원·비회원이 같이 보는 화면 — 판별 전엔 찾습니다만(회전 없음), 판별 뒤에 시작(높이는 그대로 44px)
  useEffect(() => {
    if (fixedAudience) return;
    let alive = true;
    hasMemberSession().then((m) => {
      if (alive) setSessionAudience(m ? "member" : "guest");
    });
    return () => {
      alive = false;
    };
  }, [fixedAudience]);

  const seq = audience ? boardSequence(audience) : [BUY_NOTICE_ID];
  const [idx, setIdx] = useState(0);
  const id = seq[idx % seq.length];

  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [held, setHeld] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if (e) setInView(e.isIntersecting && e.intersectionRatio >= 0.5);
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = !reduced && seq.length > 1 && inView && pageVisible && !held;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % seq.length), BOARD_ROTATE_MS);
    return () => clearTimeout(t);
  }, [running, idx, seq.length]);

  let item: NoticeItem;
  if (id === BUY_NOTICE_ID) {
    item = { ...buyItem, onClick: () => recordPartnerClick(slot, BUY_NOTICE_ID) };
  } else {
    const p = PARTNER_ITEMS.find((x) => x.id === id);
    const kakao = p?.action.type === "kakao";
    item = {
      tag: PARTNER_CHIP_LABEL.notice,
      ...TAG_STYLE,
      body: p?.title ?? "",
      href: p?.action.type === "link" ? p.action.href : kakao ? PARTNER_KAKAO_FRIEND_URL : "/",
      external: kakao,
      onClick: () => recordPartnerClick(slot, id),
    };
  }

  return (
    <div
      ref={wrapRef}
      style={{ height: 44 }}
      data-partner-board
      data-slot={slot}
      data-partner-id={id}
      onPointerDown={() => setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <BoardItem key={id} slot={slot} id={id} item={item} />
    </div>
  );
}

// 항목마다 따로 마운트 — 넘어가면 노출 타이머(1초)가 취소되고, 같은 항목이 다시 나와도 세션 키가 막음
function BoardItem({ slot, id, item }: { slot: BoardSlot; id: string; item: NoticeItem }) {
  const ref = useRef<HTMLDivElement>(null);
  usePartnerImpression(ref, slot, id);
  return (
    <div ref={ref} style={{ height: 44 }}>
      <NoticeBoard items={[item]} />
    </div>
  );
}
