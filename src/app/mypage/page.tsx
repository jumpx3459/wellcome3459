"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockCategories, mockRegions, categoryIcons, categoryColors } from "@/lib/mockData";
import { formatPrice, formatMemberNo, formatRelativeTime, dealUrgencyState, formatDealPrice } from "@/lib/format";
import { generateRefCode } from "@/lib/refCode";
import Toast, { useToast } from "@/components/Toast";
import BusinessLicenseUploader from "@/components/BusinessLicenseUploader";
import EcosystemGrid, { SECTION_TITLE_STYLE, SERVICES_ANCHOR_ID, scrollToServicesIfHash } from "@/components/EcosystemGrid";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import PushStatusCard from "@/components/PushStatusCard";
import { MESSAGES_ENABLED, QUOTES_ENABLED } from "@/lib/features";
import QuotesTeaserCard from "@/components/QuotesTeaserCard";
import MyBuyRequests from "@/components/MyBuyRequests";
import { SITE_URL } from "@/lib/siteUrl";
import { resizeImageForUpload } from "@/lib/resizeImage";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { rem } from "@/lib/rem";
import { formatKoreanPhone } from "@/lib/auth";
import { authFetch } from "@/lib/authFetch";
import { isTestTitle } from "@/lib/categoryAvg";
import { getPhotoLimit, isPhotoLimitMaxed, MAX_PHOTO_SLOTS } from "@/lib/photoLimit";
import { clearReturningMember } from "@/lib/returningMember";
import { UI_SECTION, UI_CARD_TITLE, UI_DESC, UI_META, UI_LINK } from "@/lib/uiText";
import { FieldLabel, FORM_INPUT_FONT_SIZE } from "@/components/FormField";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

type InterestItem = {
  id: string;
  deals: {
    id: string;
    title: string;
    deal_price: number;
    quantity_unit: string | null;
    price_unit: string | null;
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
  // 2026-09-28: 긴급 공지(부동산·설비 처분) 알림 — 기존 카테고리/지역 매칭 알림과
  // 완전히 별개의 opt-in. 무분별한 전체발송으로 재고 알림 피로도가 올라가는 걸
  // 막기 위해 기본 꺼짐, 회원이 직접 켜야만 받는다.
  const [noticeAlertsOptIn, setNoticeAlertsOptIn] = useState(false);
  const [noticeAlertsSaving, setNoticeAlertsSaving] = useState(false);
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [alertLog, setAlertLog] = useState<AlertLogItem[]>([]);
  const [alertLogCount, setAlertLogCount] = useState(0);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [shareDeals, setShareDeals] = useState<{ id: string; title: string; deal_price: number; quantity_unit: string | null; price_unit: string | null }[]>([]);
  const [selectedShareDealId, setSelectedShareDealId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [businessVerified, setBusinessVerified] = useState(false);
  const [hasBusinessLicense, setHasBusinessLicense] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  // 2026-09-27: 재접속마다 휴대폰 OTP 인증(SMS)을 다시 받아야 하는 게 번거롭다는
  // 피드백 — 특히 PWA 재설치처럼 세션이 통째로 날아가는 경우, 브라우저에 저장된
  // 걸로는 어차피 자동 로그인이 불가능하므로 "기억하는 비밀번호"가 유일한 대안.
  // Supabase Auth가 phone 계정에 비밀번호를 얹는 걸 기본 지원해서(updateUser),
  // 별도 테이블/해싱 없이 여기서 설정 → /login에서 signInWithPassword로 사용.
  const [settingPassword, setSettingPassword] = useState(false);
  // 로그인 화면 권유 시트의 [지금 만들기] → /mypage#password: 비밀번호 설정을 바로 펼침
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#password") setSettingPassword(true);
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
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
        .select("phone, ref_code, member_no, company_name, name, email, business_verified, business_license_path, bonus_photo_slots, avatar_url, notice_alerts_opt_in")
        .eq("id", userId)
        .single();
      if (member) {
        setPhone(formatKoreanPhone(member.phone)); // 표시 전용 — 저장 형식이 섞여 있어 "010-1234-5678"로 통일
        setMemberNo(member.member_no);
        setCompanyName(member.company_name ?? "");
        setFullName(member.name ?? "");
        setEmail(member.email ?? "");
        setBusinessVerified(Boolean(member.business_verified));
        setHasBusinessLicense(Boolean(member.business_license_path));
        setBonusPhotoSlots(member.bonus_photo_slots ?? 0);
        setAvatarUrl(member.avatar_url ?? null);
        setNoticeAlertsOptIn(Boolean(member.notice_alerts_opt_in));
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
        .select("id, deals(id, title, deal_price, quantity_unit, price_unit, status)")
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

      // 2026-09-29: 토큰을 state에 저장해 재사용하지 않음 — authFetch가 호출할 때마다 최신 토큰(만료 시 갱신)
      authFetch("/api/my-referrals")
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data) => setReferrals(data.items ?? []))
        .catch(() => {});

      authFetch("/api/is-admin")
        .then((res): Promise<{ isAdmin?: boolean; name?: string; role?: string }> => (res.ok ? res.json() : Promise.resolve({})))
        .then((data) => {
          if (data.isAdmin) setAdminInfo({ name: data.name ?? "", role: data.role ?? "" });
        })
        .catch(() => {});

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
    scrollToServicesIfHash(); // 매물 상세 "점핑 서비스 · 전체 보기"
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
      .select("id, title, deal_price, quantity_unit, price_unit")
      .eq("status", "active")
      .gt("closes_at", new Date().toISOString()) // 마감 지난 매물은 공유 목록에서 제외
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        // 2026-09-29: 제목에 [테스트]가 들어간 매물은 공유 목록에서 제외 (기본 선택도 실매물 중 최신)
        const real = (data ?? []).filter((d) => !isTestTitle(d.title)).slice(0, 8);
        setShareDeals(real);
        setSelectedShareDealId(real[0]?.id ?? "");
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
    if (!MESSAGES_ENABLED) return;
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const sendReply = async (thread: MessageThread) => {
    if (!supabase || !memberId) return;
    const body = (replyDraft[thread.key] || "").trim();
    if (!body) return;
    if (body.length > 1000) {
      showToast("쪽지는 1000자까지 보낼 수 있어요.");
      return;
    }
    setReplySending(thread.key);
    const { error } = await supabase.from("messages").insert({
      deal_id: thread.dealId,
      sender_id: memberId,
      receiver_id: thread.counterpartId,
      body,
    });
    if (error) {
      showToast("전송에 실패했어요. 잠시 후 다시 시도해주세요.");
    } else {
      setReplyDraft((prev) => ({ ...prev, [thread.key]: "" }));
      await loadMessages();
    }
    setReplySending(null);
  };

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const [loggingOut, setLoggingOut] = useState(false);
  const logout = async () => {
    if (!supabase || loggingOut) return;
    setLoggingOut(true);
    clearReturningMember();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    window.location.replace("/"); // 전체 새로고침 — 남은 회원 상태 없이 홈으로
  };

  const shareDeal = shareDeals.find((d) => d.id === selectedShareDealId) ?? null;

  // 공유·QR 링크는 항상 정식 주소 — 비정식 주소(xxx.vercel.app)로 들어온 사람이 공유해도
  // 그 주소가 퍼지지 않게 (src/lib/siteUrl.ts)
  const refUrl = refCode
    ? shareDeal
      ? `${SITE_URL}/deals/${shareDeal.id}?ref=${refCode}`
      : `${SITE_URL}/signup?ref=${refCode}`
    : "";

  const handleShareRefLink = async () => {
    if (typeof window === "undefined" || !refCode) return;
    const url = refUrl;
    const text = shareDeal
      ? `[덤핑점핑] ${shareDeal.title} ${formatDealPrice(shareDeal.deal_price, shareDeal.quantity_unit, shareDeal.price_unit)} 특가! 이런 재고특가 알림 매일 받아보세요 → ${url}`
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

  // 2026-09-28: 카테고리/지역 알림처럼 별도 "저장" 버튼 없이, 스위치를 누르는
  // 즉시 반영 — 체크박스 하나짜리 설정이라 저장 단계를 더 두면 오히려 번거로움.
  const toggleNoticeAlerts = async () => {
    if (!supabase || !memberId) return;
    const next = !noticeAlertsOptIn;
    setNoticeAlertsOptIn(next);
    setNoticeAlertsSaving(true);
    const { error } = await supabase
      .from("members")
      .update({ notice_alerts_opt_in: next })
      .eq("id", memberId);
    setNoticeAlertsSaving(false);
    if (error) setNoticeAlertsOptIn(!next); // 실패 시 되돌림
  };

  const profileComplete = companyName.trim().length > 0;

  const savePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("비밀번호는 8자 이상으로 설정해주세요.");
      return;
    }
    if (!supabase) return;
    setPasswordSaving(true);
    // 비밀번호 설정은 기존처럼 클라이언트 updateUser(보안 비밀번호 변경 설정 유지)
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError("설정하지 못했어요. 다시 시도해주세요.");
      return;
    }
    // 로그인 화면 "비밀번호를 만들어 두세요" 시트 기준 — 서버만 쓸 수 있는 app_metadata에 표시
    authFetch("/api/auth/mark-password").catch(() => {});
    setPasswordSaved(true);
    setNewPassword("");
    setSettingPassword(false);
    setTimeout(() => setPasswordSaved(false), 2500);
  };

  // 2026-09-27: 프로필 사진은 52px로만 보이므로 업로드 전 브라우저에서 축소.
  // Vercel 서버리스 함수 요청 본문 한도(4.5MB)를 원본 휴대폰 사진(3~6MB 흔함)이
  // 넘는 경우가 많아 축소 없이는 "업로드에 실패했어요"가 자주 뜰 수 있음.
  // 2026-09-28: ImageUploader(매물 사진)도 같은 문제가 있어서 src/lib/resizeImage.ts로
  // 공용 유틸을 뽑아냄 — 여기서는 아바타 전용 크기(640px)로 호출.
  const resizeImageForAvatar = (file: File) => resizeImageForUpload(file, 640, 0.85);

  // 2026-09-27: 프로필 사진 업로드 — 기존 deal-images 업로드 API 재사용, 선택 즉시
  // 업로드+저장(자동 반영). 본인 행 수정이라 members_self_update RLS로 충분.
  const handleAvatarSelect = async (file: File | null) => {
    if (!file || !supabase) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAvatarError("20MB 이하 사진만 업로드할 수 있어요.");
      return;
    }
    setAvatarError("");
    setAvatarUploading(true);
    const prevUrl = avatarUrl;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const resized = await resizeImageForAvatar(file);
      const formData = new FormData();
      formData.append("files", resized, "avatar.jpg");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      const url: string | undefined = data.urls?.[0];
      if (!url) {
        setAvatarError("업로드에 실패했어요. 다시 시도해주세요.");
        return;
      }
      const { error: updateError } = await supabase
        .from("members")
        .update({ avatar_url: url })
        .eq("id", userData.user.id);
      if (updateError) {
        setAvatarError("저장에 실패했어요. 다시 시도해주세요.");
        return;
      }
      setAvatarUrl(url);
    } catch {
      setAvatarError("업로드에 실패했어요. 다시 시도해주세요.");
      setAvatarUrl(prevUrl);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!supabase) return;
    setAvatarError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const prevUrl = avatarUrl;
    setAvatarUrl(null);
    const { error } = await supabase.from("members").update({ avatar_url: null }).eq("id", userData.user.id);
    if (error) {
      setAvatarError("삭제에 실패했어요. 다시 시도해주세요.");
      setAvatarUrl(prevUrl);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">🧪</div>
        <h1 className="font-display text-xl text-navy mb-2">데모 모드예요</h1>
        <p className="text-gray500" style={UI_DESC}>
          Supabase가 연결되면 여기서{" "}
          <br className="hidden sm:inline" />
          관심 매물과 알림 설정을 관리할 수 있어요.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen text-gray500" style={UI_DESC}>
        불러오는 중...
      </main>
    );
  }

  if (notLoggedIn) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
        {/* 2026-09-27 (재검토): 다크 히어로 톤 대신 화이트로 전환 — 이 화면은
            브라우징 탭이 아니라 로그인 유도 단일 목적 화면이라 다른 탭과 다크
            톤을 맞출 이유가 없고, 화이트 배경이 오렌지 CTA를 더 도드라지게 함.
            로고도 32px→80px(2.5배)로 확대, 캐릭터는 불투명 흰 배경이 박힌
            manager.png 대신 투명 컷아웃 manager-cut.png로 교체. */}
        <div className="rounded-xl px-3 py-2 inline-block mb-3">
          <img src="/images/logo.png" alt="덤핑점핑" className="h-20 w-auto" />
        </div>
        <span
          className="rounded-full font-medium mb-6"
          style={{ fontSize: rem(11), color: "#6B7480", padding: "3px 9px", background: "#F0F1F3" }}
        >
          Powered by JumpX
        </span>
        <img
          src="/images/manager-cut.png"
          alt="점핑매니저"
          className="w-24 h-24 object-contain mb-4"
          style={{ filter: "drop-shadow(0 6px 10px rgba(11,37,64,.2))" }}
        />
        <h1 className="font-display text-xl mb-2" style={{ color: "#0B2540" }}>로그인이 필요해요</h1>
        <p className="mb-6" style={UI_DESC}>
          이미 가입하셨다면 번호 인증만으로 바로 들어올 수 있어요.
        </p>
        <Link
          href="/login"
          className={`px-8 ${BTN_CLASS}`}
          style={btnStyle("primary")}
        >
          휴대폰 번호로 로그인
        </Link>
        <Link
          href="/signup"
          className="mt-3 text-center"
          style={{ ...UI_LINK, color: "#6B7480", textDecoration: "underline", textUnderlineOffset: 4 }}
        >
          처음이신가요? 알림 신청하기
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-5 pb-5 text-white"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        {/* 2026-09-27: buy/sell/deals와 동일한 헤더 구조로 통일 —
            로고=홈 링크 + Powered by JumpX 배지 / 소제목 라벨+로테이션 태그 행.
            마이페이지는 프로필 요약 카드라 caption(내 정보)만 맞추고
            아바타·상호명·배지·통계 블록은 그대로 유지(이 화면의 "타이틀" 역할). */}
        <div className="flex items-center gap-2 mb-3">
          <Link href="/" className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto" />
          </Link>
          <span
            className="rounded-full font-medium"
            style={{ fontSize: rem(11), color: "rgba(255,255,255,0.6)", padding: "3px 9px", background: "rgba(255,255,255,0.08)" }}
          >
            Powered by JumpX
          </span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-y-1.5 mb-2.5">
          <div className="text-xs font-bold tracking-widest whitespace-nowrap" style={{ color: "#FFD166" }}>
            내 정보
          </div>
          <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
        </div>
        <div className="flex items-center gap-3">
          <div
            className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 52, height: 52, background: "rgba(255,255,255,.14)", fontSize: rem(23) }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="프로필 사진" className="w-full h-full object-cover" />
            ) : (
              "🏪"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate" style={{ fontSize: rem(18), fontWeight: 800, letterSpacing: "-0.02em" }}>
              {companyName || phone || "회원님"}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {companyName && fullName && (
                <span style={{ fontSize: rem(14), fontWeight: 600, color: "rgba(255,255,255,.8)" }}>
                  성명 {fullName}
                </span>
              )}
              {memberNo != null && (
                <span style={{ fontSize: rem(14), fontWeight: 600, color: "rgba(255,255,255,.8)" }}>
                  {companyName && fullName && "· "}회원번호 <span className="font-mono">{formatMemberNo(memberNo)}</span>
                </span>
              )}
            </div>
            {/* 2026-09-27: 신뢰 신호(사업자 인증·관리자)가 12px로 너무 작아 존재감이
                약하다는 피드백 — 배지 크기를 키움. */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {(businessVerified || hasBusinessLicense) && (
                <span
                  className="font-bold rounded-md"
                  style={{
                    fontSize: rem(14),
                    padding: "4px 10px",
                    background: businessVerified ? "rgba(47,158,68,.25)" : "rgba(255,255,255,.15)",
                    color: businessVerified ? "#7EE2A0" : "rgba(255,255,255,.7)",
                  }}
                >
                  {businessVerified ? "✔ 사업자 인증" : "사업자 인증 대기중"}
                </span>
              )}
              {adminInfo && (
                <Link
                  href="/admin"
                  className="font-bold rounded-md inline-flex items-center gap-1"
                  style={{ fontSize: rem(14), padding: "4px 10px", background: "rgba(255,209,102,.2)", color: "#FFD166" }}
                  title={`관리자 화면 · ${adminInfo.name}`}
                >
                  🛡️ 관리자
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* 2026-09-27: 이모지가 숫자 위에 세로로 쌓여 있던 걸 숫자 옆(가로)으로
            붙여 카드 높이를 줄이고 더 컴팩트하게 정리. */}
        <div className="flex gap-2 mt-4.5">
          {/* 2026-09-27: 3개 타일이 전부 클릭 가능한 버튼처럼 보이는데 실제론 그냥
              <div>라 눌러도 반응이 없었음 — "받은 알림"/"관심 매물"은 이 페이지
              더 아래에 해당 목록 섹션이 이미 있어서, 눌렀을 때 그 섹션으로
              스크롤 이동하도록 연결(추천 회원은 이미 아래쪽 "대시보드 열기 →"
              링크가 별도로 있어서 그대로 둠). */}
          <button
            type="button"
            onClick={() =>
              document.getElementById("alert-log-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="flex-1 rounded-xl text-center"
            style={{ background: "rgba(255,255,255,.1)", padding: "12px 8px", border: "none" }}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span style={{ fontSize: rem(14) }}>🔔</span>
              <span className="font-mono font-bold" style={{ fontSize: rem(18), color: "var(--color-brandOrangeAccent)" }}>{alertLogCount}</span>
            </div>
            <div className="mt-1 font-bold" style={{ fontSize: rem(14), color: "rgba(255,255,255,.8)" }}>받은 알림</div>
          </button>
          <button
            type="button"
            onClick={() =>
              document.getElementById("interests-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="flex-1 rounded-xl text-center"
            style={{ background: "rgba(255,255,255,.1)", padding: "12px 8px", border: "none" }}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span style={{ fontSize: rem(14) }}>❤️</span>
              <span className="font-mono font-bold" style={{ fontSize: rem(18), color: "var(--color-brandOrangeAccent)" }}>{interests.length}</span>
            </div>
            <div className="mt-1 font-bold" style={{ fontSize: rem(14), color: "rgba(255,255,255,.8)" }}>관심 매물</div>
          </button>
          <div className="flex-1 rounded-xl text-center" style={{ background: "rgba(255,255,255,.1)", padding: "12px 8px" }}>
            <div className="flex items-center justify-center gap-1.5">
              <span style={{ fontSize: rem(14) }}>🎁</span>
              <span className="font-mono font-bold" style={{ fontSize: rem(18), color: "var(--color-brandOrangeAccent)" }}>{referrals.length}</span>
            </div>
            <div className="mt-1 font-bold" style={{ fontSize: rem(14), color: "rgba(255,255,255,.8)" }}>추천 회원</div>
          </div>
        </div>

        {profileComplete && !editingProfile && (
          <div
            className="flex items-center justify-between gap-3 mt-3 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}
          >
            {/* 2026-09-29: 긴 이메일이 단어 중간에서 꺾이던 문제 — 한 줄 말줄임, 누르면 전체(다시 누르면 접힘) */}
            <button
              type="button"
              onClick={() => email && setEmailExpanded((v) => !v)}
              title={email || undefined}
              className={`min-w-0 flex-1 text-left ${emailExpanded ? "" : "truncate"}`}
              style={{ fontSize: rem(14), color: "rgba(255,255,255,.7)", overflowWrap: emailExpanded ? "anywhere" : undefined }}
            >
              {email || "이메일 미등록"}
            </button>
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* 2026-09-27: 재접속마다(특히 재설치 후) 휴대폰 OTP를 다시 받아야
                  해서 번거롭다는 피드백 — 비밀번호를 설정해두면 /login에서
                  SMS 없이 바로 로그인 가능(잊으면 그냥 기존 OTP로 로그인). */}
              <button
                type="button"
                onClick={() => setSettingPassword((v) => !v)}
                className="whitespace-nowrap"
                style={{ ...UI_LINK, color: "#FFD166" }}
              >
                비밀번호 설정 ›
              </button>
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="whitespace-nowrap"
                style={{ ...UI_LINK, color: "#FFD166" }}
              >
                정보 수정 ›
              </button>
            </div>
          </div>
        )}

        {passwordSaved && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}>
            <span className="font-bold" style={{ fontSize: rem(14), color: "#5EEAD4" }}>
              ✔ 비밀번호를 설정했어요 · 다음부터 SMS 없이 로그인할 수 있어요
            </span>
          </div>
        )}

        {settingPassword && (
          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}>
            <input
              type="password"
              className="w-full rounded-xl outline-none"
              style={{ border: "1.5px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.08)", color: "#fff", padding: 12, fontSize: FORM_INPUT_FONT_SIZE }}
              placeholder="새 비밀번호 (8자 이상)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {passwordError && (
              <span className="font-bold" style={{ fontSize: rem(14), color: "#FF8A8A" }}>{passwordError}</span>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={savePassword}
                disabled={passwordSaving}
                className={`flex-1 ${BTN_CLASS}`}
                style={btnStyle("primary")}
              >
                {passwordSaving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingPassword(false);
                  setPasswordError(null);
                  setNewPassword("");
                }}
                className={`flex-1 ${BTN_CLASS}`}
                // 네이비 헤더 위라 보조 버튼을 어두운 배경용(투명 + 흰 테두리)으로
                style={{ ...btnStyle("secondary"), background: "transparent", border: "1.5px solid rgba(255,255,255,.35)", color: "#fff" }}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-6">
        {(!profileComplete || editingProfile) && (
          <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1" style={UI_CARD_TITLE}>프로필 완성하기</div>
                <p style={UI_DESC}>
                  채워주시면 점핑매니저가 더 정확하게 도와드려요. 전부 선택 입력이라 지금 안 채워도 괜찮아요.
                </p>
              </div>

              <div>
                <FieldLabel need="optional">프로필 사진</FieldLabel>
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ width: 60, height: 60, background: "#F5F6F8", fontSize: rem(26) }}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="프로필 사진" className="w-full h-full object-cover" />
                    ) : (
                      "🏪"
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    <label
                      className="rounded-lg cursor-pointer text-navy"
                      style={{ ...UI_LINK, padding: "8px 14px", border: "2px solid #E4E7EB" }}
                    >
                      {avatarUploading ? "업로드 중..." : avatarUrl ? "사진 변경" : "사진 추가"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={avatarUploading}
                        onChange={(e) => {
                          handleAvatarSelect(e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {avatarUrl && !avatarUploading && (
                      <button
                        type="button"
                        onClick={handleAvatarRemove}
                        className="underline"
                        style={UI_META}
                      >
                        기본 아이콘으로 되돌리기
                      </button>
                    )}
                  </div>
                </div>
                {avatarError && <p className="text-orange mt-1.5" style={{ fontSize: rem(14) }}>{avatarError}</p>}
              </div>

              <div>
                <FieldLabel need="optional">상호명</FieldLabel>
                <input
                  className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
                  style={{ height: "52px", fontSize: FORM_INPUT_FONT_SIZE }}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 웰컴코리아(주)"
                />
              </div>

              <div>
                <FieldLabel need="optional">성명</FieldLabel>
                <input
                  className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
                  style={{ height: "52px", fontSize: FORM_INPUT_FONT_SIZE }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="담당자 성함"
                />
              </div>

              <div>
                <FieldLabel need="optional">이메일</FieldLabel>
                <input
                  type="email"
                  className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
                  style={{ height: "52px", fontSize: FORM_INPUT_FONT_SIZE }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com"
                />
              </div>

              <BusinessLicenseUploader
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
                  className={`flex-1 ${BTN_CLASS}`}
                  style={btnStyle("primary")}
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
                    className={BTN_CLASS}
                    style={btnStyle("secondary")}
                  >
                    취소
                  </button>
                )}
              </div>
          </div>
        )}

        <div id="referral" className="border-t border-gray200 pt-5">
          <div className="mb-1 flex items-center gap-1.5" style={UI_SECTION}>
            🤝 점핑파트너
            <span className="font-medium bg-gray100 px-2 py-0.5 rounded-full" style={UI_META}>
              {referrals.length}명 추천함
            </span>
          </div>
          <p className="mb-1" style={UI_DESC}>
            아래 링크로 가입하면 내가 추천한 회원으로 따로 관리돼요.
          </p>
          {/* 2026-09-29: 굵은 금색 강조는 이 사진 슬롯 안내 한 곳만 */}
          <p className="mb-3" style={{ ...UI_LINK, color: "#966B00", lineHeight: 1.55 }}>
            {isPhotoLimitMaxed({ bonus_photo_slots: bonusPhotoSlots }) ? (
              <>🎁 사진 슬롯을 최대로 모았어요 ({MAX_PHOTO_SLOTS}장)</>
            ) : (
              <>
                🎁 추천 1명당 나도 친구도 사진 슬롯 +2장{" "}
                <span className="whitespace-nowrap">
                  (지금 내 사진 슬롯: {getPhotoLimit({ bonus_photo_slots: bonusPhotoSlots })}장 · 최대 {MAX_PHOTO_SLOTS}장)
                </span>
              </>
            )}
          </p>

          {bonusPhotoSlots > 0 && !bannerDismissed && (
            <div
              className="flex items-start justify-between gap-3 rounded-xl mb-3"
              style={{ background: "#E8F8EC", border: "1px solid #B8E6C2", padding: "12px 14px" }}
            >
              <p style={{ ...UI_LINK, color: "#1F7A34", lineHeight: 1.55 }}>
                🎉 {referrals[0]?.company_name || (referrals[0]?.member_no != null ? `${formatMemberNo(referrals[0].member_no)} 회원` : "추천하신 분")}
                이 추천으로 가입했어요! 사진 슬롯이 {getPhotoLimit({ bonus_photo_slots: bonusPhotoSlots })}장으로 늘었어요.
              </p>
              <button
                type="button"
                onClick={() => {
                  setBannerDismissed(true);
                  try {
                    localStorage.setItem("jumpx_bonus_banner_seen", String(bonusPhotoSlots));
                  } catch {}
                }}
                className="flex-shrink-0"
                style={{ ...UI_LINK, color: "#1F7A34" }}
              >
                닫기
              </button>
            </div>
          )}

          {shareDeals.length > 0 ? (
            <label className="mb-1.5 block font-bold" style={UI_META}>공유할 매물 선택</label>
          ) : (
            <p className="mb-2" style={UI_META}>공유할 매물이 아직 없어요 · 가입 추천 링크로 보내져요</p>
          )}
          {shareDeals.length > 0 && (
            <select
              value={selectedShareDealId}
              onChange={(e) => setSelectedShareDealId(e.target.value)}
              className="w-full border-2 border-gray200 rounded-xl mb-2 outline-none"
              style={{ padding: "10px 12px", color: "#0B2540", ...UI_LINK }}
            >
              {shareDeals.map((d) => (
                <option key={d.id} value={d.id}>
                  📦 {d.title} · {formatDealPrice(d.deal_price, d.quantity_unit, d.price_unit)}
                </option>
              ))}
              <option value="">🔗 매물 없이 가입 추천만 보내기</option>
            </select>
          )}

          {/* design-v2: URL 박스 + 복사 + 공유 버튼 3개가 한 줄에 나열되고 QR이
              항상 펼쳐져 있어 복잡해 보인다는 피드백 → 카카오톡 오픈채팅방 서랍
              스타일(아이콘+라벨 3열, QR은 탭해서 펼침) 벤치마킹해 아이콘 그리드로
              압축 (2026-09-26). URL 전체 텍스트는 작은 캡션으로만 남김. */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(refUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex flex-col items-center gap-1 rounded-2xl bg-white border border-gray200"
              style={{ padding: "14px 8px" }}
            >
              {copied ? (
                <CheckCircle className="w-5 h-5" style={{ color: "#2F9E44" }} />
              ) : (
                <span className="text-xl leading-none">🔗</span>
              )}
              <span className="text-navy" style={UI_LINK}>{copied ? "복사됨" : "링크 복사"}</span>
            </button>

            <button
              type="button"
              onClick={handleShareRefLink}
              aria-label="추천 링크 공유"
              className="flex flex-col items-center gap-1 rounded-2xl bg-white border border-gray200"
              style={{ padding: "14px 8px" }}
            >
              {shared ? (
                <CheckCircle className="w-5 h-5" style={{ color: "#2F9E44" }} />
              ) : (
                <span className="text-xl leading-none">📤</span>
              )}
              <span className="text-navy" style={UI_LINK}>{shared ? "공유됨" : "링크 공유"}</span>
            </button>

            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="flex flex-col items-center gap-1 rounded-2xl bg-white border border-gray200"
              style={{ padding: "14px 8px" }}
            >
              <span className="text-xl leading-none">⬛</span>
              <span className="text-navy" style={UI_LINK}>QR 코드</span>
            </button>
          </div>
          {refUrl && <p className="mt-2" style={{ ...UI_META, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{refUrl}</p>}

          {qrOpen && typeof window !== "undefined" && refCode && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setQrOpen(false)}
            >
              <div
                className="bg-white w-full max-w-md rounded-t-3xl flex flex-col items-center"
                style={{ padding: "28px 24px 32px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(refUrl)}`}
                  alt="추천 링크 QR 코드"
                  className="w-44 h-44 rounded-xl border border-gray200"
                />
                <p className="mt-3 text-center" style={UI_DESC}>
                  명함 대신 QR로 보여주세요 · 스캔하면 제 추천으로 가입돼요
                </p>
                <button
                  type="button"
                  onClick={() => setQrOpen(false)}
                  className={`mt-4 w-full ${BTN_CLASS}`}
                  style={btnStyle("secondary")}
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl" style={{ background: "#FFF9EC", border: "1px solid #F0DCA8", padding: "14px 15px" }}>
            <h3 style={{ ...UI_CARD_TITLE, color: "#0B2540" }}>🏅 공식 점핑파트너</h3>
            {!isOfficialPartner && (
              <>
                <p className="mt-1.5" style={UI_DESC}>
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
                    <li key={b} className="flex items-start gap-1.5" style={UI_DESC}>
                      <span style={{ color: "#2F9E44", fontWeight: 900 }}>✔</span>{b}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {isOfficialPartner && (
              <p className="mt-1.5" style={UI_DESC}>
                공식 파트너 배지 · 우선 리워드 · 점핑매니저 우선 연결 혜택을 받고 계세요.
              </p>
            )}

            {isOfficialPartner ? (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full" style={{ background: "#E8F8EC", padding: "6px 12px" }}>
                <span style={{ color: "#2F9E44", fontWeight: 900 }}>✔</span>
                <span style={{ ...UI_LINK, color: "#2F9E44" }}>공식 점핑파트너입니다</span>
              </div>
            ) : partnerStatus === "pending" ? (
              <div className="flex items-center gap-2.5 mt-2.5 rounded-xl" style={{ background: "#FFF4E0", padding: "12px 13px" }}>
                <span className="font-bold flex-shrink-0 rounded" style={{ fontSize: rem(14), padding: "3px 9px", background: "#F5E3BC", color: "#966B00" }}>심사중</span>
                <span className="flex-1" style={UI_DESC}>
                  신청서를 검토하고 있어요. 보통 2영업일 안에 결과를 알려드립니다.
                </span>
              </div>
            ) : partnerStatus === "rejected" ? (
              <p className="mt-2.5 rounded-xl text-center" style={{ background: "#F5F6F8", padding: "10px", ...UI_DESC }}>
                신청이 반려되었어요. 문의는 점핑매니저에게 연락주세요.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2.5">
                <input
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: FORM_INPUT_FONT_SIZE }}
                  placeholder="업종/사업형태 (예: 냉동수산물 도매)"
                  value={partnerForm.businessType}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, businessType: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl outline-none"
                  style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: FORM_INPUT_FONT_SIZE }}
                  placeholder="채널 정보 (카카오톡 채널/블로그 URL 등)"
                  value={partnerForm.channelInfo}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, channelInfo: e.target.value }))}
                />
                <textarea
                  className="w-full rounded-xl outline-none resize-none"
                  style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: FORM_INPUT_FONT_SIZE, lineHeight: 1.5, height: 80 }}
                  placeholder="추가로 전달하고 싶은 내용 (선택)"
                  value={partnerForm.message}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, message: e.target.value }))}
                />
                {partnerError && <p style={{ fontSize: rem(15), color: "var(--color-orange)" }}>{partnerError}</p>}
                <button
                  onClick={submitPartnerRequest}
                  disabled={partnerSubmitting}
                  className={`w-full ${BTN_CLASS}`}
                  style={btnStyle("primary")}
                >
                  {partnerSubmitting ? "신청 중..." : "공식 점핑파트너 신청하기"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 mt-4 mb-2">
            <p style={UI_DESC}>
              내가 추천한 회원은 여기서 확인할 수 있어요.
            </p>
            {/* 2026-09-27: 추천 0명일 때도 링크는 항상 보이게 — 대시보드
                (/mypage/referrals)가 0명 상태를 이미 잘 보여주고 있어서, 첫
                추천이 생기기 전까지 진입로 자체를 숨길 이유가 없음. */}
            <Link href="/mypage/referrals" className="flex-shrink-0" style={{ ...UI_LINK, color: "#E25100" }}>
              대시보드 열기 →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {referrals.length === 0 ? (
              // 2026-09-28: 기존엔 회색 텍스트 한 줄이라 눈에 잘 안 띈다는 피드백 —
              // 깜빡임 대신, 이미 있는 보너스 배너(🎉 ...늘었어요)와 같은 스타일
              // (연한 배경 박스+아이콘+볼드)로 통일. "위 링크"는 이 문단과 실제
              // 버튼(링크복사/공유/QR) 사이에 "공식 점핑파트너" 카드가 끼어 있어
              // 위치상 멀어서 헷갈릴 수 있어 "링크 복사·공유 버튼"으로 직접 지칭.
              // 2026-09-29: 금색 굵은 강조는 사진 슬롯 안내 한 곳만 — 이 안내는 일반 굵기·회색 톤
              <div
                className="flex items-center gap-2.5 rounded-xl"
                style={{ background: "#F5F6F8", border: "1px solid #E4E7EB", padding: "12px 14px" }}
              >
                <span className="text-lg flex-shrink-0">📣</span>
                <p style={UI_DESC}>
                  아직 추천으로 가입한 회원이 없어요. 위쪽 링크 복사·공유 버튼으로 친구에게 보내보세요!
                </p>
              </div>
            ) : (
              <>
                {referrals.slice(0, 3).map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white border border-gray200 rounded-xl px-4 py-3"
                  >
                    <div>
                      <div style={UI_CARD_TITLE}>
                        {r.member_no != null ? formatMemberNo(r.member_no) : "회원번호 없음"}
                        {r.company_name && (
                          <span className="font-medium ml-1.5" style={UI_META}>{r.company_name}</span>
                        )}
                      </div>
                      <div className="mt-0.5" style={UI_META}>
                        {r.phone}
                        {" · "}
                        {new Date(r.created_at).toLocaleDateString("ko-KR")} 가입
                        {r.is_business && " · 사업자"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className="font-bold px-2.5 py-1 rounded-full"
                        style={{ fontSize: rem(14), background: "#E8F8EC", color: "#1D8A44" }}
                      >
                        가입완료
                      </span>
                      {r.business_verified && (
                        <span
                          className="font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                          style={{ fontSize: rem(14), background: "#E8F8EC", color: "#1D8A44" }}
                        >
                          <CheckCircle className="w-3 h-3" /> 인증된 사업자
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {referrals.length > 3 && (
                  <Link
                    href="/mypage/referrals"
                    className="text-center py-2"
                    style={{ ...UI_LINK, color: "#6B7480" }}
                  >
                    +{referrals.length - 3}명 더 보기 →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <div id="alerts" className="border-t border-gray200 pt-5 flex flex-col gap-3">
          <PushStatusCard />
          <div>
          <button
            type="button"
            onClick={() => setAlertsOpen((v) => !v)}
            className="w-full flex items-center gap-3 rounded-2xl text-left"
            style={{ border: "1px solid #E4E7EB", padding: "15px 16px" }}
          >
            <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: "#FDEEE8", fontSize: rem(17) }}>🔔</span>
            <span className="flex-1 min-w-0">
              <span className="block" style={UI_CARD_TITLE}>내 알림 조건</span>
              {/* 2026-09-29: "외 5" 식 과한 말줄임 대신 이름을 다 쓰고 2줄까지 */}
              <span className="block mt-0.5" style={{ ...UI_DESC, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {categories.length === 0 || categories.length === mockCategories.length ? "전체 카테고리" : categories.join("·")}
                {" · "}
                {regions.length === 0 || regions.length === mockRegions.length ? "전 지역" : regions.join("·")}
              </span>
            </span>
            <span className="flex-shrink-0 whitespace-nowrap" style={{ ...UI_LINK, color: "#6B7480" }}>{alertsOpen ? "접기 ▲" : "변경하기 ›"}</span>
          </button>

          {alertsOpen && (
            <div className="mt-3.5 flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={UI_CARD_TITLE}>관심 카테고리</span>
                  <button
                    type="button"
                    onClick={() => setCategories(categories.length === mockCategories.length ? [] : [...mockCategories])}
                    className="text-orange"
                    style={UI_LINK}
                  >
                    {categories.length === mockCategories.length ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
                {/* 2026-09-27: 가입(signup) 카테고리 선택 화면과 톤을 맞춤 — 배경을
                    꽉 채우는 대신 흰 배경 고정 + 선택 시 테두리(라인)만 주황으로
                    두껍게 바꾸는 방식. 아이콘도 카테고리별 색 뱃지로 통일. */}
                <div className="grid grid-cols-3 gap-2">
                  {mockCategories.map((c) => {
                    const picked = categories.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggle(categories, setCategories, c)}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 px-1 text-center"
                        style={{
                          background: "#fff",
                          border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                        }}
                      >
                        <span
                          className="rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ width: 30, height: 30, fontSize: rem(15), background: categoryColors[c].bg }}
                        >
                          {categoryIcons[c]}
                        </span>
                        <span className="font-bold leading-tight" style={{ fontSize: rem(15), color: "#1A1F26" }}>
                          {c}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={UI_CARD_TITLE}>관심 지역</span>
                  <button
                    type="button"
                    onClick={() => setRegions(regions.length === mockRegions.length ? [] : [...mockRegions])}
                    className="text-orange"
                    style={UI_LINK}
                  >
                    {regions.length === mockRegions.length ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
                <p className="mb-2" style={UI_DESC}>선택 안 하면 전국 매물 알림을 다 받아요</p>
                {/* 2026-09-28: 위 카테고리 칩(2026-09-27에 signup과 톤을 맞춤)과
                    달리 이 지역 칩만 옛날 스타일(선택 시 배경 꽉 채움)로 남아있어
                    어긋난다는 피드백 — signup 관심지역 칩과 동일하게 흰 배경 고정 +
                    선택 시 테두리만 두껍게 바꾸는 방식으로 통일. */}
                <div className="grid grid-cols-4 gap-2">
                  {mockRegions.map((r) => {
                    const picked = regions.includes(r);
                    return (
                      <button
                        key={r}
                        onClick={() => toggle(regions, setRegions, r)}
                        className="py-2.5 rounded-full font-bold text-center"
                        style={{
                          fontSize: rem(15),
                          background: "#fff",
                          border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                          color: "#1A1F26",
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* 2026-09-28: 긴급 공지(부동산·설비 처분) 알림 — "내 알림 조건"(카테고리/
            지역 매칭)과 완전히 별개의 opt-in이라, 헷갈리지 않도록 별도 카드로
            분리. 기본 꺼짐 — 무분별한 전체발송으로 재고 알림 피로도가 올라가는
            걸 막기 위함. */}
        <div className="rounded-2xl p-4" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
          <button
            type="button"
            onClick={toggleNoticeAlerts}
            disabled={noticeAlertsSaving}
            className="w-full flex items-center gap-3 disabled:opacity-60"
          >
            {/* 2026-09-29: 설명이 토글 밑으로 겹치던 문제 — 글자 영역(flex-1)과 토글(shrink-0) 분리 */}
            <span className="flex-1 min-w-0 text-left">
              <span className="block" style={UI_CARD_TITLE}>긴급 공지 알림</span>
              <span className="block mt-0.5" style={UI_DESC}>
                폐업·정리 부동산·설비 소식 — 재고 매물 알림과 별개예요
              </span>
            </span>
            <span
              className="flex-shrink-0 rounded-full relative"
              style={{
                width: 42,
                height: 24,
                background: noticeAlertsOptIn ? "var(--color-brandOrange)" : "#E4E7EB",
                transition: "background 0.15s",
              }}
            >
              <span
                className="absolute rounded-full bg-white"
                style={{
                  width: 18,
                  height: 18,
                  top: 3,
                  left: noticeAlertsOptIn ? 21 : 3,
                  transition: "left 0.15s",
                  boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                }}
              />
            </span>
          </button>
        </div>

        {alertLog.length > 0 && (
          <div id="alert-log-section">
            <div className="flex items-center justify-between mb-2.5">
              <span style={UI_SECTION}>최근 받은 알림</span>
              <span style={UI_META}>최근 활동</span>
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
                      <span className="block truncate" style={{ ...UI_LINK, color: "#1A1F26" }}>{a.deals.title}</span>
                      <span className="block mt-0.5" style={UI_META}>
                        {formatRelativeTime(a.sent_at)} · {a.deals.categories?.name ?? "기타"}
                        {discount > 0 && ` · -${discount}%`}
                      </span>
                    </span>
                    <span
                      className="flex-shrink-0 font-bold"
                      style={{ fontSize: rem(14), color: closed ? "#6B7480" : urgent ? "var(--color-urgent)" : "var(--color-verified)" }}
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
          className={`w-full ${BTN_CLASS}`}
          style={btnStyle("primary")}
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
        {saveError && <div className="text-orange font-medium" style={{ fontSize: rem(15) }}>{saveError}</div>}

        <div id="interests-section" className="border-t border-gray200 pt-5">
          <div className="mb-3" style={SECTION_TITLE_STYLE}>
            관심 표시한 매물 ({interests.length})
          </div>
          {interests.length === 0 && (
            <div className="text-center py-6" style={UI_DESC}>
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
                  <div className="min-w-0">
                    <div className="truncate" style={UI_CARD_TITLE}>{i.deals.title}</div>
                    <div className="mt-0.5" style={{ ...UI_LINK, color: "#0B2540" }}>
                      {formatDealPrice(i.deals.deal_price, i.deals.quantity_unit, i.deals.price_unit)}
                    </div>
                  </div>
                  <span
                    className="font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={
                      i.deals.status === "active"
                        ? { fontSize: rem(14), background: "#E8F8EC", color: "#1D8A44" }
                        : { fontSize: rem(14), background: "#F5F6F8", color: "#6B7480" }
                    }
                  >
                    {i.deals.status === "active" ? "진행중" : "마감"}
                  </span>
                </Link>
              ) : null
            )}
          </div>
        </div>

        {MESSAGES_ENABLED && (
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
                    maxLength={1000}
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
        )}

        <MyBuyRequests />

        {/* design-v2: 홈 화면 "잠든 재고" 카드와 동일 스타일로 일괄 정리 —
            배경 화이트 + 서브텍스트를 이모지 폭(24px)만큼 들여씀. */}
        <div className="border-t border-gray200 pt-5">
          <Link
            href="/sell"
            className="flex items-center justify-between rounded-2xl"
            style={{ background: "#fff", border: "2px solid #FF6F0F", padding: "16px 20px" }}
          >
            <div>
              <div style={UI_CARD_TITLE}>
                <span className="inline-block" style={{ width: 24 }}>📦</span>
                긴급 매물 등록하기
              </div>
              <div className="font-bold mt-0.5" style={{ fontSize: rem(15), color: "#C2410C", marginLeft: 24 }}>
                남는 재고 있으세요? 무료로 바로 등록
              </div>
            </div>
            <span className="text-xl" style={{ color: "#FF6F0F" }}>→</span>
          </Link>
        </div>

        {/* design-v2: /deals 헤더에 있던 "정부지원금" 링크를 이동 — 매물 탐색 화면과
            성격이 다른(사업자 지원사업 정보) 기능이라 마이페이지 메뉴로 옮겨서 정리.
            /support는 이미 /api/support로 기업마당 연동 로직이 있어 "준비중"이 아님.
            타일 3개(화물배차/계산기/정부지원금)는 홈 화면과 마크업이 완전히 겹쳐서
            <EcosystemGrid />로 추출함 (2026-09-26). ("사업자 전용" 배지는 실제
            접근 제한이 없어 제거 — 위 커밋 참고).
            2026-09-28: 홈 화면엔 "점핑 서비스" 라벨이 있는데 마이페이지엔 없어서
            같은 타일 그룹인데도 소속감이 없어 보인다는 피드백 — 홈과 동일하게
            라벨 추가. */}
        <div id={SERVICES_ANCHOR_ID} className="border-t border-gray200 pt-5" style={{ scrollMarginTop: 12 }}>
          <div className="mb-2.5" style={SECTION_TITLE_STYLE}>점핑 서비스</div>
          <EcosystemGrid />

          {/* 2026-09-29: "견적함 · 준비중"(누르면 토스트만) → "곧 오픈" 예고 카드 + 오픈 알림 신청.
              실제 견적함이 생기면 QUOTES_ENABLED = true로 바꾸고 이 자리에 진짜 진입점을 둘 것. */}
          {!QUOTES_ENABLED && (
            <div className="mt-2.5">
              <QuotesTeaserCard memberId={memberId} />
            </div>
          )}
        </div>

        {/* 2026-09-29: 회원 로그아웃 — 이 기기에서만(scope local, 다른 기기·설치 앱 세션은 유지).
            명시적 로그아웃이라 재방문 화면 신호(로그인 기록·방식)도 지움 */}
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className={`w-full ${BTN_CLASS}`}
          style={btnStyle("secondary")}
        >
          {loggingOut ? "로그아웃 중…" : "로그아웃"}
        </button>
        <Link href="/unsubscribe" className="text-center underline py-2" style={{ ...UI_LINK, fontWeight: 500, color: "#6B7480" }}>
          알림이 필요 없으신가요? 알림 해지 · 탈퇴
        </Link>
      </div>

      <Toast message={toastMessage} />
    </main>
  );
}
