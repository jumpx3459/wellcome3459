"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockCategories, mockRegions, categoryIcons } from "@/lib/mockData";
import { formatPrice, formatMemberNo } from "@/lib/format";
import { generateRefCode } from "@/lib/refCode";
import Toast, { useToast } from "@/components/Toast";
import BusinessLicenseUploader from "@/components/BusinessLicenseUploader";

type InterestItem = {
  id: string;
  deals: {
    id: string;
    title: string;
    deal_price: number;
    status: string;
  } | null;
};

type ReferralItem = {
  member_no: number | null;
  is_business: boolean;
  created_at: string;
  phone: string;
  company_name: string | null;
  business_verified: boolean;
};

type PartnerStatus = "none" | "pending" | "approved" | "rejected";

type AdminInfo = { name: string; role: string };

export default function MyPage() {
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [memberNo, setMemberNo] = useState<number | null>(null);
  const [refCode, setRefCode] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [shareDeal, setShareDeal] = useState<{ id: string; title: string; deal_price: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [businessVerified, setBusinessVerified] = useState(false);
  const [hasBusinessLicense, setHasBusinessLicense] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [isOfficialPartner, setIsOfficialPartner] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>("none");
  const [partnerForm, setPartnerForm] = useState({ businessType: "", channelInfo: "", message: "" });
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);
  const [partnerError, setPartnerError] = useState("");
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const { message: toastMessage, showToast } = useToast();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setNotLoggedIn(true);
        setLoading(false);
        return;
      }
      const userId = userData.user.id;
      setMemberId(userId);

      const { data: member } = await supabase
        .from("members")
        .select("phone, ref_code, member_no, company_name, name, email, business_verified, business_license_path")
        .eq("id", userId)
        .single();
      if (member) {
        setPhone(member.phone);
        setMemberNo(member.member_no);
        setCompanyName(member.company_name ?? "");
        setFullName(member.name ?? "");
        setEmail(member.email ?? "");
        setBusinessVerified(Boolean(member.business_verified));
        setHasBusinessLicense(Boolean(member.business_license_path));
      }

      if (member?.ref_code) {
        setRefCode(member.ref_code);
      } else {
        // 이 기능이 생기기 전에 가입한 회원 — 지금 처음 코드를 발급해줌
        const newCode = generateRefCode();
        const { error: codeError } = await supabase
          .from("members")
          .update({ ref_code: newCode })
          .eq("id", userId);
        if (!codeError) setRefCode(newCode);
      }

      const { data: catRows } = await supabase
        .from("member_categories")
        .select("categories(name)")
        .eq("member_id", userId);
      setCategories(
        (catRows ?? [])
          .map((r) => (r.categories as unknown as { name: string } | null)?.name)
          .filter((name): name is string => Boolean(name))
      );

      const { data: regRows } = await supabase
        .from("member_regions")
        .select("regions(name)")
        .eq("member_id", userId);
      setRegions(
        (regRows ?? [])
          .map((r) => (r.regions as unknown as { name: string } | null)?.name)
          .filter((name): name is string => Boolean(name))
      );

      const { data: interestRows } = await supabase
        .from("interests")
        .select("id, deals(id, title, deal_price, status)")
        .eq("member_id", userId)
        .order("created_at", { ascending: false });
      setInterests((interestRows as unknown as InterestItem[]) ?? []);

      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData.session?.access_token ?? null;
      setAccessToken(sessionToken);
      if (sessionToken) {
        fetch("/api/my-referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: sessionToken }),
        })
          .then((res) => res.json())
          .then((data) => setReferrals(data.items ?? []))
          .catch(() => {});

        fetch("/api/is-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: sessionToken }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.isAdmin) setAdminInfo({ name: data.name, role: data.role });
          })
          .catch(() => {});
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (window.location.hash === "#referral") {
      requestAnimationFrame(() => {
        document.getElementById("referral")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [loading]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    // 공유 시 앱 홍보 문구 대신 실제 특가를 보여주는 게 더 잘 클릭됨
    supabase
      .from("deals")
      .select("id, title, deal_price")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setShareDeal(data));
  }, []);

  useEffect(() => {
    if (!memberId || !supabase) return;
    (async () => {
      const { data: member } = await supabase
        .from("members")
        .select("is_official_partner")
        .eq("id", memberId)
        .maybeSingle();
      if (member?.is_official_partner) {
        setIsOfficialPartner(true);
        return;
      }
      const { data: req } = await supabase
        .from("partner_requests")
        .select("status")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (req?.status) setPartnerStatus(req.status as PartnerStatus);
    })();
  }, [memberId]);

  async function submitPartnerRequest() {
    if (!memberId || !supabase) return;
    if (!partnerForm.businessType.trim() || !partnerForm.channelInfo.trim()) {
      setPartnerError("업종/채널 정보를 입력해주세요.");
      return;
    }
    setPartnerSubmitting(true);
    setPartnerError("");
    const { error } = await supabase.from("partner_requests").insert({
      member_id: memberId,
      business_type: partnerForm.businessType.trim(),
      channel_info: partnerForm.channelInfo.trim(),
      message: partnerForm.message.trim() || null,
    });
    setPartnerSubmitting(false);
    if (error) {
      setPartnerError("신청 중 오류가 발생했어요. 다시 시도해주세요.");
      return;
    }
    setPartnerStatus("pending");
  }

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const refUrl =
    typeof window !== "undefined" && refCode
      ? shareDeal
        ? `${window.location.origin}/deals/${shareDeal.id}?ref=${refCode}`
        : `${window.location.origin}/signup?ref=${refCode}`
      : "";

  const handleShareRefLink = async () => {
    if (typeof window === "undefined" || !refCode) return;
    const url = refUrl;
    const text = shareDeal
      ? `[덤핑점핑] ${shareDeal.title} ${formatPrice(shareDeal.deal_price)} 특가! 이런 재고특가 알림 매일 받아보세요 → ${url}`
      : `점프엑스 덤핑점핑 - 재고 특가 알림 받아보세요! ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "덤핑점핑", text });
      } catch {
        // 사용자가 공유를 취소한 경우 — 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // 클립보드 접근 실패 — 무시
    }
  };

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setSaveError("로그인이 만료됐어요. 다시 로그인해주세요.");
        return;
      }
      const userId = userData.user.id;

      const { error: delCatError } = await supabase.from("member_categories").delete().eq("member_id", userId);
      if (delCatError) throw delCatError;
      const { error: delRegError } = await supabase.from("member_regions").delete().eq("member_id", userId);
      if (delRegError) throw delRegError;

      const { data: catRows } = await supabase.from("categories").select("id, name").in("name", categories);
      const { data: regRows } = await supabase.from("regions").select("id, name").in("name", regions);

      if (catRows?.length) {
        const { error: insCatError } = await supabase
          .from("member_categories")
          .insert(catRows.map((c) => ({ member_id: userId, category_id: c.id })));
        if (insCatError) throw insCatError;
      }
      if (regRows?.length) {
        const { error: insRegError } = await supabase
          .from("member_regions")
          .insert(regRows.map((r) => ({ member_id: userId, region_id: r.id })));
        if (insRegError) throw insRegError;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("저장 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!supabase) return;
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const userId = userData.user.id;

      await supabase
        .from("members")
        .update({
          company_name: companyName || null,
          name: fullName || null,
          email: email || null,
        })
        .eq("id", userId);
      setProfileSaved(true);
      setEditingProfile(false);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setProfileSaving(false);
    }
  };

  const profileComplete = companyName.trim().length > 0;

  if (!isSupabaseConfigured) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">🧪</div>
        <h1 className="font-display text-xl text-navy mb-2">데모 모드예요</h1>
        <p className="text-gray500 text-base leading-relaxed">
          Supabase가 연결되면 여기서
          <br />
          관심 매물과 알림 설정을 관리할 수 있어요.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen text-gray500 text-sm">
        불러오는 중...
      </main>
    );
  }

  if (notLoggedIn) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="font-display text-xl text-navy mb-2">로그인이 필요해요</h1>
        <p className="text-gray500 text-base leading-relaxed mb-6">
          내 정보를 보려면 먼저 가입해주세요.
        </p>
        <Link
          href="/signup"
          className="text-white text-center font-bold rounded-2xl text-base px-8"
          style={{ background: "linear-gradient(135deg, #D9531E, #F2891F)", padding: "14px 32px" }}
        >
          알림 받기 시작
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-6 pb-6 text-white"
        style={{ background: "linear-gradient(135deg, #0B2540, #1B3A5C)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Link href="/" className="bg-white rounded-lg px-3.5 py-2.5 inline-block">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
          </Link>
          <span className="text-white/70 text-sm tracking-wide">Powered by JumpX</span>
        </div>
        <div className="text-xs font-bold tracking-widest" style={{ color: "#FFD166" }}>
          내 정보
        </div>
        <div className="text-xs text-white/60 mt-2.5">나의 연락처</div>
        <h1 className="font-display text-2xl mt-0.5">{phone || "회원님"}</h1>
        {companyName && (
          <div className="text-sm text-white/85 mt-1 flex items-center gap-1.5">
            {companyName}
            {fullName && ` · ${fullName}`}
            {(businessVerified || hasBusinessLicense) && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={
                  businessVerified
                    ? { background: "rgba(94,194,106,0.2)", color: "#5EC26A" }
                    : { background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }
                }
              >
                {businessVerified ? "인증 완료" : "인증 대기중"}
              </span>
            )}
          </div>
        )}
        {memberNo != null && (
          <>
            <div className="text-xs text-white/60 mt-2">회원번호</div>
            <div className="text-sm text-white/85 font-mono">{formatMemberNo(memberNo)}</div>
          </>
        )}
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-6">
        {adminInfo && (
          <Link
            href="/admin"
            className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-white"
            style={{ background: "#0B2540" }}
          >
            <span className="text-sm font-bold">
              🛡️ {adminInfo.name} · {adminInfo.role}
            </span>
            <span className="text-xs font-bold text-white/70">관리자 화면 →</span>
          </Link>
        )}
        <div>
          <label className="mb-2 flex items-center justify-between">
            <span className="text-base font-bold text-navy">관심 카테고리</span>
            <button
              type="button"
              onClick={() =>
                setCategories(categories.length === mockCategories.length ? [] : [...mockCategories])
              }
              className="text-xs font-bold text-orange"
            >
              {categories.length === mockCategories.length ? "전체 해제" : "전체 선택"}
            </button>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {mockCategories.map((c) => {
              const picked = categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggle(categories, setCategories, c)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border py-3.5 px-1 text-center"
                  style={
                    picked
                      ? { background: "#F2891F", borderColor: "#F2891F", color: "#fff" }
                      : { background: "#F5F6F8", borderColor: "#F5F6F8", color: "#1B3A5C" }
                  }
                >
                  <span className="text-2xl leading-none">{categoryIcons[c]}</span>
                  <span className="text-sm font-bold leading-tight">{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-navy">관심 지역</span>
            <button
              type="button"
              onClick={() =>
                setRegions(regions.length === mockRegions.length ? [] : [...mockRegions])
              }
              className="text-xs font-bold text-orange"
            >
              {regions.length === mockRegions.length ? "전체 해제" : "전체 선택"}
            </button>
          </label>
          <p className="text-xs text-gray500 -mt-1 mb-2">
            선택 안 하면 전국 매물 알림을 다 받아요
          </p>
          <div className="grid grid-cols-4 gap-2">
            {mockRegions.map((r) => (
              <button
                key={r}
                onClick={() => toggle(regions, setRegions, r)}
                className={`text-sm py-2.5 rounded-full border-2 font-bold text-center ${
                  regions.includes(r) ? "bg-navy text-white border-navy" : "border-gray200 text-gray500"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="text-white font-bold rounded-2xl text-base disabled:opacity-60"
          style={{ background: "#0B2540", padding: "14px 0" }}
        >
          {saving ? "저장 중..." : saved ? "✓ 저장됐어요" : "설정 저장"}
        </button>
        {saveError && <div className="text-sm text-orange font-medium">{saveError}</div>}

        <div className="border-t border-gray200 pt-5 flex flex-col gap-4">
          {profileComplete && !editingProfile ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-navy">내 정보</div>
                <button type="button" onClick={() => setEditingProfile(true)} className="text-xs font-bold text-orange">
                  정보 수정
                </button>
              </div>
              <div className="bg-gray100 rounded-xl px-4 py-3 flex flex-col gap-1">
                <div className="text-sm font-bold text-navy">
                  {companyName}
                  {fullName && ` · ${fullName}`}
                </div>
                {email && <div className="text-xs text-gray500">{email}</div>}
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full self-start mt-1"
                  style={
                    businessVerified
                      ? { background: "rgba(94,194,106,0.15)", color: "#3C9A49" }
                      : { background: "#EEF0F3", color: "#6B7480" }
                  }
                >
                  {businessVerified ? "사업자 인증 완료" : hasBusinessLicense ? "사업자 인증 대기중" : "사업자 미인증"}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="text-sm font-bold text-navy mb-1">프로필 완성하기</div>
                <p className="text-xs text-gray500 leading-relaxed">
                  채워주시면 점핑매니저가 더 정확하게 도와드려요. 전부 선택 입력이라 지금 안 채워도 괜찮아요.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
                  상호명
                  <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">선택</span>
                </label>
                <input
                  className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                  style={{ height: "52px" }}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 웰컴코리아(주)"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
                  성명
                  <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">선택</span>
                </label>
                <input
                  className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                  style={{ height: "52px" }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="담당자 성함"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
                  이메일
                  <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">선택</span>
                </label>
                <input
                  type="email"
                  className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                  style={{ height: "52px" }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com"
                />
              </div>

              <BusinessLicenseUploader
                accessToken={accessToken}
                status={businessVerified ? "verified" : hasBusinessLicense ? "pending" : "none"}
                onUploaded={() => {
                  setHasBusinessLicense(true);
                  setBusinessVerified(false);
                  showToast("업로드됐어요. 확인 후 인증 완료로 전환돼요.");
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="flex-1 font-bold rounded-2xl text-base disabled:opacity-60 border-2 border-gray200 text-navy"
                  style={{ padding: "14px 0" }}
                >
                  {profileSaving ? "저장 중..." : profileSaved ? "✓ 저장됐어요" : "프로필 저장"}
                </button>
                {profileComplete && (
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="font-bold rounded-2xl text-base border-2 border-gray200 text-gray500"
                    style={{ padding: "14px 20px" }}
                  >
                    취소
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray200 pt-5">
          <div className="text-sm font-bold text-navy mb-3">
            관심 표시한 매물 ({interests.length})
          </div>
          {interests.length === 0 && (
            <div className="text-center text-gray500 text-sm py-6">
              아직 관심 표시한 매물이 없어요.
            </div>
          )}
          <div className="flex flex-col gap-2">
            {interests.map((i) =>
              i.deals ? (
                <Link
                  key={i.id}
                  href={`/deals/${i.deals.id}`}
                  className="bg-white border border-gray200 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-bold text-gray900">{i.deals.title}</div>
                    <div className="text-sm text-navy font-bold mt-0.5">
                      {formatPrice(i.deals.deal_price)}
                    </div>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={
                      i.deals.status === "active"
                        ? { background: "#E8F8EC", color: "#1D8A44" }
                        : { background: "#F5F6F8", color: "#6B7480" }
                    }
                  >
                    {i.deals.status === "active" ? "진행중" : "마감"}
                  </span>
                </Link>
              ) : null
            )}
          </div>
        </div>

        <div id="referral" className="border-t border-gray200 pt-5">
          <div className="text-sm font-bold text-navy mb-1 flex items-center gap-1.5">
            🤝 점핑파트너
            <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
              {referrals.length}명 추천함
            </span>
          </div>
          <p className="text-xs text-gray500 mb-3 leading-relaxed">
            아래 링크로 가입하면 내가 추천한 회원으로 따로 관리돼요.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 border-2 border-gray200 rounded-xl px-3.5 flex items-center text-sm text-gray500 truncate" style={{ height: "48px" }}>
              {refUrl}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(refUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-white font-bold rounded-xl px-4 text-sm whitespace-nowrap flex-shrink-0"
              style={{ background: "#0B2540" }}
            >
              {copied ? "복사됨 ✓" : "복사"}
            </button>
            <button
              onClick={handleShareRefLink}
              aria-label="추천 링크 공유"
              className="font-bold rounded-xl px-4 text-sm whitespace-nowrap flex-shrink-0 border-2 border-gray200 text-navy"
            >
              {shared ? "공유됨 ✓" : "공유 ↗"}
            </button>
          </div>

          {typeof window !== "undefined" && refCode && (
            <div className="flex flex-col items-center mt-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(refUrl)}`}
                alt="추천 링크 QR 코드"
                className="w-32 h-32 rounded-xl border border-gray200"
              />
              <p className="text-xs text-gray500 mt-2">거래처 방문 시 QR로 바로 보여주세요</p>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-bold text-amber-900">🏅 공식 점핑파트너</h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              이미 덤핑·재고 유통업, 도매업, 밴드/카톡채널/블로그 등 SNS 운영자, 대기업 대리점,
              제조·수입·커뮤니티 운영자로 활동 중이신가요? 공급자이자 수요자 역할을 함께 할 수 있는
              리더에게 드리는 공식 등급입니다.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              <li>✓ 공식 파트너 배지 표시</li>
              <li>✓ 향후 리워드 제도 도입 시 우선 적용</li>
              <li>✓ 점핑매니저와 우선 연결</li>
              <li>✓ 내 판매·구매 신청 현황을 마이페이지에서 한 번에 확인</li>
            </ul>

            {isOfficialPartner ? (
              <p className="mt-3 rounded-lg bg-amber-100 p-2 text-center text-sm font-semibold text-amber-900">
                ✅ 공식 점핑파트너입니다
              </p>
            ) : partnerStatus === "pending" ? (
              <p className="mt-3 rounded-lg bg-amber-100 p-2 text-center text-sm text-amber-900">
                심사 중입니다. 확인 후 연락드릴게요.
              </p>
            ) : partnerStatus === "rejected" ? (
              <p className="mt-3 rounded-lg bg-gray-100 p-2 text-center text-sm text-gray-600">
                신청이 반려되었어요. 문의는 점핑매니저에게 연락주세요.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="업종/사업형태 (예: 냉동수산물 도매)"
                  value={partnerForm.businessType}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, businessType: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="채널 정보 (카카오톡 채널/블로그 URL 등)"
                  value={partnerForm.channelInfo}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, channelInfo: e.target.value }))}
                />
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="추가로 전달하고 싶은 내용 (선택)"
                  value={partnerForm.message}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, message: e.target.value }))}
                />
                {partnerError && <p className="text-xs text-red-600">{partnerError}</p>}
                <button
                  onClick={submitPartnerRequest}
                  disabled={partnerSubmitting}
                  className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {partnerSubmitting ? "신청 중..." : "공식 점핑파트너 신청하기"}
                </button>
              </div>
            )}
          </div>

          {referrals.length > 0 && (
            <div className="flex flex-col gap-2 mt-3">
              {referrals.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white border border-gray200 rounded-xl px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-bold text-gray900">
                      {r.member_no != null ? formatMemberNo(r.member_no) : "회원번호 없음"}
                      {r.company_name && (
                        <span className="text-xs font-medium text-gray500 ml-1.5">{r.company_name}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray500 mt-0.5">
                      {r.phone}
                      {" · "}
                      {new Date(r.created_at).toLocaleDateString("ko-KR")} 가입
                      {r.is_business && " · 사업자"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "#E8F8EC", color: "#1D8A44" }}
                    >
                      가입완료
                    </span>
                    {r.business_verified && (
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: "#E8F8EC", color: "#1D8A44" }}
                      >
                        ✓ 인증된 사업자
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray200 pt-5">
          <button
            type="button"
            onClick={() => showToast("개발 중인 기능이에요. 곧 만나보실 수 있어요!")}
            className="w-full bg-white border border-gray200 rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="text-xl leading-none">📋</span>
              <span className="text-sm font-bold text-gray900">견적함</span>
            </span>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: "#F5F6F8", color: "#6B7480" }}
            >
              준비중
            </span>
          </button>
        </div>

        <Link href="/unsubscribe" className="text-center text-xs text-gray500 underline py-2">
          알림이 필요 없으신가요? 알림 해지 · 탈퇴
        </Link>
      </div>

      <Toast message={toastMessage} />
    </main>
  );
}
