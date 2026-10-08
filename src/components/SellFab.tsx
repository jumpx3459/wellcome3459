import Link from "next/link";
import { rem } from "@/lib/rem";

// 떠 있는 "＋ 매물 등록" 버튼 (2026-10-09 4b-2) — 회원 홈(AlertInboxHome)·/deals에서만 그림(다른 화면엔 넣지 않음).
// 앱 틀(max-w-md 448px) 오른쪽 14px · 하단 탭 위 14px(--nav-bottom이 safe-area 포함). 하단 탭(z-40)보다 위.
// 쓰는 화면은 목록 맨 아래에 90px 여백을 둬서 마지막 카드가 이 버튼에 가리지 않게 할 것. 링크는 주황 배너 [무료 등록]과 같은 /sell
export const SELL_FAB_HREF = "/sell";

export default function SellFab() {
  return (
    <Link
      href={SELL_FAB_HREF}
      className="fixed z-[45] inline-flex items-center justify-center rounded-full text-white whitespace-nowrap"
      style={{
        right: "max(14px, calc((100vw - 448px) / 2 + 14px))",
        bottom: "calc(var(--nav-bottom) + 14px)",
        height: 48,
        padding: "0 18px",
        background: "#f97316",
        fontSize: rem(17),
        fontWeight: 800,
        boxShadow: "0 6px 16px rgba(249,115,22,.45)",
      }}
      data-sell-fab
    >
      ＋ 매물 등록
    </Link>
  );
}
