import Link from "next/link";
import { rem } from "@/lib/rem";

// "점핑 서비스" 2x2 타일 — 화물배차/계산기/정부지원금/긴급 공지.
// 홈(/page.tsx)과 마이페이지(/mypage/page.tsx) 양쪽에 동일하게 노출되던
// 마크업을 하나로 합침 (2026-09-26, 중복 유지보수 방지). 순수 링크 나열이라
// 상태 없음 — 서버 컴포넌트로도 동작하지만 두 사용처가 전부 "use client"
// 페이지라 특별히 분리 이점은 없음.
// 2026-09-28: 긴급 공지(부동산·설비 처분) 추가 — 재고 매물과 톤이 달라 이 "부가 서비스"
// 타일 자리에 둠. 4개가 돼서 3열 → 2열(2x2).
// 2026-09-29 (가독성 2차): 제목 16px 굵게, 설명 14px #4B5563, 아이콘 34px·박스 60px.
const TILES = [
  { href: "/logistics", icon: "🚚", title: "화물배차", desc: "3분 신청" },
  { href: "/logistics?tab=fx", icon: "🧮", title: "계산기", desc: "환율·관부가세" },
  { href: "/support", icon: "🏛️", title: "정부지원금", desc: "지원사업 찾기" },
  { href: "/notices", icon: "📋", title: "긴급 공지", desc: "부동산·설비 처분" },
];

// 매물 상세 하단 "점핑 서비스" 컴팩트 2칸 (2026-09-29) — 링크는 위 TILES와 같은 경로를 그대로 씀.
// 계산기 설명만 매물 맥락에 맞춰 "운임·관부가세".
const COMPACT_TILES = [
  { ...TILES[0] },
  { ...TILES[1], desc: "운임·관부가세" },
];

// 홈·마이페이지 "점핑 서비스" 섹션으로 가는 앵커 id — "전체 보기" 링크가 씀
export const SERVICES_ANCHOR_ID = "services";

// 해시(#services)로 들어오면 섹션까지 스크롤 — 내용이 비동기로 그려져서 잠깐 기다렸다가 찾음
export function scrollToServicesIfHash() {
  if (typeof window === "undefined" || window.location.hash !== `#${SERVICES_ANCHOR_ID}`) return;
  // 위쪽 카드(알림 설정·구매 요청 등)가 늦게 그려지면 섹션이 밀려나서, 잠시 뒤 두 번 더 맞춤
  let tries = 0;
  const align = () => document.getElementById(SERVICES_ANCHOR_ID)?.scrollIntoView({ block: "start" });
  const tick = () => {
    if (document.getElementById(SERVICES_ANCHOR_ID)) {
      align();
      setTimeout(align, 500);
      setTimeout(align, 1200);
    } else if (tries++ < 20) setTimeout(tick, 100);
  };
  tick();
}

export function ServiceTilesCompact() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {COMPACT_TILES.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="flex flex-col items-center justify-center text-center rounded-2xl bg-white border border-gray200 min-w-0"
          style={{ height: 96, padding: "8px 6px" }}
        >
          <span className="leading-none" style={{ fontSize: rem(32) }} aria-hidden>
            {t.icon}
          </span>
          <span className="mt-1.5 block" style={{ fontSize: rem(16), fontWeight: 700, color: "#1F2937" }}>
            {t.title}
          </span>
          <span className="block" style={{ fontSize: rem(14), fontWeight: 600, color: "#4B5563" }}>
            {t.desc}
          </span>
        </Link>
      ))}
    </div>
  );
}

// 섹션 제목(홈·마이페이지 "점핑 서비스" 등) 공통 스타일
export const SECTION_TITLE_STYLE = { fontSize: rem(18), fontWeight: 800, color: "#1F2937" } as const;

export default function EcosystemGrid() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TILES.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="flex flex-col items-center text-center rounded-2xl bg-white border border-gray200 min-w-0"
          style={{ padding: "18px 8px 16px" }}
        >
          <div
            className="rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ width: 60, height: 60, background: "rgba(27,58,92,0.08)" }}
          >
            <span className="leading-none" style={{ fontSize: rem(34) }} aria-hidden>
              {t.icon}
            </span>
          </div>
          <div className="mt-2.5" style={{ fontSize: rem(16), fontWeight: 800, color: "#1F2937" }}>
            {t.title}
          </div>
          <div className="mt-0.5" style={{ fontSize: rem(14), fontWeight: 600, color: "#4B5563" }}>
            {t.desc}
          </div>
        </Link>
      ))}
    </div>
  );
}
