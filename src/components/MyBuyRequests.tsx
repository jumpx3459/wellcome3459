"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rem } from "@/lib/rem";
import { formatPriceWithUnit } from "@/lib/format";
import { SECTION_TITLE_STYLE } from "@/components/EcosystemGrid";

// 마이페이지 "내 구매 요청" (2026-09-29) — 로그인 상태로 /buy에서 등록한 요청(buy_requests.member_id) 최근 10건.
type Item = {
  id: string;
  product_name: string;
  quantity: string | null;
  hope_price: number | null;
  hope_price_unit: string | null;
  contacted: boolean;
  outcome: "pending" | "matched" | "no_match";
  created_at: string;
};

// 관리자 화면의 연락/결과 처리 상태를 회원용 말로
function status(i: Item): { label: string; bg: string; color: string } {
  if (i.outcome === "matched") return { label: "매물 연결됨", bg: "#E8F8EC", color: "#1D8A44" };
  if (i.outcome === "no_match") return { label: "맞는 매물 없음", bg: "#F5F6F8", color: "#4B5563" };
  if (i.contacted) return { label: "매니저 확인 중", bg: "#FDEEE8", color: "#C2410C" };
  return { label: "접수됨", bg: "#EEF3FA", color: "#1B3A5C" };
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export default function MyBuyRequests({ accessToken }: { accessToken: string | null }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/my-buy-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, [accessToken]);

  if (items === null) return null;

  return (
    <div id="my-buy-requests" className="border-t border-gray200 pt-5">
      <div className="mb-3" style={SECTION_TITLE_STYLE}>
        내 구매 요청 ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="text-center rounded-2xl" style={{ padding: "22px 16px", background: "#F9FAFB" }}>
          <p style={{ fontSize: rem(15), color: "#4B5563" }}>찾는 상품을 올려두면 점핑매니저가 매물을 찾아 연결해드려요.</p>
          <Link
            href="/buy"
            className="inline-block mt-3 font-bold rounded-full text-white"
            style={{ fontSize: rem(15), padding: "10px 20px", background: "var(--color-brandOrangeDeep)" }}
          >
            구매 요청하기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((i) => {
            const st = status(i);
            const detail = [
              i.quantity ? `${i.quantity}` : null,
              i.hope_price ? `${formatPriceWithUnit(Number(i.hope_price), i.hope_price_unit)} 이하` : null,
              fmtDate(i.created_at),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={i.id} className="bg-white border border-gray200 rounded-xl flex items-center gap-3" style={{ padding: "12px 14px" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate" style={{ fontSize: rem(16), color: "#1F2937" }}>{i.product_name}</div>
                  <div className="mt-0.5" style={{ fontSize: rem(14), color: "#4B5563" }}>{detail}</div>
                </div>
                <span className="flex-shrink-0 rounded-full font-bold" style={{ fontSize: rem(13), padding: "4px 10px", background: st.bg, color: st.color }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
