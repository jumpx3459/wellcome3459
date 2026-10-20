"use client";

import { useEffect, useState } from "react";
import NoticeBoard from "@/components/NoticeBoard";
import { buyNoticePieces, type BuySummary } from "@/lib/buyNotice";

// /deals "찾습니다" 알림판 (2026-10-13) — 항상 표시. 요약(/api/buy-requests/summary)을 받기 전·실패하면 0건 문구.
// 누르면 /buy(찾습니다 목록 — 등록 폼은 /buy/new). 회원·비회원 같은 화면.
const EMPTY: BuySummary = { count: 0, names: [] };

export default function BuyNoticeBoard() {
  const [summary, setSummary] = useState<BuySummary>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/buy-requests/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || typeof d.count !== "number" || !Array.isArray(d.names)) return;
        setSummary({ count: d.count, names: d.names.filter((n: unknown): n is string => typeof n === "string") });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const body = buyNoticePieces(summary).map((p, i) =>
    p.strong ? (
      <b key={i} style={{ fontWeight: 800, color: "#0b2540" }}>
        {p.text}
      </b>
    ) : (
      <span key={i}>{p.text}</span>
    )
  );

  return <NoticeBoard items={[{ tag: "찾습니다", tagBg: "#dcfce7", tagColor: "#166534", body, href: "/buy" }]} />;
}
