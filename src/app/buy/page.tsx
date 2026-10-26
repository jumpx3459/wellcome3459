"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TabLink from "@/components/TabLink";
import { hasAppHistory, goHome } from "@/lib/appNav";
import { categoryIcons } from "@/lib/mockData";
import { daysAgoLabel, type PublicBuyItem } from "@/lib/buyExposure";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { rem } from "@/lib/rem";

// "찾습니다" 목록 (2026-10-20) — 점핑매니저가 연락해 확인한 구매 요청만(노출 조건·시험 제외는 src/lib/buyExposure.ts, /api/buy-requests/public).
// 연락처·희망가·설명·이름은 받지도 않는다. 등록 폼은 /buy/new. 카드 [공급 가능해요] → /sell?buyRef=<id>(공급 제안 모드).
// 2026-10-26 버튼 위계: 이 화면의 주 행동은 공급 제안이라 카드 [공급 가능해요]가 주황(primary), 상단 [찾는 상품 등록]은 테두리(secondary). 0건 화면의 [찾는 상품 등록]은 원래 테두리.
export default function BuyListPage() {
  const router = useRouter();
  const [items, setItems] = useState<PublicBuyItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(0);

  const goBack = () => (hasAppHistory() ? router.back() : goHome(router));

  useEffect(() => {
    let cancelled = false;
    setNow(Date.now());
    fetch("/api/buy-requests/public", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d) => {
        if (!cancelled) setItems(Array.isArray(d?.items) ? (d.items as PublicBuyItem[]) : []);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const registerButton = (
    <Link href="/buy/new" className={`${BTN_CLASS} w-full`} style={btnStyle("secondary")} data-buy-register>
      찾는 상품 등록
    </Link>
  );

  return (
    <main className="flex flex-col min-h-screen" style={{ background: "#fff" }}>
      <div
        className="flex-shrink-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={goBack} aria-label="뒤로" style={{ fontSize: rem(19), color: "rgba(255,255,255,0.8)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>←</button>
            <TabLink href="/" className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
              <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto" />
            </TabLink>
          </div>
          <div className="text-xs font-bold tracking-widest" style={{ color: "#FFD166" }}>재고 구매 요청</div>
          <h1 className="font-display text-2xl mt-1.5 text-white">이런 상품 찾습니다</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-3" style={{ paddingBottom: "calc(var(--nav-bottom, 64px) + 24px)" }}>
        <p className="leading-relaxed" style={{ fontSize: rem(15), color: "#4B5563" }} data-buy-guide>
          보유한 재고가 있으면 [공급 가능해요]를 눌러 등록해 주세요. 점핑매니저가 연결해드려요.
        </p>
        {registerButton}

        {items === null && <div className="text-center py-10" style={{ fontSize: rem(15), color: "#6B7480" }}>불러오는 중...</div>}

        {items !== null && items.length === 0 && (
          <div className="rounded-2xl text-center flex flex-col items-center gap-3" style={{ background: "#F5F6F8", padding: "28px 18px" }} data-buy-empty>
            <p className="font-bold" style={{ fontSize: rem(17), color: "#0B2540" }}>
              {failed ? "목록을 불러오지 못했어요" : "지금 찾는 상품이 없어요"}
            </p>
            <Link href="/buy/new" className={`${BTN_CLASS} w-full`} style={btnStyle("secondary")}>
              찾는 상품 등록
            </Link>
          </div>
        )}

        {items?.map((it) => (
          <div key={it.id} className="rounded-2xl bg-white min-w-0" style={{ border: "1.5px solid #E4E7EB", padding: "14px 16px" }} data-buy-card>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold min-w-0" style={{ fontSize: rem(14), color: "#6B7480" }}>
                <span className="flex-shrink-0">{categoryIcons[it.category ?? ""] ?? "🗂️"}</span>
                <span className="truncate">{it.category ?? "카테고리 미지정"}</span>
              </div>
              <span className="flex-shrink-0 whitespace-nowrap" style={{ fontSize: rem(14), color: "#9AA3AD" }}>{daysAgoLabel(it.created_at, now || Date.parse(it.created_at))}</span>
            </div>
            <div className="mt-1.5 font-extrabold break-words" style={{ fontSize: rem(18), color: "#0B2540" }}>{it.name ?? "찾는 상품"}</div>
            <div className="mt-1" style={{ fontSize: rem(15), color: "#4B5563" }}>
              {it.quantity ? `희망 수량 ${it.quantity}` : "수량 협의"} · {it.region ?? "전국"}
            </div>
            <Link href={`/sell?buyRef=${it.id}`} className={`${BTN_CLASS} w-full mt-3`} style={btnStyle("primary")} data-supply-link>
              공급 가능해요
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
