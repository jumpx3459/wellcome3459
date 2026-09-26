import Link from "next/link";

// 점프엑스 생태계 서비스 3열 타일 — 화물배차/계산기/정부지원금.
// 홈(/page.tsx)과 마이페이지(/mypage/page.tsx) 양쪽에 동일하게 노출되던
// 마크업을 하나로 합침 (2026-09-26, 중복 유지보수 방지). 순수 링크 나열이라
// 상태 없음 — 서버 컴포넌트로도 동작하지만 두 사용처가 전부 "use client"
// 페이지라 특별히 분리 이점은 없음.
export default function EcosystemGrid() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Link
        href="/logistics"
        className="flex flex-col items-center text-center rounded-2xl bg-white border border-gray200"
        style={{ padding: "16px 8px" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(27,58,92,0.08)" }}
        >
          <span className="text-2xl leading-none">🚚</span>
        </div>
        <div className="text-xs font-black text-navy mt-2">화물배차</div>
        <div className="text-[10px] font-bold mt-0.5" style={{ color: "#1B3A5C" }}>
          3분 신청
        </div>
      </Link>

      <Link
        href="/logistics?tab=fx"
        className="flex flex-col items-center text-center rounded-2xl bg-white border border-gray200"
        style={{ padding: "16px 8px" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(27,58,92,0.08)" }}
        >
          <span className="text-2xl leading-none">🧮</span>
        </div>
        <div className="text-xs font-black text-navy mt-2">계산기</div>
        <div className="text-[10px] font-bold mt-0.5" style={{ color: "#1B3A5C" }}>
          환율·관부가세
        </div>
      </Link>

      <Link
        href="/support"
        className="flex flex-col items-center text-center rounded-2xl bg-white border border-gray200"
        style={{ padding: "16px 8px" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(27,58,92,0.08)" }}
        >
          <span className="text-2xl leading-none">🏛️</span>
        </div>
        <div className="text-xs font-black text-navy mt-2">정부지원금</div>
        <div className="text-[10px] font-bold mt-0.5" style={{ color: "#1B3A5C" }}>
          지원사업 찾기
        </div>
      </Link>
    </div>
  );
}
