"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatMemberNo } from "@/lib/format";

type ReferralItem = {
  id: string;
  member_no: number | null;
  is_business: boolean;
  created_at: string;
  phone: string;
  company_name: string | null;
  business_verified: boolean;
  referral_note: string | null;
};

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "business", label: "사업자" },
  { key: "thisMonth", label: "이번달 신규" },
] as const;

// 2026-09-27: 점핑파트너 "내 추천 회원" 대시보드 — 표시 전용(내가 추천한 회원 목록·
// 상태·누적 수)에 컨택 메모(연락 여부 등 자유 텍스트) 기능만 추가한 버전입니다.
// 의도적으로 제외한 것: 승인/거절 권한, 회원 상세 개인정보(전화번호 외), 정산·포인트·
// 지분 관련 로직 — 이런 항목은 덤핑점핑(리드엔진) 범위를 벗어나 점프엑스 쪽에서
// 별도 설계하기로 했습니다.
export default function PartnerReferralsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<ReferralItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: userData } = await supabase!.auth.getUser();
      if (!userData.user) {
        router.replace("/login?returnTo=/mypage/referrals");
        return;
      }
      const { data: sessionData } = await supabase!.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      setAccessToken(token);
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch("/api/my-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      const rows: ReferralItem[] = data.items ?? [];
      setItems(rows);
      setNotes(Object.fromEntries(rows.map((r) => [r.id, r.referral_note ?? ""])));
      setLoading(false);
    })();
  }, [router]);

  const now = new Date();
  const thisMonthCount = items.filter((r) => {
    const d = new Date(r.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const businessCount = items.filter((r) => r.is_business).length;

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (filter === "business" && !r.is_business) return false;
      if (filter === "thisMonth") {
        const d = new Date(r.created_at);
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      }
      const q = search.trim();
      if (q && !(r.phone.includes(q) || (r.company_name ?? "").includes(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, search]);

  async function saveNote(memberId: string) {
    if (!accessToken) return;
    setSavingId(memberId);
    setErrorId((cur) => (cur === memberId ? null : cur));
    try {
      const res = await fetch("/api/my-referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, memberId, note: notes[memberId] ?? "" }),
      });
      if (res.ok) {
        setSavedId(memberId);
        setTimeout(() => setSavedId((cur) => (cur === memberId ? null : cur)), 1800);
      } else {
        setErrorId(memberId);
      }
    } catch {
      setErrorId(memberId);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <main className="flex flex-col min-h-screen items-center justify-center text-sm text-gray500">불러오는 중...</main>;
  }

  return (
    <main className="flex flex-col min-h-screen bg-white">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4.5" style={{ borderBottom: "1px solid #EEF0F2" }}>
        <Link href="/mypage#referral" className="text-gray500" style={{ fontSize: 19 }}>←</Link>
        <span className="font-display text-2xl whitespace-nowrap" style={{ color: "#0B2540" }}>
          내 추천 회원
        </span>
      </div>

      <div className="px-5 py-4.5 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "총 추천", value: items.length },
            { label: "이번달 신규", value: thisMonthCount },
            { label: "사업자", value: businessCount },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray200 rounded-xl px-1 py-2.5 text-center">
              <div className="font-black text-navy" style={{ fontSize: 18 }}>{s.value}</div>
              <div className="mt-0.5 font-bold text-gray500 leading-tight" style={{ fontSize: 12 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="번호/상호명 검색"
          className="border-2 border-gray200 rounded-xl px-3 text-sm outline-none focus:border-orange"
          style={{ height: 40 }}
        />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mt-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-shrink-0 text-xs font-bold rounded-full px-3 py-1.5"
              style={filter === f.key ? { background: "#0B2540", color: "#fff" } : { background: "#F5F6F8", color: "#6B7480" }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray500 text-center py-8">
            {items.length === 0 ? "아직 추천으로 가입한 회원이 없어요." : "검색/필터 결과가 없어요."}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((r) => (
              <div key={r.id} className="border border-gray200 rounded-2xl px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-gray900 truncate">
                      {r.member_no != null ? formatMemberNo(r.member_no) : "회원번호 없음"}
                      {r.company_name && <span className="text-sm font-medium text-gray500 ml-1.5">{r.company_name}</span>}
                    </div>
                    <div className="text-sm text-gray500 mt-0.5">
                      {r.phone} · {new Date(r.created_at).toLocaleDateString("ko-KR")} 가입
                      {r.is_business && " · 사업자"}
                    </div>
                  </div>
                  {r.business_verified && (
                    <span
                      className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full"
                      style={{ background: "#E8F8EC", color: "#1D8A44" }}
                    >
                      인증됨
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex items-start gap-2">
                  <textarea
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    onBlur={() => saveNote(r.id)}
                    placeholder="컨택 메모 (예: 9/27 통화, 다음주 재연락)"
                    rows={1}
                    className="flex-1 min-w-0 rounded-lg outline-none resize-none"
                    style={{ border: "1.5px solid #E4E7EB", padding: "7px 10px", fontSize: 12.5 }}
                  />
                  <span
                    className="flex-shrink-0 text-xs font-bold"
                    style={{ width: 44, color: errorId === r.id ? "#E25100" : "#1D8A44", paddingTop: 8 }}
                  >
                    {savingId === r.id ? "..." : errorId === r.id ? "저장 실패" : savedId === r.id ? "저장됨" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
