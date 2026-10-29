"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BusinessFooter from "@/components/BusinessFooter";
import { CheckCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockCategories, categoryIcons, categoryColors } from "@/lib/mockData";
import { formatMemberNo, formatRelativeTime, dealUrgencyState } from "@/lib/format";
import { dealPriceLabel, isNegotiable } from "@/lib/priceMode";
import Toast, { useToast } from "@/components/Toast";
import BusinessLicenseUploader from "@/components/BusinessLicenseUploader";
import { SERVICE_TILES, SERVICES_ANCHOR_ID, scrollToServicesIfHash } from "@/components/EcosystemGrid";
import PushStatusCard from "@/components/PushStatusCard";
import ConsentToggles from "@/components/ConsentToggles";
import { CONSENT_CHANGED_EVENT, fetchMyConsents } from "@/lib/consentClient";
import { fetchPushStatus, getPushState } from "@/lib/pushClient";
import { MESSAGES_ENABLED, QUOTES_ENABLED } from "@/lib/features";
import QuotesTeaserCard from "@/components/QuotesTeaserCard";
import MyBuyRequests from "@/components/MyBuyRequests";
import LoginRequired from "@/components/LoginRequired";
import MyHeadTop from "@/components/MyHeadTop";
import { resizeImageForUpload } from "@/lib/resizeImage";
import { debugLog } from "@/lib/debugLog"; // TEMP DEBUG — 세션 소실 버그 진단용, 원인 확인되면 제거
import { rem } from "@/lib/rem";
import { formatPhone } from "@/lib/phone";
import { authFetch } from "@/lib/authFetch";
import { clearReturningMember } from "@/lib/returningMember";
import { navReplace } from "@/lib/appNav";
import { FieldLabel } from "@/components/FormField";
import { BTN_CLASS } from "@/lib/uiText";
import {
  MY_BADGE,
  MY_CARD_TITLE,
  MY_DESC,
  MY_GROUP,
  MY_HEAD_BADGE,
  MY_HEAD_BG,
  MY_HEAD_EDIT,
  MY_HEAD_LABEL,
  MY_HEAD_NAME,
  MY_HEAD_NUM,
  MY_HEAD_SUB,
  MY_INPUT_FONT_SIZE,
  MY_LINK,
  MY_META,
  MY_PANEL_BG,
  MY_ROW,
  MY_ROW_RIGHT,
  MY_TILE_DESC,
  MY_TILE_TITLE,
  myBtnStyle,
} from "@/lib/myText";

type InterestItem = {
  id: string;
  deals: {
    id: string;
    title: string;
    deal_price: number | null; // 2026-10-04 가격 협의(price_mode negotiable)면 null
    price_mode?: string | null;
    quantity_unit: string | null;
    price_unit: string | null;
    status: string;
  } | null;
};

type AdminInfo = { name: string; role: string };

type AlertLogItem = {
  id: string;
  sent_at: string;
  deals: {
    id: string;
    title: string;
    category_id: number | null;
    deal_price: number | null;
    original_price: number | null;
    price_mode?: string | null;
    closes_at: string;
    categories: { name: string } | null;
  } | null;
};

// 2026-10-12 feat/my-menu-share: MY를 당근식 메뉴로 — 행을 누르면 그 자리에서 펼침(새 화면 없음, 한 번에 하나, 펼침 상태 기억 안 함).
// 점핑파트너(추천 공유)는 하단 "공유" 탭 /share로 분리.
type MenuKey = "interests" | "buyRequests" | "alerts" | "password";

const ROW_PAD = "0 22px";
const DIVIDER = "1px solid #F1F2F4";

function MenuGroup({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="bg-white" style={{ scrollMarginTop: 12 }}>
      <h2 style={{ ...MY_GROUP, padding: "18px 22px 6px" }}>{title}</h2>
      {children}
    </section>
  );
}

// 메뉴 행 — 최소 높이 60 · 좌우 22 · 아이콘 24 · 이름 20/700 · 오른쪽 상태 글자 또는 ›(펼침 행은 펼치면 아래로 돎)
function MenuRow({
  icon,
  label,
  right,
  open,
  onClick,
  href,
  labelStyle,
  first,
  chevron = true,
  data,
}: {
  icon?: ReactNode;
  label: ReactNode;
  right?: ReactNode;
  open?: boolean;
  onClick?: () => void;
  href?: string;
  labelStyle?: CSSProperties;
  first?: boolean;
  chevron?: boolean;
  data?: string;
}) {
  const inner = (
    <>
      {icon !== undefined && (
        <span aria-hidden className="flex-shrink-0 flex items-center justify-center" style={{ width: 24, fontSize: 22, lineHeight: 1 }}>
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0" style={{ ...MY_ROW, ...labelStyle }}>{label}</span>
      {right !== undefined && <span className="flex-shrink-0 whitespace-nowrap" style={MY_ROW_RIGHT}>{right}</span>}
      {chevron && (
        <span
          aria-hidden
          className="flex-shrink-0"
          style={{ ...MY_ROW_RIGHT, display: "inline-block", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}
        >
          ›
        </span>
      )}
    </>
  );
  const cls = "w-full flex items-center gap-3 text-left";
  const style = { minHeight: 60, padding: ROW_PAD, borderTop: first ? undefined : DIVIDER };
  if (href) {
    return (
      <Link href={href} className={cls} style={style} data-my-row={data}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style} aria-expanded={open} data-my-row={data}>
      {inner}
    </button>
  );
}

// 펼친 패널 — 바탕 #FFF7ED, 글자 17.5 #4B5563
function MenuPanel({ children, data }: { children: ReactNode; data?: string }) {
  return (
    <div data-my-panel={data} style={{ background: MY_PANEL_BG, padding: "16px 22px 20px", ...MY_DESC }}>
      {children}
    </div>
  );
}

// 머리 "성명 · 회원번호" 사이 가운뎃점 — 폭 1.1em 고정(바깥 -1.1em과 짝)
function HeadSep() {
  return (
    <span aria-hidden style={{ display: "inline-block", width: "1.1em", textAlign: "center" }}>
      ·
    </span>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className="flex-shrink-0 rounded-full relative"
      style={{ width: 46, height: 26, background: on ? "var(--color-brandOrange)" : "#E4E7EB", transition: "background 0.15s" }}
    >
      <span
        className="absolute rounded-full bg-white"
        style={{ width: 20, height: 20, top: 3, left: on ? 23 : 3, transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}
      />
    </span>
  );
}

// 펼친 패널 안 카드(푸시 상태·수신 동의 등)가 조금 늦게 그려져 자리가 밀리므로(2026-10-10 실측 0.7초 뒤 약 190px)
// 1.5초 동안 두 번 더 맞춤 — 사용자가 직접 스크롤하면 멈춤
function settleScrollTo(id: string, fallbackId?: string) {
  let userMoved = false;
  const stop = () => {
    userMoved = true;
  };
  window.addEventListener("touchstart", stop, { once: true, passive: true });
  window.addEventListener("wheel", stop, { once: true, passive: true });
  const go = () => {
    if (userMoved) return;
    const el = document.getElementById(id) ?? (fallbackId ? document.getElementById(fallbackId) : null);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  setTimeout(go, 60);
  setTimeout(go, 700);
  setTimeout(go, 1500);
}

const GROUP_GAP = <div aria-hidden style={{ height: 8, background: "#F2F4F6" }} />;

export default function MyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [memberNo, setMemberNo] = useState<number | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [open, setOpen] = useState<MenuKey | null>(null);
  const toggleOpen = (k: MenuKey) => setOpen((cur) => (cur === k ? null : k));
  // 2026-09-28: 긴급 공지(부동산·설비 처분) 알림 — 기존 카테고리 매칭 알림과 완전히 별개의 opt-in.
  // 무분별한 전체발송으로 재고 알림 피로도가 올라가는 걸 막기 위해 기본 꺼짐, 회원이 직접 켜야만 받는다.
  const [noticeAlertsOptIn, setNoticeAlertsOptIn] = useState(false);
  const [noticeAlertsSaving, setNoticeAlertsSaving] = useState(false);
  // 2026-09-30: 긴급 공지도 sendNoticePush가 deal_alert_ad 동의 회원에게만 보냄 — 동의 없으면 토글을 흐리게(값은 그대로 둠)
  const [dealConsent, setDealConsent] = useState<boolean | null>(null); // null = 모름(조회 전·실패)
  const noticeLocked = dealConsent === false;
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [alertLog, setAlertLog] = useState<AlertLogItem[]>([]);
  const [alertLogCount, setAlertLogCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [businessVerified, setBusinessVerified] = useState(false);
  const [hasBusinessLicense, setHasBusinessLicense] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  // 2026-09-27: 재접속마다 휴대폰 OTP 인증(SMS)을 다시 받아야 하는 게 번거롭다는 피드백 — "기억하는 비밀번호"가 유일한 대안.
  // Supabase Auth가 phone 계정에 비밀번호를 얹는 걸 기본 지원해서(updateUser) 여기서 설정 → /login에서 signInWithPassword.
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  // 푸시 상태 카드를 "알림" 그룹 위에 항상 둘지 — 이 기기가 꺼짐·차단·미구독(또는 매물 알림 동의 없음)이면 true.
  // null = 확인 전. 한 번 true가 되면 이 화면에선 계속 위에 둠(켠 직후 카드가 패널 안으로 숨어 사라지지 않게)
  const [pushPinned, setPushPinned] = useState<boolean | null>(null);
  const { message: toastMessage, showToast } = useToast();

  useEffect(() => {
    const load = () =>
      fetchMyConsents().then((c) => {
        if (c) setDealConsent(Boolean(c.deal_alert_ad?.agreed));
      });
    load();
    window.addEventListener(CONSENT_CHANGED_EVENT, load);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, load);
  }, []);

  useEffect(() => {
    if (dealConsent === false) setPushPinned(true);
  }, [dealConsent]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    // 2026-10-12: 점핑파트너가 /share로 분리 — 옛 주소(/mypage#referral)는 공유 화면으로 바꿔 엶
    if (window.location.hash === "#referral") {
      navReplace(router, "/share");
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
        .select("phone, member_no, company_name, name, email, business_verified, business_license_path, avatar_url, notice_alerts_opt_in")
        .eq("id", userId)
        .single();
      if (member) {
        setPhone(formatPhone(member.phone)); // 표시 전용 — 저장 형식이 섞여 있어 "010-1234-5678"로 통일
        setMemberNo(member.member_no);
        setCompanyName(member.company_name ?? "");
        setFullName(member.name ?? "");
        setEmail(member.email ?? "");
        setBusinessVerified(Boolean(member.business_verified));
        setHasBusinessLicense(Boolean(member.business_license_path));
        setAvatarUrl(member.avatar_url ?? null);
        setNoticeAlertsOptIn(Boolean(member.notice_alerts_opt_in));
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

      const { data: interestRows } = await supabase
        .from("interests")
        .select("id, deals(id, title, deal_price, price_mode, quantity_unit, price_unit, status)")
        .eq("member_id", userId)
        .order("created_at", { ascending: false });
      setInterests((interestRows as unknown as InterestItem[]) ?? []);

      const { data: alertLogRows, count: alertLogTotal } = await supabase
        .from("notification_logs")
        .select("id, sent_at, deals(id, title, category_id, deal_price, original_price, price_mode, closes_at, categories(name))", { count: "exact" })
        .eq("member_id", userId)
        .order("sent_at", { ascending: false })
        .limit(5);
      setAlertLog((alertLogRows as unknown as AlertLogItem[]) ?? []);
      setAlertLogCount(alertLogTotal ?? 0);

      authFetch("/api/is-admin")
        .then((res): Promise<{ isAdmin?: boolean; name?: string; role?: string }> => (res.ok ? res.json() : Promise.resolve({})))
        .then((data) => {
          if (data.isAdmin) setAdminInfo({ name: data.name ?? "", role: data.role ?? "" });
        })
        .catch(() => {});

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이 기기 푸시 상태(읽기 전용 — 권한 요청·저장 없음, 회원 홈 useAlertsOn과 같은 판정)
  useEffect(() => {
    if (loading || notLoggedIn) return;
    let cancelled = false;
    (async () => {
      const s = await getPushState();
      let ok = false;
      if (s.status === "subscribed") {
        const st = await fetchPushStatus(s.subscription.endpoint ?? null);
        ok = Boolean(st && st.thisDeviceSaved && !st.optedOut);
      }
      if (!cancelled) setPushPinned((p) => (p === true ? true : !ok));
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, notLoggedIn]);

  // 해시로 들어온 경우 — 해당 메뉴를 펼친 채 그 자리로.
  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const hash = window.location.hash;
    scrollToServicesIfHash(); // 매물 상세 "점핑 서비스 · 전체 보기"
    if (hash === "#alerts") {
      setOpen("alerts");
      settleScrollTo("alerts");
    }
    // 로그인 화면 권유 시트의 [지금 만들기] → /mypage#password: 비밀번호 설정을 바로 펼침
    if (hash === "#password") {
      setOpen("password");
      settleScrollTo("account");
    }
    // 2026-10-10: 매물 상세 ♥ 담기 안내 "보기 ›" → 관심 표시한 매물(펼친 채)
    if (hash === "#interests-section") {
      setOpen("interests");
      settleScrollTo("interests-section");
    }
    // 2026-10-09 PR 4a: 회원 홈 머리 "내 조건 긴급매물 N건" → 알림 패널을 펼친 채 관심 카테고리 구역으로
    if (hash === "#categories") {
      setOpen("alerts");
      settleScrollTo("alert-categories");
    }
  }, [loading]);

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
      .select("id, deal_id, sender_id, receiver_id, body, created_at, deals(title, seller_display_name)")
      .or(`sender_id.eq.${memberId},receiver_id.eq.${memberId}`)
      .order("created_at", { ascending: true });
    if (!data) return;
    const map = new Map<string, MessageThread>();
    for (const m of data) {
      // 2026-09-30: deals.seller_member_id는 공개 조회 불가(컬럼 권한) — 쪽지를 다시 켤 땐 판매자 판별을 서버 API로 옮길 것
      const dealInfo = m.deals as unknown as { title: string; seller_member_id?: string | null; seller_display_name: string | null } | null;
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

      // 2026-10-04: 지역은 알림 조건이 아님 — member_regions는 건드리지 않음(예전에 저장한 값도 지우지 않음)

      // 2026-10-29: 0개 저장 금지 + 순서 변경 — 예전엔 "전부 지우기 → 다시 넣기"라 중간에 실패하면 0건(알림 끊김)이 됨.
      // 이제 선택 항목을 먼저 반영(upsert, PK member_id+category_id)한 뒤 선택 안 한 것만 지움 → 어느 단계에서 실패해도 0건이 되지 않음
      if (categories.length === 0) {
        setSaveError("카테고리를 1개 이상 골라야 저장할 수 있어요.");
        return;
      }
      const { data: catRows, error: catLookupError } = await supabase.from("categories").select("id, name").in("name", categories);
      if (catLookupError) throw catLookupError;
      if (!catRows?.length) throw new Error("categories not found"); // 못 찾았으면 아무것도 지우지 않고 실패 처리
      const { error: upsertCatError } = await supabase
        .from("member_categories")
        .upsert(catRows.map((c) => ({ member_id: userId, category_id: c.id })), { onConflict: "member_id,category_id", ignoreDuplicates: true });
      if (upsertCatError) throw upsertCatError;
      const { error: delCatError } = await supabase
        .from("member_categories")
        .delete()
        .eq("member_id", userId)
        .not("category_id", "in", `(${catRows.map((c) => c.id).join(",")})`);
      if (delCatError) throw delCatError;
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

  // 2026-09-28: 별도 "저장" 버튼 없이, 스위치를 누르는 즉시 반영 — 체크박스 하나짜리 설정이라 저장 단계를 더 두면 오히려 번거로움.
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
    setTimeout(() => setPasswordSaved(false), 4000);
  };

  // 2026-09-27: 프로필 사진은 작게만 보이므로 업로드 전 브라우저에서 축소(Vercel 요청 본문 한도 4.5MB) — 아바타 전용 크기 640px
  const resizeImageForAvatar = (file: File) => resizeImageForUpload(file, 640, 0.85);

  // 2026-09-27: 프로필 사진 업로드 — 기존 deal-images 업로드 API 재사용, 선택 즉시 업로드+저장. 본인 행 수정이라 members_self_update RLS로 충분.
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
      const res = await authFetch("/api/upload", { formData }); // 2026-09-30: 업로드는 회원 토큰 필수
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

  // 머리 숫자 칸 → 해당 메뉴를 펼친 채 그 자리로
  const openAndScroll = (key: MenuKey, id: string) => {
    setOpen(key);
    settleScrollTo(id, key === "alerts" ? "alerts" : "interests-section");
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">🧪</div>
        <h1 className="font-display text-xl text-navy mb-2">데모 모드예요</h1>
        <p className="text-gray500" style={MY_DESC}>
          Supabase가 연결되면 여기서{" "}
          <br className="hidden sm:inline" />
          관심 매물과 알림 설정을 관리할 수 있어요.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen text-gray500" style={MY_DESC}>
        불러오는 중...
      </main>
    );
  }

  if (notLoggedIn) return <LoginRequired />;

  // 2026-10-29: 0개는 "전체"가 아니라 "선택 안 함" — 카테고리를 하나도 안 고르면 새 매물 알림(푸시)도 홈 매칭도 없음(전체 선택은 기존 "전체 카테고리" 그대로)
  const categorySummary =
    categories.length === 0 ? "선택 안 함 · 새 매물 알림이 오지 않아요" : categories.length === mockCategories.length ? "전체 카테고리" : categories.join("·");
  const pushCard = <PushStatusCard />;

  return (
    <main className="flex flex-col min-h-screen">
      <div className="px-5 pt-5 pb-5 text-white" style={MY_HEAD_BG}>
        {/* 2026-09-27: buy/sell/deals와 동일한 헤더 구조 — 로고=홈 링크 + Powered by JumpX / 소제목 라벨+로테이션 태그 */}
        <MyHeadTop caption="내 정보" />
        <div className="flex items-center gap-3">
          <div
            className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 56, height: 56, background: "rgba(255,255,255,.14)", fontSize: rem(24) }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="프로필 사진" className="w-full h-full object-cover" />
            ) : (
              "🏪"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate" data-my-head-name style={MY_HEAD_NAME}>
              {companyName || phone || "회원님"}
            </div>
            {/* 성명 · 회원번호 — 칸마다 앞에 가운뎃점을 붙이고 바깥에서 왼쪽 1.1em을 잘라, 줄 맨 앞 칸의 점은 안 보이게.
                가운뎃점+회원번호는 한 덩어리(nowrap)로 같이 줄바꿈 — 글자 130%에서 "· 회원번호"가 줄 맨 앞에 오던 것 */}
            <div className="mt-1 overflow-hidden" style={MY_HEAD_SUB}>
              <div className="flex items-center flex-wrap" style={{ marginLeft: "-1.1em" }}>
                {companyName && fullName && (
                  <span data-my-head-sep-item>
                    <HeadSep />
                    <span style={MY_HEAD_SUB}>성명 {fullName}</span>
                  </span>
                )}
                {memberNo != null && (
                  <span className="whitespace-nowrap" data-my-head-sep-item>
                    <HeadSep />
                    <span style={MY_HEAD_SUB}>
                      회원번호 <span className="font-mono">{formatMemberNo(memberNo)}</span>
                    </span>
                  </span>
                )}
              </div>
            </div>
            {/* 2026-09-27: 신뢰 신호(사업자 인증·관리자) 배지 */}
            {((businessVerified || hasBusinessLicense) || adminInfo) && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {(businessVerified || hasBusinessLicense) && (
                  <span
                    className="rounded-md"
                    style={{
                      ...MY_HEAD_BADGE,
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
                    className="rounded-md inline-flex items-center gap-1"
                    style={{ ...MY_HEAD_BADGE, padding: "4px 10px", background: "rgba(255,209,102,.2)", color: "#FFD166" }}
                    title={`관리자 화면 · ${adminInfo.name}`}
                    data-admin-badge
                  >
                    🛡️ 관리자
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 숫자 칸 2개(받은 알림·관심 매물) — 누르면 그 메뉴를 펼친 채 그 자리로. 2026-10-12: 추천 회원 칸은 /share 머리로 */}
        <div className="flex gap-2 mt-4.5">
          {[
            { key: "alerts" as const, target: "alert-log-section", icon: "🔔", n: alertLogCount, label: "받은 알림" },
            { key: "interests" as const, target: "interests-section", icon: "❤️", n: interests.length, label: "관심 매물" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              data-my-stat={t.key}
              onClick={() => openAndScroll(t.key, t.target)}
              className="flex-1 min-w-0 rounded-xl text-center"
              style={{ background: "rgba(255,255,255,.1)", padding: "12px 8px", border: "none" }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span style={{ fontSize: rem(17) }}>{t.icon}</span>
                <span className="font-mono" style={{ ...MY_HEAD_NUM, color: "var(--color-brandOrangeAccent)" }}>{t.n}</span>
              </div>
              <div className="mt-1" style={MY_HEAD_LABEL}>{t.label}</div>
            </button>
          ))}
        </div>

        {/* 2026-10-12: 이메일 줄 삭제(이메일은 정보 수정 화면 안에) · "비밀번호 설정"은 아래 계정 메뉴로 */}
        {profileComplete && !editingProfile && (
          <div className="flex justify-end mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}>
            <button type="button" onClick={() => setEditingProfile(true)} className="whitespace-nowrap" style={MY_HEAD_EDIT} data-my-edit>
              정보 수정 ›
            </button>
          </div>
        )}
      </div>

      {(!profileComplete || editingProfile) && (
        <div className="px-5 py-5 flex flex-col gap-4" data-my-profile-form>
          <div>
            <div className="mb-1" style={MY_CARD_TITLE}>{profileComplete ? "정보 수정" : "프로필 완성하기"}</div>
            <p style={MY_DESC}>
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
                <label className="rounded-lg cursor-pointer text-navy" style={{ ...MY_LINK, padding: "8px 14px", border: "2px solid #E4E7EB" }}>
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
                  <button type="button" onClick={handleAvatarRemove} className="underline text-left" style={MY_META}>
                    기본 아이콘으로 되돌리기
                  </button>
                )}
              </div>
            </div>
            {avatarError && <p className="text-orange mt-1.5" style={{ fontSize: rem(16) }}>{avatarError}</p>}
          </div>

          <div>
            <FieldLabel need="optional">상호명</FieldLabel>
            <input
              className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
              style={{ height: "54px", fontSize: MY_INPUT_FONT_SIZE }}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="예: 웰컴코리아(주)"
            />
          </div>

          <div>
            <FieldLabel need="optional">성명</FieldLabel>
            <input
              className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
              style={{ height: "54px", fontSize: MY_INPUT_FONT_SIZE }}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="담당자 성함"
            />
          </div>

          <div>
            <FieldLabel need="optional">이메일</FieldLabel>
            <input
              type="email"
              data-my-email
              className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
              style={{ height: "54px", fontSize: MY_INPUT_FONT_SIZE }}
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
            <button onClick={saveProfile} disabled={profileSaving} className={`flex-1 ${BTN_CLASS}`} style={myBtnStyle("primary")}>
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
              <button type="button" onClick={() => setEditingProfile(false)} className={BTN_CLASS} style={myBtnStyle("secondary")}>
                취소
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col" style={{ background: "#F2F4F6" }}>
        {/* ── 내 거래 ── */}
        <MenuGroup title="내 거래">
          <div id="interests-section" style={{ scrollMarginTop: 12 }}>
            <MenuRow
              first
              data="interests"
              icon="♡"
              label="관심 표시한 매물"
              right={`${interests.length}개`}
              open={open === "interests"}
              onClick={() => toggleOpen("interests")}
            />
            {open === "interests" && (
              <MenuPanel data="interests">
                {interests.length === 0 ? (
                  <p className="text-center py-2">아직 관심 표시한 매물이 없어요.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {interests.map((i) =>
                      i.deals ? (
                        <Link
                          key={i.id}
                          href={`/deals/${i.deals.id}`}
                          className="bg-white border border-gray200 rounded-xl px-4 py-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate" style={MY_CARD_TITLE}>{i.deals.title}</div>
                            <div className="mt-0.5 truncate" style={{ ...MY_LINK, color: "#0B2540" }}>
                              {dealPriceLabel(i.deals)}
                            </div>
                          </div>
                          <span
                            className="px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                            style={
                              i.deals.status === "active"
                                ? { ...MY_BADGE, background: "#E8F8EC", color: "#1D8A44" }
                                : { ...MY_BADGE, background: "#F5F6F8", color: "#6B7480" }
                            }
                          >
                            {i.deals.status === "active" ? "진행중" : "마감"}
                          </span>
                        </Link>
                      ) : null
                    )}
                  </div>
                )}
              </MenuPanel>
            )}
          </div>
          <MenuRow data="buyRequests" icon="🔍" label="내 구매 요청" open={open === "buyRequests"} onClick={() => toggleOpen("buyRequests")} />
          {open === "buyRequests" && (
            <MenuPanel data="buyRequests">
              <MyBuyRequests inMenu />
            </MenuPanel>
          )}
          {/* 예전 "긴급 매물 등록하기" 카드와 같은 이동(/sell) */}
          <MenuRow data="sell" icon="＋" label="매물 등록하기" href="/sell" />
        </MenuGroup>

        {GROUP_GAP}

        {/* ── 알림 ── 푸시가 꺼짐·차단·미구독이면 상태 카드를 그룹 위에 항상 보이게 */}
        <div id="alerts" style={{ scrollMarginTop: 12 }}>
          {pushPinned === true && (
            <div className="bg-white" data-push-pinned style={{ padding: "16px 22px 2px" }}>
              {pushCard}
            </div>
          )}
          <MenuGroup title="알림">
            <MenuRow
              first
              data="alerts"
              icon="🔔"
              label="알림 받기·조건"
              right={categories.length === 0 ? "선택 안 함" : categories.length === mockCategories.length ? "전체" : `${categories.length}개`}
              open={open === "alerts"}
              onClick={() => toggleOpen("alerts")}
            />
            {open === "alerts" && (
              <MenuPanel data="alerts">
                <div className="flex flex-col gap-3">
                  {pushPinned === false && pushCard}
                  <ConsentToggles />
                  <div id="alert-categories" className="rounded-2xl p-4 bg-white" style={{ border: "1px solid #E4E7EB", scrollMarginTop: 12 }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span style={MY_CARD_TITLE}>내 알림 조건</span>
                      <button
                        type="button"
                        onClick={() => setCategories(categories.length === mockCategories.length ? [] : [...mockCategories])}
                        className="text-orange whitespace-nowrap"
                        style={MY_LINK}
                      >
                        {categories.length === mockCategories.length ? "전체 해제" : "전체 선택"}
                      </button>
                    </div>
                    <p className="mb-3" style={categories.length === 0 ? { ...MY_META, color: "#B45309", fontWeight: 700 } : MY_META} data-category-summary={categories.length === 0 ? "none" : undefined}>{categorySummary}</p>
                    {/* 2026-09-27: 가입 카테고리 선택 화면과 같은 톤 — 흰 배경 + 선택 시 주황 테두리 */}
                    <div className="grid grid-cols-3 gap-2">
                      {mockCategories.map((c) => {
                        const picked = categories.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggle(categories, setCategories, c)}
                            aria-pressed={picked}
                            className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 px-1 text-center min-w-0"
                            style={{ background: "#fff", border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB" }}
                          >
                            <span
                              className="rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ width: 32, height: 32, fontSize: rem(16), background: categoryColors[c].bg }}
                            >
                              {categoryIcons[c]}
                            </span>
                            <span className="font-bold leading-tight" style={{ fontSize: rem(16), color: "#1A1F26" }}>
                              {c}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={save}
                    disabled={saving || categories.length === 0}
                    aria-describedby={categories.length === 0 ? "category-zero-notice" : undefined}
                    className={`w-full ${BTN_CLASS}`}
                    style={categories.length === 0 ? { ...myBtnStyle("primary"), opacity: 0.45 } : myBtnStyle("primary")}
                    data-my-save
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
                  {/* 2026-10-29: 0개면 저장 막고 이유를 화면 안에 표시(window.confirm 아님) */}
                  {categories.length === 0 && (
                    <div id="category-zero-notice" role="status" className="font-medium" style={{ fontSize: rem(16), color: "#B45309" }} data-category-zero-notice>
                      카테고리를 1개 이상 골라야 저장할 수 있어요. 고르지 않으면 새 매물 알림이 오지 않아요.
                    </div>
                  )}
                  {saveError && <div className="text-orange font-medium" style={{ fontSize: rem(16) }}>{saveError}</div>}

                  {alertLog.length > 0 && (
                    <div id="alert-log-section" className="mt-2" style={{ scrollMarginTop: 12 }}>
                      <div className="flex items-center justify-between mb-2.5">
                        <span style={MY_CARD_TITLE}>최근 받은 알림</span>
                        <span style={MY_META}>최근 활동</span>
                      </div>
                      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E4E7EB", background: "#fff" }}>
                        {alertLog.map((a) => {
                          if (!a.deals) return null;
                          const { closed, urgent } = dealUrgencyState(a.deals.closes_at);
                          const discount =
                            !isNegotiable(a.deals) && a.deals.original_price && a.deals.deal_price != null
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
                                <span className="block truncate" style={{ ...MY_LINK, color: "#1A1F26" }}>{a.deals.title}</span>
                                <span className="block mt-0.5" style={MY_META}>
                                  {formatRelativeTime(a.sent_at)} · {a.deals.categories?.name ?? "기타"}
                                  {discount > 0 && ` · -${discount}%`}
                                </span>
                              </span>
                              <span
                                className="flex-shrink-0 whitespace-nowrap"
                                style={{ ...MY_BADGE, color: closed ? "#6B7480" : urgent ? "var(--color-urgent)" : "var(--color-verified)" }}
                              >
                                {closed ? "마감" : urgent ? "마감임박" : "진행중"}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </MenuPanel>
            )}
            {/* 2026-09-28: 긴급 공지(부동산·설비 처분) — "내 알림 조건"과 별개의 opt-in, 기본 꺼짐. 누르는 즉시 저장 */}
            <button
              type="button"
              onClick={toggleNoticeAlerts}
              disabled={noticeAlertsSaving || noticeLocked}
              aria-pressed={noticeAlertsOptIn}
              data-my-row="notice"
              className={`w-full flex items-center gap-3 text-left ${noticeLocked ? "disabled:opacity-45" : "disabled:opacity-60"}`}
              style={{ minHeight: 60, padding: "10px 22px", borderTop: DIVIDER }}
            >
              <span aria-hidden className="flex-shrink-0 flex items-center justify-center" style={{ width: 24, fontSize: 22, lineHeight: 1 }}>📢</span>
              <span className="flex-1 min-w-0">
                <span className="block" style={MY_ROW}>긴급 공지 알림</span>
                <span className="block mt-0.5" style={MY_META}>폐업·정리 부동산·설비 소식 — 재고 매물 알림과 별개예요</span>
              </span>
              <Switch on={noticeAlertsOptIn} />
            </button>
            {noticeLocked && (
              <p className="font-medium" style={{ fontSize: rem(16), color: "#4B5563", padding: "0 22px 14px 58px" }}>
                매물 알림 수신 동의 후 받을 수 있어요
              </p>
            )}
          </MenuGroup>
        </div>

        {MESSAGES_ENABLED && (
          <div id="messages" className="bg-white px-5 py-5 mt-2">
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

        {GROUP_GAP}

        {/* ── 점핑 서비스 ── 홈과 같은 2×2 칸(칸 이름 그대로) + 견적함. 글자만 MY 크기 */}
        <MenuGroup title="점핑 서비스" id={SERVICES_ANCHOR_ID}>
          <div style={{ padding: "6px 22px 20px" }}>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_TILES.map((t) => (
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
                  <div className="mt-2.5" style={MY_TILE_TITLE}>{t.title}</div>
                  <div className="mt-0.5" style={MY_TILE_DESC}>{t.desc}</div>
                </Link>
              ))}
            </div>
            {/* 2026-09-29: "곧 오픈" 예고 카드 + 오픈 알림 신청. 실제 견적함이 생기면 QUOTES_ENABLED = true */}
            {!QUOTES_ENABLED && (
              <div className="mt-2.5">
                <QuotesTeaserCard memberId={memberId} />
              </div>
            )}
          </div>
        </MenuGroup>

        {GROUP_GAP}

        {/* ── 계정 ── */}
        <MenuGroup title="계정" id="account">
          {/* 2026-09-27: 비밀번호를 설정해두면 /login에서 SMS 없이 바로 로그인 가능(잊으면 그냥 기존 OTP로 로그인) */}
          <MenuRow
            first
            data="password"
            icon="🔑"
            label="비밀번호 설정"
            open={open === "password"}
            onClick={() => toggleOpen("password")}
          />
          {open === "password" && (
            <MenuPanel data="password">
              {passwordSaved ? (
                <p className="font-bold" style={{ color: "#1D8A44" }}>✔ 비밀번호를 설정했어요 · 다음부터 SMS 없이 로그인할 수 있어요</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p>설정해두면 다음부터 SMS 인증 없이 로그인할 수 있어요.</p>
                  <input
                    type="password"
                    className="w-full rounded-xl outline-none bg-white"
                    style={{ border: "1.5px solid #E4E7EB", padding: 12, fontSize: MY_INPUT_FONT_SIZE }}
                    placeholder="새 비밀번호 (8자 이상)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  {passwordError && <span className="font-bold" style={{ fontSize: rem(16), color: "#E25100" }}>{passwordError}</span>}
                  <div className="flex gap-2">
                    <button type="button" onClick={savePassword} disabled={passwordSaving} className={`flex-1 ${BTN_CLASS}`} style={myBtnStyle("primary")}>
                      {passwordSaving ? "저장 중..." : "저장"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(null);
                        setPasswordError(null);
                        setNewPassword("");
                      }}
                      className={`flex-1 ${BTN_CLASS}`}
                      style={myBtnStyle("secondary")}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </MenuPanel>
          )}
          {/* 2026-09-29: 회원 로그아웃 — 이 기기에서만(scope local). 명시적 로그아웃이라 재방문 화면 신호(로그인 기록·방식)도 지움 */}
          <MenuRow data="logout" icon="↩" label={loggingOut ? "로그아웃 중…" : "로그아웃"} onClick={logout} chevron={false} />
          <MenuRow data="unsubscribe" label="알림 해지·탈퇴" href="/unsubscribe" labelStyle={{ fontWeight: 500, color: "#6B7480" }} />
        </MenuGroup>

        <BusinessFooter />
      </div>

      <Toast message={toastMessage} />
    </main>
  );
}
