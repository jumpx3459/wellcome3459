import TabLink from "@/components/TabLink";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import { rem } from "@/lib/rem";

// MY·/share 남색 머리 윗줄 (2026-10-12 feat/my-menu-share: MY에 있던 마크업을 공용으로) —
// 로고=홈 링크 + Powered by JumpX 배지 / 소제목 라벨 + 로테이션 태그 행. buy/sell/deals 헤더와 같은 구조.
export default function MyHeadTop({ caption }: { caption: string }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <TabLink href="/" className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
          <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto" />
        </TabLink>
        <span
          className="rounded-full font-medium"
          style={{ fontSize: rem(11), color: "rgba(255,255,255,0.6)", padding: "3px 9px", background: "rgba(255,255,255,0.08)" }}
        >
          Powered by JumpX
        </span>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-y-1.5 mb-2.5">
        <div className="text-xs font-bold tracking-widest whitespace-nowrap" style={{ color: "#FFD166" }}>
          {caption}
        </div>
        <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
      </div>
    </>
  );
}
