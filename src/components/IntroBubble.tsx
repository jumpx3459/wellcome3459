import { rem } from "@/lib/rem";

// 첫 방문(OnboardingIntro)·재방문(ReturningMemberIntro) 화면 캐릭터 말풍선 (2026-10-06, 10/5 확정 설계)
// 타원 220×84 · 캐릭터 머리 오른쪽 위로 34px 비켜 배치 · 꼬리가 머리를 가리킴 · 말풍선↔캐릭터 14px.
// 표시 여부는 useIntroCompact(bubbleShown)가 정함 — 높이 계산의 BUBBLE_SPACE(84 + 14)와 맞출 것.
const W = 220;
const H = 84;
const GAP = 14;
const SHIFT = 34;
const FILL = "#FFF7ED";
const LINE = "#FDBA74";

export default function IntroBubble({ children }: { children: React.ReactNode }) {
  // 꼬리 끝 = 말풍선 가운데에서 왼쪽으로 SHIFT(= 캐릭터 가운데) 쪽, 길이 = 간격 14px
  const cx = W / 2 - SHIFT;
  return (
    <div className="w-full flex justify-center flex-none" style={{ marginBottom: GAP }} data-intro-bubble>
      <div
        className="relative flex items-center justify-center text-center"
        style={{
          width: W,
          height: H,
          // 좁은 화면에서는 오른쪽으로 덜 비켜서 화면 밖으로 나가지 않게
          left: `min(${SHIFT}px, max(0px, calc((100% - ${W}px) / 2)))`,
          borderRadius: "50%",
          background: FILL,
          border: `2px solid ${LINE}`,
          boxSizing: "border-box",
          color: "#9A3412",
          fontSize: rem(16),
          fontWeight: 800,
          lineHeight: 1.35,
          wordBreak: "keep-all",
        }}
      >
        {children}
        <svg aria-hidden width={W} height={GAP + 4} className="absolute" style={{ left: -2, top: H - 4, overflow: "visible" }}>
          <polygon points={`${cx + 8},0 ${cx + 26},0 ${cx - 2},${GAP + 2}`} fill={FILL} />
          <polyline points={`${cx + 8},1.5 ${cx - 2},${GAP + 2} ${cx + 26},1.5`} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
