"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockCategories, mockRegions, categoryIcons } from "@/lib/mockData";
import { formatPrice, formatMemberNo, formatRelativeTime, dealUrgencyState } from "@/lib/format";
import { generateRefCode } from "@/lib/refCode";
import Toast, { useToast } from "@/components/Toast";
import BusinessLicenseUploader from "@/components/BusinessLicenseUploader";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거

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

type AlertLogItem = {
  id: string;
  sent_at: string;
  deals: {
    id: string;
    title: string;
    category_id: number | null;
    deal_price: number;
    original_price: number;
    closes_at: string;
    categories: { name: string } | null;
  } | null;
};

export default function MyPage() {
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [memberNo, setMemberNo] = useState<number | null>(null);
  const [refCode, setRefCode] = useState("");
  const [bonusPhotoSlots, setBonusPhotoSlots] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(true); // 값 로드 전 깜빡임 방지, 아래 effect가 실제 판정
  const [memberId, setMemberId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [alertLog, setAlertLog] = useState<AlertLogItem[]>([]);
  const [alertLogCount, setAlertLogCount] = useState(0);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [shareDeals, setShareDeals] = useState<{ id: string; title: string; deal_price: number }[]>([]);
  const [selectedShareDealId, setSelectedShareDealId] = useState<string>("");
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
      // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
      const { data: sessionCheck } = await supabase.auth.getSession();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      debugLog(
        `[mypage] getSession=${sessionCheck.session ? "EXISTS" : "NULL"}` +
          `(user=${sessionCheck.session?.user?.id?.slice(0, 8) ?? "none"}) ` +
          `getUser=${userData.user ? "EXISTS" : "NULL"}(user=${userData.user?.id?.slice(0, 8) ?? "none"}) ` +
          `getUserError=${userError?.message ?? "none"}`
      );

      if (!userData.user) {
        setNotLoggedIn(true);
        setLoading(false);
        return;
      }
      const userId = userData.user.id;
      setMemberId(userId);

      const { data: member } = await supabase
        .from("members")
        .select("phone, ref_code, member_no, company_name, name, email, business_verified, business_license_path, bonus_photo_slots")
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
        setBonusPhotoSlots(member.bonus_photo_slots ?? 0);
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

      const { data: alertLogRows, count: alertLogTotal } = await supabase
        .from("notification_logs")
        .select("id, sent_at, deals(id, title, category_id, deal_price, original_price, closes_at, categories(name))", { count: "exact" })
        .eq("member_id", userId)
        .order("sent_at", { ascending: false })
        .limit(5);
      setAlertLog((alertLogRows as unknown as AlertLogItem[]) ?? []);
      setAlertLogCount(alertLogTotal ?? 0);

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
    if (window.location.hash === "#alerts") {
      setAlertsOpen(true);
      requestAnimationFrame(() => {
        document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      .limit(8)
      .then(({ data }) => {
        setShareDeals(data ?? []);
        if (data && data.length > 0) setSelectedShareDealId(data[0].id); // 기본값: 최신 매물
      });
  }, []);

  // 사진 슬롯이 "이전에 본 값"과 다르면(=새로 지급됨) 축하 배너를 다시 보여줌
  useEffect(() => {
    if (bonusPhotoSlots <= 0) return;
    try {
      const seen = localStorage.getItem("jumpx_bonus_banner_seen");
      setBannerDismissed(seen === String(bonusPhotoSlots));
    } catch {
      setBannerDismissed(false);
    }
  }, [bonusPhotoSlots]);

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

  type MessageThread = {
    key: string;
    dealId: string;
    dealTitle: string;
    counterpartId: string;
    counterpartLabel: string;
    items: { id: string; body: string; created_at: string; mine: boolean }[];
  };
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<string | null>(null);

  const loadMessages = async () => {
    if (!isSupabaseConfigured || !supabase || !memberId) return;
    const { data } = await supabase
      .from("messages")
      .select("id, deal_id, sender_id, receiver_id, body, created_at, deals(title, seller_member_id, seller_display_name)")
      .or(`sender_id.eq.${memberId},receiver_id.eq.${memberId}`)
      .order("created_at", { ascending: true });
    if (!data) return;
    const map = new Map<string, MessageThread>();
    for (const m of data) {
      const dealInfo = m.deals as unknown as { title: string; seller_member_id: string | null; seller_display_name: string | null } | null;
      const counterpartId = m.sender_id === memberId ? m.receiver_id : m.sender_id;
      const key = `${m.deal_id}__${counterpartId}`;
      const counterpartLabel =
        counterpartId === dealInfo?.seller_member_id ? dealInfo?.seller_display_name ?? "판매자" : "구매자";
      if (!map.has(key)) {
        map.set(key, { key, dealId: m.deal_id, dealTitle: dealInfo?.title ?? "매물", counterpartId, counterpartLabel, items: [] });
      }
      map.get(key)!.items.push({ id: m.id, body: m.body, created_at: m.created_at, mine: m.sender_id === memberId });
    }
    setThreads(
      Array.from(map.values()).sort((a, b) => {
        const aLast = a.items[a.items.length - 1]?.created_at ?? "";
        const bLast = b.items[b.items.length - 1]?.created_at ?? "";
        return bLast.localeCompare(aLast);
      })
    );
  };

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const sendReply = async (thread: MessageThread) => {
    if (!supabase || !memberId) return;
    const body = (replyDraft[thread.key] || "").trim();
    if (!body) return;
    setReplySending(thread.key);
    const { error } = await supabase.from("messages").insert({
      deal_id: thread.dealId,
      sender_id: memberId,
      receiver_id: thread.counterpartId,
      body,
    });
    if (!error) {
      setReplyDraft((prev) => ({ ...prev, [thread.key]: "" }));
      await loadMessages();
    }
    setReplySending(null);
  };

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const shareDeal = shareDeals.find((d) => d.id === selectedShareDealId) ?? null;

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
          이미 가입하셨다면 번호 인증만으로 바로 들어올 수 있어요.
        </p>
        <Link
          href="/login"
          className="text-white text-center font-bold rounded-2xl text-base px-8"
          style={{ background: "linear-gradient(135deg, #E25100, #FF6F0F)", padding: "14px 32px" }}
        >
          휴대폰 번호로 로그인
        </Link>
        <Link
          href="/signup"
          className="mt-3 text-center"
          style={{ color: "#6B7480", fontSize: 14.5, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 4 }}
        >
          처음이신가요? 알림 신청하기
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 py-5 text-white"
        style={{ background: "linear-gradient(135deg,#04101C,#0D2B47)" }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52, background: "rgba(255,255,255,.14)", fontSize: 23 }}>
            🏪
          </div>
          {adminInfo && (
            <Link
              href="/admin"
              className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{ width: 30, height: 30, background: "rgba(255,255,255,.14)", fontSize: 14 }}
              aria-label="관리자 화면으로 이동"
              title={`관리자 화면 · ${adminInfo.name}`}
            >
              🛡️
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-black truncate" style={{ fontSize: 18.5, letterSpacing: "-0.02em" }}>
              {companyName || phone || "회원님"}
              {companyName && fullName && ` · ${fullName}`}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {memberNo != null && (
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,.8)" }}>
                  회원번호 <span className="font-mono">{formatMemberNo(memberNo)}</span>
                </span>
              )}
              {(businessVerified || hasBusinessLicense) && (
                <span
                  className="font-bold rounded"
                  style={{
                    fontSize: 12,
                    padding: "2px 7px",
                    background: businessVerified ? "rgba(47,158,68,.25)" : "rgba(255,255,255,.15)",
                    color: businessVerified ? "#7EE2A0" : "rgba(255,255,255,.7)",
                  }}
                >
                  {businessVerified ? "✔ 사업자 인증" : "사업자 인증 대기중"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4.5">
          <div className="flex-1 rounded-xl text-center" style={{ background: "rgba(255,255,255,.1)", padding: "12px 8px" }}>
            <div className="font-mono font-bold" style={{ fontSize: 19, color: "var(--color-brandOrangeAccent)" }}>{alertLogCount}</div>
            <div className="mt-0.5 font-bold" style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>받은 알림</div>
          </div>
          <div className="flex-1 rounded-xl text-center" style={{ background: "rgba(255,255,255,.1)", padding: "12px 8px" }}>
            <div className="font-mono font-bold" style={{ fontSize: 19, color: "var(--color-brandOrangeAccent)" }}>{interests.length}</div>
            <div className="mt-0.5 font-bold" style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>관심 매물</div>
          </div>
          <div className="flex-1 rounded-xl text-center" style={{ background: "rgba(255,255,255,.1)", padding: "12px 8px" }}>
            <div className="font-mono font-bold" style={{ fontSize: 19, color: "var(--color-brandOrangeAccent)" }}>{referrals.length}</div>
            <div className="mt-0.5 font-bold" style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>추천 회원</div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          {profileComplete && !editingProfile ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-base font-bold text-navy">내 정보</div>
                <button type="button" onClick={() => setEditingProfile(true)} className="text-sm font-bold text-orange">
                  정보 수정
                </button>
              </div>
              <div className="bg-gray100 rounded-xl px-4 py-3 flex flex-col gap-1">
                <div className="font-bold text-navy" style={{ fontSize: 15 }}>
                  {companyName}
                  {fullName && ` · ${fullName}`}
                </div>
                {email && <div className="text-gray500" style={{ fontSize: 14 }}>{email}</div>}
                <span
                  className="text-sm font-bold px-2 py-0.5 rounded-full self-start mt-1"
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
                <p className="text-sm text-gray500 leading-relaxed">
                  채워주시면 점핑매니저가 더 정확하게 도와드려요. 전부 선택 입력이라 지금 안 채워도 괜찮아요.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
                  상호명
                  <span className="text-sm font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">선택</span>
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
                  <span className="text-sm font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">선택</span>
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
                  <span className="text-sm font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">선택</span>
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
                  {profileSaving ? (
                    "저장 중..."
                  ) : profileSaved ? (
                    <span className="inline-flex items-center justify-center gap-1">
                      <CheckCircle className="w-4 h-4" /> 저장됐어요
                    </span>
                  ) : (
                    "프로필 저장"
                  )}
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

        <div id="referral" className="border-t border-gray200 pt-5">
          <div className="text-base font-bold text-navy mb-1 flex items-center gap-1.5">
            🤝 점핑파트너
            <span className="text-sm font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
              {referrals.length}명 추천함
            </span>
          </div>
          <p className="text-sm text-gray500 mb-1 leading-relaxed">
            아래 링크로 가입하면 내가 추천한 회원으로 따로 관리돼요.
          </p>
          <p className="text-sm font-bold mb-3" style={{ color: "#966B00" }}>
            🎁 추천 1명당 나도 친구도 사진 슬롯 +2장 (지금 내 사진 슬롯: {4 + bonusPhotoSlots}장)
          </p>

          {bonusPhotoSlots > 0 && !bannerDismissed && (
            <div
              className="flex items-start justify-between gap-3 rounded-xl mb-3"
              style={{ background: "#E8F8EC", border: "1px solid #B8E6C2", padding: "12px 14px" }}
            >
              <p className="text-sm font-bold leading-relaxed" style={{ color: "#1F7A34" }}>
                🎉 {referrals[0]?.company_name || (referrals[0]?.member_no != null ? `${formatMemberNo(referrals[0].member_no)} 회원` : "추천하신 분")}
                이 추천으로 가입했어요! 사진 슬롯이 {4 + bonusPhotoSlots}장으로 늘었어요.
              </p>
              <button
                type="button"
                onClick={() => {
                  setBannerDismissed(true);
                  try {
                    localStorage.setItem("jumpx_bonus_banner_seen", String(bonusPhotoSlots));
                  } catch {}
                }}
                className="flex-shrink-0 text-sm font-bold"
                style={{ color: "#1F7A34" }}
              >
                닫기
              </button>
            </div>
          )}

          {shareDeals.length > 0 && (
            <label className="text-sm font-bold text-gray500 mb-1.5 block">공유할 매물 선택</label>
          )}
          {shareDeals.length > 0 && (
            <select
              value={selectedShareDealId}
              onChange={(e) => setSelectedShareDealId(e.target.value)}
              className="w-full text-sm font-bold border-2 border-gray200 rounded-xl mb-2 outline-none"
              style={{ padding: "10px 12px", color: "#0B2540" }}
            >
              {shareDeals.map((d) => (
                <option key={d.id} value={d.id}>
                  📦 {d.title} · {formatPrice(d.deal_price)}
                </option>
              ))}
              <option value="">🔗 매물 없이 가입 추천만 보내기</option>
            </select>
          )}
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
              style={{ background: "linear-gradient(135deg, #E25100, #FF6F0F)" }}
            >
              {copied ? (
                <span className="inline-flex items-center justify-center gap-1">
                  복사됨 <CheckCircle className="w-3.5 h-3.5" />
                </span>
              ) : (
                "복사"
              )}
            </button>
            <button
              onClick={handleShareRefLink}
              aria-label="추천 링크 공유"
              className="font-bold rounded-xl px-4 text-sm whitespace-nowrap flex-shrink-0 border-2 border-gray200 text-navy"
            >
              {shared ? (
                <span className="inline-flex items-center justify-center gap-1">
                  공유됨 <CheckCircle className="w-3.5 h-3.5" />
                </span>
              ) : (
                "공유 ↗"
              )}
            </button>
          </div>

          {typeof window !== "undefined" && refCode && (
            <div className="flex flex-col items-center mt-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(refUrl)}`}
                alt="추천 링크 QR 코드"
                className="w-32 h-32 rounded-xl border border-gray200"
              />
              <p className="text-sm text-gray500 mt-2">명함 대신 QR로 보여주세요 · 스캔하면 제 추천으로 가입돼요</p>
            </div>
          )}

          <div className="mt-6 rounded-2xl" style={{ background: "#FFF9EC", border: "1px solid #F0DCA8", padding: "14px 15px" }}>
            <h3 className="font-black" style={{ fontSize: 14.5, color: "#8A6100" }}>🏅 공식 점핑파트너</h3>
            {!isOfficialPartner && (
              <>
                <p className="mt-1.5 leading-relaxed" style={{ fontSize: 13.5, color: "#7A5230" }}>
                  이미 덤핑·재고 유통업, 도매업, 밴드/카톡채널/블로그 등 SNS 운영자, 대기업 대리점,
                  제조·수입·커뮤니티 운영자로 활동 중이신가요? 공급자이자 수요자 역할을 함께 할 수 있는
                  리더에게 드리는 공식 등급입니다.
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {[
                    "공식 파트너 배지 표시",
                    "향후 리워드 제도 도입 시 우선 적용",
                    "점핑매니저와 우선 연결",
                    "내 판매·구매 신청 현황을 마이페이지에서 한 번에 확인",
                  ].map((b) => (
                    <li key={b} className="flex items-center gap-1.5" style={{ fontSize: 13.5, color: "#7A5230" }}>
                      <span style={{ color: "#2F9E44", fontWeight: 900 }}>✔</span>{b}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {isOfficialPartner && (
              <p className="mt-1.5 leading-relaxed" style={{ fontSize: 13.5, color: "#7A5230" }}>
                공식 파트너 배지 · 우선 리워드 · 점핑매니저 우선 연결 혜택을 받고 계세요.
              </p>
            )}

            {isOfficialPartner ? (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full" style={{ background: "#E8F8EC", padding: "6px 12px" }}>
                <span style={{ color: "#2F9E44", fontWeight: 900 }}>✔</span>
                <span className="font-bold" style={{ fontSize: 13.5, color: "#2F9E44" }}>공식 점핑파트너입니다</span>
              </div>
            ) : partnerStatus === "pending" ? (
              <div className="flex items-center gap-2.5 mt-2.5 rounded-xl" style={{ background: "#FFF4E0", padding: "12px 13px" }}>
                <span className="font-black flex-shrink-0 rounded" style={{ fontSize: 12, padding: "3px 9px", background: "#F5E3BC", color: "#966B00" }}>심사중</span>
                <span className="flex-1 leading-relaxed" style={{ fontSize: 13.5, color: "#7A5230" }}>
                  신청서를 검토하고 있어요. 보통 2영업일 안에 결과를 알려드립니다.
                </span>
              </div>
            ) : partnerStatus === "rejected" ? (
              <p className="mt-2.5 rounded-xl text-center" style={{ background: "#F5F6F8", padding: "10px", fontSize: 14, color: "#6B7480" }}>
                신청이 반려되었어요. 문의는 점핑매니저에게 연락주세요.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2.5">
                <input
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: 14.5 }}
                  placeholder="업종/사업형태 (예: 냉동수산물 도매)"
                  value={partnerForm.businessType}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, businessType: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: 14.5 }}
                  placeholder="채널 정보 (카카오톡 채널/블로그 URL 등)"
                  value={partnerForm.channelInfo}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, channelInfo: e.target.value }))}
                />
                <textarea
                  className="w-full rounded-xl outline-none resize-none"
                  style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: 14, lineHeight: 1.5, height: 70 }}
                  placeholder="추가로 전달하고 싶은 내용 (선택)"
                  value={partnerForm.message}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, message: e.target.value }))}
                />
                {partnerError && <p className="text-sm" style={{ color: "var(--color-orange)" }}>{partnerError}</p>}
                <button
                  onClick={submitPartnerRequest}
                  disabled={partnerSubmitting}
                  className="w-full font-bold rounded-xl text-white disabled:opacity-50"
                  style={{ background: "#8A6100", padding: "13px 0", fontSize: 14.5 }}
                >
                  {partnerSubmitting ? "신청 중..." : "공식 점핑파트너 신청하기"}
                </button>
              </div>
            )}
          </div>

          <p className="text-sm text-gray500 mt-4 mb-2 leading-relaxed">
            내가 추천한 회원은 여기서 확인할 수 있어요. 상세 관리 대시보드는 준비 중이에요.
          </p>
          <div className="flex flex-col gap-2">
            {referrals.length === 0 ? (
              <p className="text-sm text-gray500 text-center py-4">
                아직 추천으로 가입한 회원이 없어요. 위 링크를 공유해보세요!
              </p>
            ) : (
              <>
                {referrals.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white border border-gray200 rounded-xl px-4 py-3"
                  >
                    <div>
                      <div className="text-base font-bold text-gray900">
                        {r.member_no != null ? formatMemberNo(r.member_no) : "회원번호 없음"}
                        {r.company_name && (
                          <span className="text-sm font-medium text-gray500 ml-1.5">{r.company_name}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray500 mt-0.5">
                        {r.phone}
                        {" · "}
                        {new Date(r.created_at).toLocaleDateString("ko-KR")} 가입
                        {r.is_business && " · 사업자"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className="text-sm font-bold px-2.5 py-1 rounded-full"
                        style={{ background: "#E8F8EC", color: "#1D8A44" }}
                      >
                        가입완료
                      </span>
                      {r.business_verified && (
                        <span
                          className="text-sm font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                          style={{ background: "#E8F8EC", color: "#1D8A44" }}
                        >
                          <CheckCircle className="w-3 h-3" /> 인증된 사업자
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div id="alerts" className="border-t border-gray200 pt-5">
          <button
            type="button"
            onClick={() => setAlertsOpen((v) => !v)}
            className="w-full flex items-center gap-3 rounded-2xl text-left"
            style={{ border: "1px solid #E4E7EB", padding: "15px 16px" }}
          >
            <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: "#FDEEE8", fontSize: 17 }}>🔔</span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold" style={{ fontSize: 14, color: "#0B2540" }}>내 알림 조건</span>
              <span className="block truncate mt-0.5" style={{ fontSize: 12.5, color: "#6B7480" }}>
                {categories.length > 0 ? categories.slice(0, 2).join("·") + (categories.length > 2 ? ` 외 ${categories.length - 2}` : "") : "전체 카테고리"}
                {" · "}
                {regions.length === 0 ? "전 지역" : regions.slice(0, 2).join("·") + (regions.length > 2 ? ` 외 ${regions.length - 2}` : "")}
              </span>
            </span>
            <span style={{ color: "#6B7480" }}>{alertsOpen ? "접기 ▲" : "변경하기 ›"}</span>
          </button>

          {alertsOpen && (
            <div className="mt-3.5 flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-navy">관심 카테고리</span>
                  <button
                    type="button"
                    onClick={() => setCategories(categories.length === mockCategories.length ? [] : [...mockCategories])}
                    className="text-sm font-bold text-orange"
                  >
                    {categories.length === mockCategories.length ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
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
                            ? { background: "#FF6F0F", borderColor: "#FF6F0F", color: "#fff" }
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
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-navy">관심 지역</span>
                  <button
                    type="button"
                    onClick={() => setRegions(regions.length === mockRegions.length ? [] : [...mockRegions])}
                    className="text-sm font-bold text-orange"
                  >
                    {regions.length === mockRegions.length ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
                <p className="text-sm text-gray500 mb-2">선택 안 하면 전국 매물 알림을 다 받아요</p>
                <div className="grid grid-cols-4 gap-2">
                  {mockRegions.map((r) => (
                    <button
                      key={r}
                      onClick={() => toggle(regions, setRegions, r)}
                      className={`text-sm py-2.5 rounded-full border-2 font-bold text-center ${
                        regions.includes(r) ? "bg-[#FF6F0F] text-white border-[#FF6F0F]" : "border-gray200 text-gray500"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {alertLog.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-black" style={{ fontSize: 15, color: "#0B2540" }}>최근 받은 알림</span>
              <span style={{ fontSize: 12.5, color: "#6B7480" }}>최근 활동</span>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
              {alertLog.map((a) => {
                if (!a.deals) return null;
                const { closed, urgent } = dealUrgencyState(a.deals.closes_at);
                const discount = a.deals.original_price
                  ? Math.round(((a.deals.original_price - a.deals.deal_price) / a.deals.original_price) * 100)
                  : 0;
                return (
                  <Link
                    key={a.id}
                    href={`/deals/${a.deals.id}`}
                    className="flex items-center gap-2.5 w-full text-left"
                    style={{ borderBottom: "1px solid #F1F3F5", padding: "13px 14px" }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-bold" style={{ fontSize: 14, color: "#1A1F26" }}>{a.deals.title}</span>
                      <span className="block mt-0.5" style={{ fontSize: 12.5, color: "#6B7480" }}>
                        {formatRelativeTime(a.sent_at)} · {a.deals.categories?.name ?? "기타"}
                        {discount > 0 && ` · -${discount}%`}
                      </span>
                    </span>
                    <span
                      className="flex-shrink-0 font-bold"
                      style={{ fontSize: 12, color: closed ? "#6B7480" : urgent ? "var(--color-urgent)" : "var(--color-verified)" }}
                    >
                      {closed ? "마감" : urgent ? "마감임박" : "진행중"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="text-white font-bold rounded-2xl text-base disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #E25100, #FF6F0F)", padding: "14px 0" }}
        >
          {saving ? (
            "저장 중..."
          ) : saved ? (
            <span className="inline-flex items-center justify-center gap-1">
              <CheckCircle className="w-4 h-4" /> 저장됐어요
            </span>
          ) : (
            "설정 저장"
          )}
        </button>
        {saveError && <div className="text-sm text-orange font-medium">{saveError}</div>}

        <div className="border-t border-gray200 pt-5">
          <div className="text-base font-bold text-navy mb-3">
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
                    <div className="text-base font-bold text-gray900">{i.deals.title}</div>
                    <div className="text-base text-navy font-bold mt-0.5">
                      {formatPrice(i.deals.deal_price)}
                    </div>
                  </div>
                  <span
                    className="text-sm font-bold px-2.5 py-1 rounded-full flex-shrink-0"
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

        <div id="messages" className="border-t border-gray200 pt-5">
          <div className="text-base font-bold text-navy mb-3">쪽지함 ({threads.length})</div>
          {threads.length === 0 && (
            <div className="text-center text-gray500 text-sm py-6">아직 주고받은 쪽지가 없어요.</div>
          )}
          <div className="flex flex-col gap-3">
            {threads.map((t) => (
              <div key={t.key} className="bg-white border border-gray200 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/deals/${t.dealId}`} className="text-sm font-bold text-gray500 truncate">
                    {t.dealTitle}
                  </Link>
                  <span className="text-sm font-bold text-navy flex-shrink-0 ml-2">{t.counterpartLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {t.items.map((m) => (
                    <div
                      key={m.id}
                      className={`text-base rounded-xl px-3 py-2 max-w-[85%] ${m.mine ? "self-end text-white" : "self-start bg-gray100 text-gray900"}`}
                      style={m.mine ? { background: "#0B2540" } : undefined}
                    >
                      {m.body}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <input
                    value={replyDraft[t.key] ?? ""}
                    onChange={(e) => setReplyDraft((prev) => ({ ...prev, [t.key]: e.target.value }))}
                    placeholder="답장 입력..."
                    className="flex-1 min-w-0 border-2 border-gray200 rounded-xl px-3 text-sm outline-none focus:border-navy"
                    style={{ height: "40px" }}
                  />
                  <button
                    onClick={() => sendReply(t)}
                    disabled={replySending === t.key}
                    className="text-white font-bold rounded-xl px-4 text-sm flex-shrink-0 disabled:opacity-60"
                    style={{ background: "#0B2540" }}
                  >
                    전송
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray200 pt-5">
          <Link
            href="/sell"
            className="flex items-center justify-between rounded-2xl"
            style={{ background: "rgba(255,111,15,0.10)", border: "2px solid #FF6F0F", padding: "16px 20px" }}
          >
            <div>
              <div className="text-base font-black text-navy">📦 긴급 매물 등록하기</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: "#E25100" }}>
                남는 재고 있으세요? 무료로 바로 등록
              </div>
            </div>
            <span className="text-xl" style={{ color: "#FF6F0F" }}>→</span>
          </Link>
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
              className="text-sm font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: "#F5F6F8", color: "#6B7480" }}
            >
              준비중
            </span>
          </button>
        </div>

        <Link href="/unsubscribe" className="text-center text-sm text-gray500 underline py-2">
          알림이 필요 없으신가요? 알림 해지 · 탈퇴
        </Link>
      </div>

      <Toast message={toastMessage} />
    </main>
  );
}
