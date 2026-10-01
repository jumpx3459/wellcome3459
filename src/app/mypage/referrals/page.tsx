"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasAppHistory, navReplace } from "@/lib/appNav";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatMemberNo } from "@/lib/format";
import { rem } from "@/lib/rem";
import { authFetch } from "@/lib/authFetch";
import { SITE_URL } from "@/lib/siteUrl";
import { MAX_PHOTO_SLOTS } from "@/lib/photoLimit";
import { UI_CARD_TITLE, UI_DESC, UI_META } from "@/lib/uiText";
import ReferralShareButtons from "@/components/ReferralShareButtons";

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
  const [items, setItems] = useState<ReferralItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // 2026-09-29: 헤더에 보여줄 내 정보 (본인 행만 읽힘 — RLS)
  const [me, setMe] = useState<{ displayName: string; refCode: string | null; official: boolean } | null>(null);

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
      const { data: m } = await supabase!
        .from("members")
        .select("company_name, name, ref_code, is_official_partner")
        .eq("id", userData.user.id)
        .maybeSingle();
      setMe({ displayName: m?.company_name || m?.name || "내 추천 현황", refCode: m?.ref_code ?? null, official: !!m?.is_official_partner });
      // 토큰은 authFetch가 호출할 때마다 최신으로 받음 (저장해 둔 토큰 재사용 금지 — 만료 401 버그)
      const res = await authFetch("/api/my-referrals");
      if (!res.ok) {
        setLoading(false);
        return;
      }
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
    setSavingId(memberId);
    setErrorId((cur) => (cur === memberId ? null : cur));
    try {
      const res = await authFetch("/api/my-referrals", { method: "PATCH", json: { memberId, note: notes[memberId] ?? "" } });
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
    return <main className="flex flex-col min-h-screen items-center justify-center text-gray500" style={UI_DESC}>불러오는 중...</main>;
  }

  const refUrl = me?.refCode ? `${SITE_URL}/signup?ref=${me.refCode}` : "";
  const shareText = `점프엑스 덤핑점핑 - 재고 특가 알림 받아보세요! ${refUrl}`;
  const stats = [
    { label: "총 추천", value: items.length },
    { label: "이번달 신규", value: thisMonthCount },
    { label: "사업자", value: businessCount },
  ];

  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* 2026-09-29: 앱 공통 남색 헤더 — 내 이름·공식 파트너 배지·추천 코드 + 숫자 카드(0이면 흐리게) */}
      <div
        className="px-5 pt-4 pb-5 text-white"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        <div className="flex items-center gap-2">
          {/* 2026-10-01 PR-C: ←는 앞으로 쌓지 않고 진짜 뒤로(앱 안에서 왔으면), 아니면 MY 추천 칸으로 replace */}
          <Link
            href="/mypage#referral"
            aria-label="뒤로 가기"
            onClick={(e) => {
              e.preventDefault();
              if (hasAppHistory()) router.back();
              else navReplace(router, "/mypage#referral");
            }}
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, fontSize: rem(20), color: "rgba(255,255,255,.85)", marginLeft: -8 }}
          >
            ←
          </Link>
          <span className="font-bold tracking-widest" style={{ fontSize: rem(14), color: "#FFD166" }}>내 추천 회원</span>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="truncate" style={{ fontSize: rem(20), fontWeight: 800, maxWidth: "100%" }}>{me?.displayName ?? "내 추천 현황"}</span>
          {me?.official && (
            <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: rem(14), padding: "3px 10px", background: "rgba(255,209,102,.2)", color: "#FFD166" }}>
              🏅 공식 점핑파트너
            </span>
          )}
        </div>
        {me?.refCode && (
          <div className="mt-1" style={{ fontSize: rem(14), color: "rgba(255,255,255,.75)" }}>
            내 추천 코드 <b className="font-mono" style={{ color: "#fff", letterSpacing: "0.04em" }}>{me.refCode}</b>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {stats.map((st) => (
            <div key={st.label} className="rounded-xl text-center" style={{ background: "rgba(255,255,255,.1)", padding: "12px 6px", opacity: st.value === 0 ? 0.5 : 1 }}>
              <div style={{ fontSize: rem(24), fontWeight: 800, fontVariantNumeric: "tabular-nums", color: st.value === 0 ? "rgba(255,255,255,.7)" : "var(--color-brandOrangeAccent)" }}>{st.value}</div>
              <div className="mt-0.5 font-bold" style={{ fontSize: rem(14), color: "rgba(255,255,255,.8)" }}>{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col gap-4">
        {items.length === 0 ? (
          // 2026-09-29: 0명 빈 화면 — 실제 적용되는 혜택(사진 슬롯)만 안내
          <div className="flex flex-col items-center text-center">
            <img src="/images/manager-cut.png" alt="점핑매니저" style={{ width: 120, height: 120, objectFit: "contain", filter: "drop-shadow(0 6px 10px rgba(11,37,64,.2))" }} />
            <p className="mt-2" style={UI_CARD_TITLE}>첫 추천 회원을 만들어 보세요</p>
            <p className="mt-1.5 font-bold" style={{ ...UI_DESC, color: "#966B00" }}>
              🎁 추천 1명당 나도 친구도 사진 슬롯 +2장 (최대 {MAX_PHOTO_SLOTS}장)
            </p>
            <ol className="mt-4 w-full flex flex-col gap-2 text-left">
              {["링크 보내기", "친구가 가입", "여기에 자동 표시"].map((t, n) => (
                <li key={t} className="flex items-center gap-3 rounded-xl" style={{ background: "#F5F6F8", padding: "12px 14px" }}>
                  <span className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0" style={{ width: 28, height: 28, background: "#0B2540", fontSize: rem(14) }}>{n + 1}</span>
                  <span style={{ ...UI_DESC, color: "#1F2937" }}>{t}</span>
                </li>
              ))}
            </ol>
            {refUrl && (
              <div className="mt-4 w-full">
                <ReferralShareButtons refUrl={refUrl} shareText={shareText} />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 검색·필터는 1명 이상일 때만 */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="번호/상호명 검색"
              className="border-2 border-gray200 rounded-xl px-3.5 outline-none focus:border-orange"
              style={{ height: 48, fontSize: rem(16) }}
            />
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mt-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="flex-shrink-0 font-bold rounded-full px-3.5 py-2"
                  style={{ fontSize: rem(14), ...(filter === f.key ? { background: "#0B2540", color: "#fff" } : { background: "#F5F6F8", color: "#6B7480" }) }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="text-center py-8" style={UI_DESC}>검색/필터 결과가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map((r) => (
                  <div key={r.id} className="border border-gray200 rounded-2xl px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate" style={UI_CARD_TITLE}>
                          {r.member_no != null ? formatMemberNo(r.member_no) : "회원번호 없음"}
                          {r.company_name && <span className="font-medium ml-1.5" style={UI_META}>{r.company_name}</span>}
                        </div>
                        <div className="mt-0.5" style={{ ...UI_META, fontVariantNumeric: "tabular-nums" }}>
                          {r.phone} · {new Date(r.created_at).toLocaleDateString("ko-KR")} 가입
                          {r.is_business && " · 사업자"}
                        </div>
                      </div>
                      {r.business_verified && (
                        <span className="flex-shrink-0 font-bold px-2.5 py-1 rounded-full" style={{ fontSize: rem(14), background: "#E8F8EC", color: "#1D8A44" }}>
                          인증됨
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-start gap-2">
                      <textarea
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        onBlur={() => saveNote(r.id)}
                        placeholder="컨택 메모 (예: 9/27 통화)"
                        rows={1}
                        className="flex-1 min-w-0 rounded-lg outline-none resize-none"
                        style={{ border: "1.5px solid #E4E7EB", padding: "9px 11px", fontSize: rem(15) }}
                      />
                      <span className="flex-shrink-0 font-bold" style={{ width: 56, fontSize: rem(14), color: errorId === r.id ? "#E25100" : "#1D8A44", paddingTop: 10 }}>
                        {savingId === r.id ? "..." : errorId === r.id ? "저장 실패" : savedId === r.id ? "저장됨" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
