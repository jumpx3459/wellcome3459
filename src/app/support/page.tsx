"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { mockRegions } from "@/lib/mockData";
import type { SupportProgram } from "@/lib/support";

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageInner />
    </Suspense>
  );
}

function SupportPageInner() {
  const [programs, setPrograms] = useState<SupportProgram[]>([]);
  const [region, setRegion] = useState<string>("전국");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "mock" | null>(null);

  useEffect(() => {
    setLoading(true);
    const query = region === "전국" ? "" : region;
    fetch(`/api/support?hashtags=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        setPrograms(data.items ?? []);
        setSource(data.source ?? null);
      })
      .finally(() => setLoading(false));
  }, [region]);

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-5 pb-3 text-white"
        style={{ background: "linear-gradient(120deg, #0B2540, #0EA5E9)" }}
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Link href="/" className="bg-white rounded-lg px-3 py-2 inline-block">
              <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
            </Link>
            <span className="text-white/70 text-xs tracking-wide">Powered by JumpX</span>
          </div>
          <Link href="/deals" className="text-xs text-white/85 font-bold whitespace-nowrap">
            매물 보기 →
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <h1 className="font-display text-[22px] leading-tight">정부지원금 정보</h1>
          <span
            className="text-[10px] font-bold tracking-wide rounded-full px-2 py-0.5 whitespace-nowrap"
            style={{ background: "rgba(255,209,102,0.18)", color: "#FFD166" }}
          >
            사업자 전용
          </span>
        </div>

        <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
          {["전국", ...mockRegions].map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap ${
                region === r ? "bg-white text-navy" : "bg-white/15 text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-gray100 px-4 py-3.5 flex flex-col gap-3">
        {source === "mock" && (
          <div className="text-sm text-gray500 bg-white border border-gray200 rounded-xl px-4 py-3">
            지금은 데모 데이터예요. 실제 공고를 받으려면 기업마당 API 키를 연결하세요 (README 참고).
          </div>
        )}

        {loading && <div className="text-center text-gray500 text-base py-10">불러오는 중...</div>}

        {!loading && programs.length === 0 && (
          <div className="text-center text-gray500 text-base py-10">
            해당 지역에 등록된 공고가 아직 없어요.
          </div>
        )}

        {programs.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-gray200 rounded-2xl px-4 py-4 block"
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#FFF1E8", color: "#B94A1D" }}
              >
                {p.category}
              </span>
              <span className="text-sm text-gray500">{p.org}</span>
            </div>
            <div className="text-base font-bold text-gray900 mt-2 leading-snug">{p.title}</div>
            <div className="text-sm text-gray500 mt-1.5 line-clamp-2">{p.summary}</div>
            <div className="text-sm text-gray500 mt-2.5 flex items-center gap-1.5">
              <span>📅</span>
              {p.period || "상시"}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
