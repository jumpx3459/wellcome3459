"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPriceWithUnit } from "@/lib/format";
import { authFetch } from "@/lib/authFetch";
import { BTN_CLASS } from "@/lib/uiText";
import { MY_BADGE, MY_CARD_TITLE, MY_DESC, MY_META, MY_SECTION, myBtnStyle } from "@/lib/myText"; // MY 전용 글자 크기 (2026-10-12)

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

// inMenu: MY 메뉴 "🔍 내 구매 요청" 펼친 패널 안 — 제목·구분선 없이 내용만 (2026-10-12)
export default function MyBuyRequests({ inMenu = false }: { inMenu?: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    authFetch("/api/my-buy-requests")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  if (items === null) return null;

  return (
    <div id="my-buy-requests" className={inMenu ? "" : "border-t border-gray200 pt-5"}>
      {!inMenu && (
        <div className="mb-3" style={MY_SECTION}>
          내 구매 요청 ({items.length})
        </div>
      )}
      {items.length === 0 ? (
        <div className="text-center rounded-2xl" style={{ padding: "22px 16px", background: inMenu ? "#fff" : "#F9FAFB" }}>
          <p style={MY_DESC}>찾는 상품을 올려두면 점핑매니저가 매물을 찾아 연결해드려요.</p>
          <Link
            href="/buy"
            className={`mt-3 w-full ${BTN_CLASS}`}
            style={myBtnStyle("primary")}
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
                  <div className="truncate" style={MY_CARD_TITLE}>{i.product_name}</div>
                  <div className="mt-0.5" style={MY_META}>{detail}</div>
                </div>
                <span className="flex-shrink-0 rounded-full whitespace-nowrap" style={{ ...MY_BADGE, padding: "4px 10px", background: st.bg, color: st.color }}>
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
