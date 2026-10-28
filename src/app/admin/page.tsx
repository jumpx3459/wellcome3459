"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { CheckCircle } from "lucide-react";
import { mockCategories, mockRegions, categoryIcons, quantityUnits } from "@/lib/mockData";
import ImageUploader, { type ImageUploadStatus, type ImageUploaderHandle, type PhotoRef } from "@/components/ImageUploader";
import { BP_MESSAGES, BRAND_NAME_MAX, toProtectedRef } from "@/lib/brandProtected";
import VideoUploader, { type VideoUploadStatus, type VideoUploaderHandle } from "@/components/VideoUploader";
import VideoNotUploadedSheet, { PHOTO_FAILED_DESCRIPTION, uploadingLabel, videoNotUploaded } from "@/components/VideoNotUploadedSheet";
import SellerDisplayPicker from "@/components/SellerDisplayPicker";
import { scrollToBizCheck } from "@/lib/bizCheckJump";
import AdminJumpBar from "@/components/admin/AdminJumpBar";
import { NEGOTIABLE_LABEL, NEGOTIABLE_TEXT, isNegotiable, type PriceMode } from "@/lib/priceMode";
import SellerPrivateFields, { EMPTY_SELLER_PRIVATE, type SellerPrivateDraft } from "@/components/admin/SellerPrivateFields";
import DealSellerPrivateEditor from "@/components/admin/DealSellerPrivateEditor";
import AdminFullscreenPanel from "@/components/admin/AdminFullscreenPanel";
import { formatMoq, moqUnit } from "@/lib/moq";
import {
  SHIPPING_FEE_TYPES, SHIPPING_FEE_LABELS, SHIPPING_NOTE_MAX, SHIPPING_NOTE_ERROR, DEFAULT_SHIPPING_FEE_TYPE, shippingFeeTypeOf, type ShippingFeeType,
} from "@/lib/shippingFee";
import {
  DEADLINE_CHOOSE_MESSAGE, DEADLINE_CUSTOM, DEADLINE_DEFAULT, DEADLINE_MAX_MESSAGE, DEADLINE_MAX_MS, DEADLINE_OPTIONS,
  checkClosesAt, closesAfterExpiryMessage, expiryLimitMs, mapHopeHoursToChoice,
} from "@/lib/dealDeadline";
import MemberDetailView from "@/components/admin/MemberDetailView";
import AdminMediaLightbox, { type LightboxItem } from "@/components/admin/AdminMediaLightbox";
import { publicSellerName } from "@/lib/sellerDisplay";
import { formatPhoneTyping } from "@/lib/auth";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { normalizeTitle, checkTitle, checkDescription } from "@/lib/titleGuard";
import ConfirmWarnings, { BLOCK_COLOR, WARN_COLOR } from "@/components/ConfirmWarnings";
import {
  isStorageType, discountPercent, priceWarnings, HIGH_DISCOUNT_PCT, storageSummary, formatExpiry, EXPIRY_REQUIRED_MESSAGE,
  PACKAGE_UNIT_ADMIN_EXAMPLES, SPEC_EXAMPLES, ORIGIN_EXAMPLES, type StorageType,
} from "@/lib/dealFields";
import { SuggestInput, StorageTypeButtons } from "@/components/DealFormInputs";
import ManifestUploader from "@/components/ManifestUploader";
import Toast, { useToast } from "@/components/Toast";
import { formatPriceInput, parsePriceInput, formatMemberNo, formatPriceWithUnit, formatDealPrice } from "@/lib/format";
import type { ManifestRow } from "@/lib/parseCsv";
import { SITE_URL } from "@/lib/siteUrl";
import { rem } from "@/lib/rem";
import { isStockType, STOCK_TYPES, type StockType } from "@/lib/stockType";
import FormAccordion, { FormSectionTitle, FORM_ROW2, FORM_ROW3 } from "@/components/FormAccordion";
import StockTypeBadge from "@/components/StockTypeBadge";
import { ADMIN_PHOTO_LIMIT } from "@/lib/photoLimit";
import { DEAL_PRICE_UNITS, LUMP_SUM, isDealPriceUnit, isLumpSum, priceUnitSuffix } from "@/lib/priceUnit";
import { UI_SECTION, UI_CARD_TITLE, UI_LINK, BTN_CLASS, btnStyle } from "@/lib/uiText";
import { FieldLabel, FORM_INPUT_FONT_SIZE } from "@/components/FormField";
import { RatioMetric, DailyBars, FunnelBars, InlineBar, BIG_NUM, LABEL, CARD } from "@/components/admin/DashboardViz";
import AdminListCard from "@/components/admin/AdminListCard";
import BusinessCheckSection, { BusinessCheckBadge } from "@/components/admin/BusinessCheckSection";
import { AdminLoginFields, AdminLoginOverlay, AdminSessionProvider, SessionBanner, type LoginReason } from "@/components/admin/AdminSessionUI";
import { adminFetch, adminSaveAuthMessage, notifyAdminAuthRestored, ADMIN_AUTH_EXPIRED_EVENT } from "@/lib/adminSession";
import ConnectionBoard from "@/components/admin/ConnectionBoard";
import { can, type AdminPerm } from "@/lib/adminPerms";
import { CARD_TITLE_PROPS, LIST_CARD_TITLE_PROPS, LIST_CARD_BAND_BG, bandBleedClass } from "@/components/admin/cardTitle";
import { NeedsActionChip, ActionFilterChip, ActionFilterEmpty } from "@/components/admin/NeedsAction";
import {
  leadNeedsAction,
  buyRequestNeedsAction,
  sellerRequestNeedsAction,
  partnerRequestNeedsAction,
  NEEDS_ACTION_ROW_STYLE,
  isDeadlineSoon,
  isDeadlinePassed,
  deadlineChipLabel,
  NEEDS_ACTION_PASSED_ROW_STYLE,
} from "@/lib/admin/needsAction";
import { isPassingCheck, NOT_CHECKED_MESSAGE, type BusinessCheck } from "@/lib/businessCheck";
import { formatConsentDate } from "@/lib/consent";
import { ADMIN_TEXT } from "@/lib/adminText";

// 2026-09-30 (커밋 K): /api/admin/kpi-daily 한 줄 (kpi_daily 테이블 일부 컬럼)
type KpiDailyRow = {
  snapshot_date: string;
  members_total: number;
  push_reachable_members: number;
  deals_active: number;
  members_new: number;
  leads_member_new: number;
  leads_guest_new: number;
  notifications_sent: number;
  notifications_clicked: number;
  excluded_members: number;
};

type SellerRequest = {
  stock_type?: string | null; // 2026-09-29 재고 유형
  id: string;
  company_name: string | null;
  is_anonymous?: boolean | null; // 판매 신청의 업체명 공개 설정 (true = 비공개)
  contact_name: string | null;
  contact_phone: string;
  product_name: string;
  quantity: number;
  quantity_unit: string | null;
  min_order_qty: number | null;
  hope_price: number | null;
  price_mode?: PriceMode | null; // 2026-10-05 가격 방식 — "negotiable"이면 희망가·정상가 없음(SQL 전이면 칸 없음 = fixed)
  price_unit?: string | null; // 2026-09-29 단가 단위 (없으면 수량 단위 기준)
  hope_duration_hours: number | null;
  description: string | null;
  package_unit: string | null;
  origin: string | null;
  spec: string | null;
  storage_condition: string | null;
  storage_type?: string | null; // 2026-10-01 PR-B (SQL 전이면 없음)
  expiry_date?: string | null;
  original_price?: number | null;
  pid: string | null;
  manifest_items: ManifestRow[] | null;
  images: string[] | null;
  video_url: string | null;
  categories: { name: string } | null;
  regions: { name: string } | null;
  // 2026-10-26 찾습니다 공급 제안 — 연결된 요청(없으면 일반 판매 신청). buy_request_visible = 그 요청이 지금 공개 노출 중인가
  buy_request_id?: string | null;
  buy_requests?: { product_name: string | null } | null;
  buy_request_visible?: boolean;
};

type PartnerRequest = {
  id: string;
  member_id: string;
  business_type: string;
  channel_info: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  members: { phone: string; company_name: string | null } | null;
};

type PartnerOverviewItem = {
  id: string;
  phone: string;
  company_name: string | null;
  name: string | null;
  member_no: number | null;
  ref_code: string | null;
  partner_since: string;
  total_referrals: number;
  this_month_referrals: number;
  business_verified_referrals: number;
};

type ActiveDeal = {
  id: string;
  title: string;
  deal_price: number | null; // 2026-10-04 가격 협의 매물은 null
  price_mode?: PriceMode | null;
  total_qty: number;
  remaining_qty: number;
  quantity_unit: string | null;
  closes_at: string;
  created_at: string;
  categories: { name: string } | null;
  regions: { name: string } | null;
  images: string[] | null;
  video_url: string | null;
  interest_count: number | null;
  quick_lead_count: number | null;
  is_anonymous?: boolean | null;
  seller_display_name?: string | null;
  shipping_fee_type?: string | null; // 2026-10-28 배송비 안내(목록 API가 select * 로 이미 줌)
  shipping_note?: string | null;
  // 2026-10-03 feat/admin-deal-edit: 카드에서 수정하는 칸 (목록 API가 select * 로 이미 줌)
  original_price?: number | null;
  min_order_qty?: number | null;
  price_unit?: string | null;
  stock_type?: string | null;
  expiry_date?: string | null;
  description?: string | null;
  // 2026-10-23 매물 수정 = 등록 폼 재사용(DealForm mode="edit") — 폼이 채우는 나머지 칸(목록 API가 select * 로 이미 줌)
  location?: string | null;
  package_unit?: string | null;
  origin?: string | null;
  spec?: string | null;
  storage_type?: string | null;
  storage_condition?: string | null;
  pid?: string | null;
  manifest_items?: ManifestRow[] | null;
  // 2026-10-27 브랜드 보호 — 관리자 목록 API(select *)가 줌. protected_preview_urls = 보호 사진 표시용 서명 URL(1시간, protected_images와 같은 순서)
  brand_protected?: boolean | null;
  brand_name?: string | null;
  protected_images?: string[] | null;
  protected_preview_urls?: (string | null)[] | null;
};

// 2026-09-28 (2): 목록/마감 UI 추가하며 함께 정의 — ActiveDeal과 달리 수량/가격
// 개념이 없는 가벼운 공지 레코드.
type NoticeItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
  regions: { name: string } | null;
};

type CategoryKpi = {
  name: string;
  leads: number;
  completionRate: number | null;
  activeSuppliers: number;
  activeDemanders: number;
};

type Member = {
  id: string;
  phone: string;
  is_business: boolean;
  company_name: string | null;
  member_no: number | null;
  nickname: string | null;
  referrer_phone: string | null;
  push_subscribed: boolean;
  business_verified: boolean;
  has_business_license: boolean;
  created_at: string;
  categories: string[];
  regions: string[];
  phone_masked?: boolean; // 2026-10-10: 관리자(일반)는 가린 번호 — 전체 번호는 [번호 보기]
};

type AdminUser = {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  last_login_at: string | null;
  created_at: string;
};

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// 엑셀에서 한글 안 깨지게 BOM 붙여서 CSV 다운로드
function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          let s = String(cell ?? "");
          // 회원 상호명/매물명 등은 사용자가 자유 입력한 값이라, 엑셀이 수식으로
          // 해석하는 =,+,-,@로 시작하면 앞에 '를 붙여 수식 인젝션을 막는다.
          if (/^[=+\-@]/.test(s)) s = `'${s}`;
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 2026-10-04 판매자 신원 확인: 대기 중인 신청들의 사업자 조회 기록(최신순)·신청 연락처 = 가입 번호 여부. 실패하면 빈 값
async function fetchBizChecks(adminKey: string, ids: string[]): Promise<{ items: BusinessCheck[]; phoneMatch: Record<string, boolean | null> }> {
  if (!ids.length) return { items: [], phoneMatch: {} };
  const d = await fetch(`/api/admin/business-checks?seller_request_ids=${ids.join(",")}`, { headers: { "x-admin-key": adminKey } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return { items: d?.items ?? [], phoneMatch: d?.phoneMatch ?? {} };
}

const ADMIN_SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6시간
// 2026-10-01: 최고관리자 전용 API(영구 삭제·공식 파트너 승인/거절·긴급 공지·데이터 내보내기)가 403이면 안내
// (2026-10-06: 영구 삭제·긴급 공지 등록·CSV 내보내기 버튼은 최고관리자에게만 보임)
const SUPER_ONLY_MESSAGE = "최고관리자만 할 수 있어요";

// 2026-10-23: 관리자 PC 최대 폭 한 곳(예전 1200px) — 본문 틀·상단 대시보드·목록 영역이 같이 씀. 로그인·오류 화면은 max-w-md 그대로
const ADMIN_MAX_W = "max-w-[1600px]";

export default function AdminPage() {
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loginPhone, setLoginPhone] = useState(""); // 2026-10-01: 번호 + 비밀번호 로그인
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  // 2026-10-26 세션 만료 대응: key를 비우지 않고(대시보드·등록 패널·입력 유지) 그 위에 로그인 창만 띄움. 성공하면 key만 새 토큰으로 바뀜
  const [loginReason, setLoginReason] = useState<LoginReason | null>(null);
  const [restoreTick, setRestoreTick] = useState(0);
  // 세션에 번호가 보관돼 있으면(이전 형식 세션이 아니면) 다시 로그인 창의 번호 칸을 그 번호로 고정 — 로그인 입력 중인 loginPhone과는 별개
  const [lockedPhone, setLockedPhone] = useState(false);
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);
  useEffect(() => {
    // 이 토큰으로 보낸 요청이 401 — 이미 새 토큰으로 바뀐 뒤 늦게 도착한 옛 요청의 401은 무시
    const onExpired = (e: Event) => {
      const k = (e as CustomEvent<{ key: string | null }>).detail?.key;
      if (!keyRef.current || k !== keyRef.current) return;
      setLoginError(null);
      setLoginReason("expired");
    };
    window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, onExpired);
  }, []);
  useEffect(() => {
    // 다시 로그인 성공(새 토큰 반영) 뒤 — 실패한 사진 업로드가 이 신호로 한 번 다시 올림. 자식 effect가 먼저 돌아 최신 토큰을 들고 있음
    if (restoreTick > 0) notifyAdminAuthRestored();
  }, [restoreTick]);

  useEffect(() => {
    const stored = sessionStorage.getItem("jumpingbid_admin_session");
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.key && Date.now() - session.ts < ADMIN_SESSION_TTL_MS) {
          setKey(session.key);
          setAdminName(session.name ?? null);
          setAdminRole(session.role ?? null);
          setSessionExpiresAt(session.ts + ADMIN_SESSION_TTL_MS);
          if (typeof session.phone === "string" && session.phone.trim() !== "") {
            setLoginPhone(session.phone); // 다시 로그인 창 번호(탭 세션에만 저장) — 창에서는 고정
            setLockedPhone(true);
          }
        } else {
          sessionStorage.removeItem("jumpingbid_admin_session");
        }
      } catch {
        sessionStorage.removeItem("jumpingbid_admin_session");
      }
    }
  }, []);

  const login = async () => {
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: loginPhone, password: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      const ts = Date.now();
      // 2026-10-26: 번호도 이 탭 세션 객체에만 보관(다시 로그인 창 미리 채움) — 탭을 닫거나 로그아웃하면 같이 지워짐, localStorage 안 씀
      const session = { key: data.token, ts, name: data.admin.name, role: data.admin.role, phone: loginPhone };
      sessionStorage.setItem("jumpingbid_admin_session", JSON.stringify(session));
      const relogin = keyRef.current !== null;
      setKey(data.token);
      setLockedPhone(true);
      setAdminName(data.admin.name);
      setAdminRole(data.admin.role);
      setSessionExpiresAt(ts + ADMIN_SESSION_TTL_MS);
      setInput("");
      setLoginReason(null);
      if (relogin) setRestoreTick((t) => t + 1);
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("jumpingbid_admin_session");
    setKey(null);
    setAdminName(null);
    setAdminRole(null);
    setSessionExpiresAt(null);
    setLoginReason(null);
    setLoginPhone("");
    setLockedPhone(false);
    setInput("");
    setLoginError(null);
  };

  if (!key) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 mx-auto w-full max-w-md bg-white shadow-sm">
        {/* 2026-10-01 (커밋 J): 일반 회원 로그인(네이비 헤더·캐릭터)과 한눈에 구분 — 작은 로고 + "관리자" 라벨, 기존 로고 에셋만 사용 */}
        <div className="flex items-center gap-2 mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
          <span className="rounded-md font-bold text-white" style={{ fontSize: rem(14), padding: "4px 10px", background: "#1A1F26", letterSpacing: "0.02em" }}>
            관리자
          </span>
        </div>
        <h1 className="font-display text-xl text-navy mb-4">관리자 로그인</h1>
        <AdminLoginFields phone={loginPhone} onPhone={(v) => setLoginPhone(formatPhoneTyping(v))} password={input} onPassword={setInput} error={loginError} busy={loggingIn} onSubmit={login} />
      </main>
    );
  }

  return (
    <AdminSessionProvider
      value={{
        expiresAt: sessionExpiresAt,
        requestLogin: (reason) => {
          setLoginError(null);
          setInput("");
          setLoginReason(reason);
        },
      }}
    >
      <AdminDashboard
        adminKey={key}
        adminName={adminName}
        adminRole={adminRole}
        sessionExpiresAt={sessionExpiresAt}
        onLogout={logout}
      />
      {loginReason && (
        <AdminLoginOverlay
          reason={loginReason}
          onClose={() => setLoginReason(null)}
          onLogout={logout}
          phoneLocked={lockedPhone}
          phone={loginPhone}
          onPhone={(v) => setLoginPhone(formatPhoneTyping(v))}
          password={input}
          onPassword={setInput}
          error={loginError}
          busy={loggingIn}
          onSubmit={login}
          autoFocusPassword={lockedPhone}
        />
      )}
    </AdminSessionProvider>
  );
}

type Interest = {
  id: string;
  contacted: boolean;
  outcome: "pending" | "completed" | "no_deal";
  completed_amount: number | null;
  created_at: string;
  deals: { id: string; title: string; deal_price: number | null } | null;
  members: {
    phone: string;
    is_business: boolean;
    member_no: number | null;
    business_verified: boolean;
  } | null;
  phone?: string; // quick_leads(비회원 원클릭 리드)는 members 없이 전화번호만 가짐
  source: "member" | "quick";
  connection_consent_at?: string | null; // 2026-10-03 F-3a: 판매자 연결 동의 시각(deal_connections) — 없으면 관심 표시만
  has_connection?: boolean; // 2026-10-04 F-4: 거래 연결 기록 있음 → 성사·불발은 연결 보드에서
  connection_state?: "open" | "cancelled" | "closed" | null; // 진행 중 / 최근 연결 취소 / 성사·불발로 종료
};

type BuyRequest = {
  id: string;
  product_name: string;
  quantity: string | null;
  hope_price: number | null;
  hope_price_unit: string | null; // 2026-09-29 "kg" 등 수량 단위 또는 "일괄"(예전 "총액")
  contact_phone: string | null; // 2026-09-30: 비회원 연락처는 수집 90일 후 자동으로 비움(schema.sql 커밋 G)
  description: string | null;
  contacted: boolean;
  outcome: "pending" | "matched" | "no_match";
  created_at: string;
  categories: { name: string } | null;
  regions: { name: string } | null;
  supply_pending?: number; // 2026-10-26 대기 중인 공급 제안 건수(판매 신청 pending 중 이 요청에 연결된 것)
};

function SessionCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(expiresAt - Date.now());
  useEffect(() => {
    const t = setInterval(() => setRemaining(expiresAt - Date.now()), 30000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return (
    <span>
      세션 {h}시간 {m}분 남음
    </span>
  );
}

function AdminDashboard({
  adminKey,
  adminName,
  adminRole,
  sessionExpiresAt,
  onLogout,
}: {
  adminKey: string;
  adminName: string | null;
  adminRole: string | null;
  sessionExpiresAt: number | null;
  onLogout: () => void;
}) {
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  // 2026-10-04 판매자 신원 확인: 대기 중인 신청들의 사업자 조회 기록(최신순) + 신청 연락처 = 가입 번호 여부
  const [bizChecks, setBizChecks] = useState<BusinessCheck[]>([]);
  const [bizPhoneMatch, setBizPhoneMatch] = useState<Record<string, boolean | null>>({});
  const [bizPreselect, setBizPreselect] = useState<{ id: string; nonce: number } | null>(null);
  const loadBizChecks = (ids: string[]) =>
    fetchBizChecks(adminKey, ids).then((d) => {
      setBizChecks(d.items);
      setBizPhoneMatch(d.phoneMatch);
    });
  const latestBizCheck = (requestId: string) => bizChecks.find((c) => c.seller_request_id === requestId && c.kind === "validate") ?? null;
  // 2026-10-01: 카드가 목록에서 빠진 뒤에도 보이는 안내(매물 마감 등) — 카드 안 토스트는 카드와 함께 사라짐
  const { message: dashToast, showToast: showDashToast } = useToast();
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [partnersOverview, setPartnersOverview] = useState<PartnerOverviewItem[]>([]);
  const [partnersOverviewOpen, setPartnersOverviewOpen] = useState(true);
  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [activeDeals, setActiveDeals] = useState<ActiveDeal[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [categoryKpis, setCategoryKpis] = useState<CategoryKpi[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFormFor, setOpenFormFor] = useState<string | "new" | null>(null);
  // 2026-10-28 7b: [같은 판매자로 다음 매물 등록] — 방금 등록한 매물의 판매자 3칸·조회 기록 id·지역만 새 폼으로 이월(클라이언트 값, 서버 조회 없음). 새 폼은 key로 다시 만듦
  const [sameSeller, setSameSeller] = useState<{ nonce: number; carry: SameSellerCarry } | null>(null);
  useEffect(() => {
    if (openFormFor !== "new") setSameSeller(null);
  }, [openFormFor]);
  // 2026-10-03 PR-D: 매물 등록 폼(새 매물·판매자 신청)은 한 자리에 하나만 — 작성 중이면 바꾸기 전에 확인
  const dealFormDirtyRef = useRef(false);
  const [dealFormDirtyState, setDealFormDirtyState] = useState(false); // PC 패널의 "저장하지 않은 변경" 확인 바용(인라인은 ref + confirm 그대로)
  const setDealFormDirty = useCallback((dirty: boolean) => {
    dealFormDirtyRef.current = dirty;
    setDealFormDirtyState(dirty);
  }, []);
  const [formPanelMin, setFormPanelMin] = useState(false); // 등록 폼 작성 중 사업자 조회로 잠깐 나가는 동안 패널만 숨김(입력 유지)
  const [panelFooterEl, setPanelFooterEl] = useState<HTMLDivElement | null>(null); // 패널 하단 바 안 빈 자리 — 폼의 [매물 등록 확정]이 여기로 옮겨 옴
  // [닫기]·[취소]·신청 카드 [닫기] — 작성 중이면(신청 폼은 미리 채운 값에서 바뀌었거나 사진·영상 변화) 확인 후 닫기, 빈 폼은 바로
  const closeDealForm = () => {
    if (dealFormDirtyRef.current && !confirm("작성 중인 내용이 사라져요. 닫을까요?")) return;
    setOpenFormFor(null);
  };
  const switchForm = (next: string) => {
    if (openFormFor === next) return;
    const dealFormOpen = openFormFor !== null && openFormFor !== "notice";
    if (dealFormOpen && dealFormDirtyRef.current && !confirm("작성 중인 내용이 사라져요. 계속할까요?")) return;
    setOpenFormFor(next);
    if (next !== "new" && next !== "notice" && !isDesktop) {
      // 판매자 신청 → 새 매물 자리로 스크롤 (폼이 그려진 다음)
      setTimeout(() => document.getElementById("deal-form-slot")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    }
  };
  const [authError, setAuthError] = useState<string | null>(null);
  const [licenseLoadingId, setLicenseLoadingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "business" | "subscribed" | "unsubscribed">("all");
  // 2026-10-28: 기본 = 진행중(pending) — 끝난(성사·불발) 건과 아직 안 시작한 건이 섞여 길어지던 목록을 줄임. [전체] 칩으로 해제
  const [leadFilter, setLeadFilter] = useState<"all" | "uncontacted" | "pending" | "completed" | "no_deal">("pending");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  // 2026-10-10 권한표(src/lib/adminPerms.ts) — 화면은 서버와 같은 표로 섹션을 고름(막는 것은 서버). 역할은 /api/admin/me로 다시 확인
  const [me, setMe] = useState<{ id: string; name: string; role: string } | null>(null);
  const role = me?.role ?? adminRole;
  const perm = (p: AdminPerm) => can(role, p);
  // [발굴 매니저] 선택지 — 최고관리자·관리자는 활성 관리자 전체, 점핑매니저는 본인만(관리자 목록 권한 없음 · 서버도 본인만 허용)
  const sourcedOptions = perm("adminList")
    ? admins.map((a) => ({ id: a.id, name: a.name, role: a.role }))
    : me
      ? [{ id: me.id, name: me.name, role: me.role }]
      : [];
  const [appointFor, setAppointFor] = useState<Member | null>(null);
  const [appointName, setAppointName] = useState("");
  const [appointRole, setAppointRole] = useState<"관리자" | "최고관리자" | "점핑매니저">("관리자");
  const [appointSubmitting, setAppointSubmitting] = useState(false);
  const [appointError, setAppointError] = useState("");
  const [appointResult, setAppointResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [changePwSubmitting, setChangePwSubmitting] = useState(false);
  const [changePwError, setChangePwError] = useState("");
  const [changePwSuccess, setChangePwSuccess] = useState(false);

  // 2026-09-26: 관리자 페이지가 브레이크포인트 없이 세로로만 쌓이는 구조라
  // PC 모니터에서도 모바일과 동일하게 한 줄씩 이어지며 스크롤만 길어짐 —
  // "자동"은 실제 창 폭(1024px 기준)으로 PC 레이아웃을 자동 적용하고,
  // "모바일"/"PC"는 창 폭과 무관하게 강제 고정(미리보기·개인 취향용).
  // 우선 핵심 구간(조치 필요·참고 지표·진행 중인 매물)에만 적용.
  const [viewMode, setViewMode] = useState<"auto" | "mobile" | "desktop">("auto");
  const [quotesWaitlist, setQuotesWaitlist] = useState<{ total: number; receiver: number; sender: number } | null>(null);
  const [jumpxWaitlist, setJumpxWaitlist] = useState<number | null>(null); // 점프엑스 둘러보기 오픈 알림 신청 수(jumpx_open)
  // 2026-09-29: 핵심 지표·최근 7일 추세 (/api/admin/dashboard-metrics, 읽기 전용 집계)
  const [metrics, setMetrics] = useState<{
    members: { total: number; withPush: number };
    notifications7d: { sent: number; clicked: number };
    daily: { days: string[]; signups: number[]; deals: number[]; leads: number[] };
    // 2026-09-30 (커밋 K): 목록 개수 대신 DB count — 관리자·테스트 계정·[테스트] 매물 제외
    counts?: {
      membersTotal: number;
      businessVerified: number;
      todaySignups: number;
      uncontactedLeads: number;
      uncontactedBuyRequests: number;
      pendingSellerRequests: number;
      todayDeals: number;
    };
    excluded?: { members: number; source: "view" | "admin_phones" };
  } | null>(null);
  // 2026-09-30 (커밋 K): KPI 기록 — kpi_daily 최근 30일 (매일 00:05 KST 스냅샷)
  const [kpiDaily, setKpiDaily] = useState<KpiDailyRow[] | null>(null);
  const [windowWidth, setWindowWidth] = useState(0);
  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isDesktop = viewMode === "desktop" || (viewMode === "auto" && windowWidth >= 1024);

  // 리스트 섹션 아코디언 — 조치가 필요한 섹션(리드/신청서)은 기본 펼침,
  // 참고용 섹션(전체 회원 목록/관리자 목록)은 기본 접힘.
  const [membersOpen, setMembersOpen] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(true);
  // 2026-10-04 F-4: 거래 연결 카드 — 건수는 ConnectionBoard가 불러온 뒤 알려줌(-1 = 아직)
  const [connectionsOpen, setConnectionsOpen] = useState(true);
  const [connCounts, setConnCounts] = useState<{ open: number; closed: number; stuck: number }>({ open: -1, closed: 0, stuck: 0 });
  const [sellerReqOpen, setSellerReqOpen] = useState(true);
  // 2026-10-26: 처음 불러온 직후 한 번만 — 처리할 판매자 신청이 1건 이상이면 펼치고, 0건이면 접어 둠(이후 직접 펼치고 접은 상태는 그대로)
  const sellerAutoRef = useRef(false);
  useEffect(() => {
    if (loading || sellerAutoRef.current) return;
    sellerAutoRef.current = true;
    setSellerReqOpen(requests.some(sellerRequestNeedsAction));
  }, [loading, requests]);
  // 2026-10-28: 심사중 0건이면 기본 접힘(1건 이상이면 펼침) — 불러온 뒤 한 번만 정함(판매 신청 카드와 같은 방식). 바로가기·알림 이동은 그대로 펼침
  const [partnerReqOpen, setPartnerReqOpen] = useState(false);
  const partnerAutoRef = useRef(false);
  useEffect(() => {
    if (loading || partnerAutoRef.current) return;
    partnerAutoRef.current = true;
    setPartnerReqOpen(partnerRequests.some(partnerRequestNeedsAction));
  }, [loading, partnerRequests]);
  const [buyReqOpen, setBuyReqOpen] = useState(true);
  // 2026-10-20: 카드별 "미연락만/대기만/심사중만" 필터(관심·연결은 leadFilter === "uncontacted"가 같은 역할) + 이동 직후 테두리 강조
  const [buyOnly, setBuyOnly] = useState(false);
  const [sellerOnly, setSellerOnly] = useState(false);
  const [partnerOnly, setPartnerOnly] = useState(false);
  const [soonOnly, setSoonOnly] = useState(false); // 진행 중인 매물: 마감임박(6h)만
  const [passedOnly, setPassedOnly] = useState(false); // 진행 중인 매물: 마감 지남만(마감임박만과 동시에 켜지지 않음)
  const [nowMs, setNowMs] = useState(() => Date.now()); // 마감임박 판정·칩 시각 — 1분마다 갱신
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null); // n: 같은 카드를 또 눌러도 1.5초를 다시 셈
  const flashId = flash?.id ?? null;
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1500);
    return () => clearTimeout(t);
  }, [flash]);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [kpiAll, setKpiAll] = useState(false); // 2026-10-26: KPI 기록 표 최근 7행 + [전체 보기]
  const [categoryOpen, setCategoryOpen] = useState(false); // 카테고리별 현황 표 기본 접힘
  const [bizOpen, setBizOpen] = useState(false); // 2026-10-26: 사업자 조회는 기본 접힘(바로가기·판매 신청 [사업자 조회]는 펼치고 이동)
  const [memberShowCount, setMemberShowCount] = useState(20);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null); // 회원 상세(보기 전용) — PC는 전체 화면 패널, 모바일·📱는 카드 아래 펼침

  const viewBusinessLicense = async (memberId: string) => {
    setLicenseLoadingId(memberId);
    try {
      const res = await fetch(`/api/admin/business-license?memberId=${memberId}`, {
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
      else alert(data.error || "열람에 실패했어요.");
    } finally {
      setLicenseLoadingId(null);
    }
  };

  const verifyBusiness = async (memberId: string) => {
    await fetch("/api/admin/business-license", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ memberId }),
    });
    load();
  };

  const load = () => {
    setLoading(true);
    // 권한 없는 목록은 부르지 않음(403 소음 없이 빈 목록) — 점핑매니저는 회원·리드·재고 문의·파트너·지표·공지·관리자 목록 없음
    // 2026-10-26: 401은 adminFetch가 한 곳에서 알려 로그인 창이 뜸(대시보드는 그대로)
    const allowed = (p: AdminPerm, url: string) =>
      can(role, p) ? adminFetch(url, adminKey) : Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    adminFetch("/api/admin/me", adminKey)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.id && setMe(d))
      .catch(() => {});
    Promise.all([
      adminFetch("/api/admin/seller-requests", adminKey).then((res) => {
        if (res.status === 401) throw new Error("unauthorized"); // 로그인 창은 adminFetch가 이미 띄움 — 예전처럼 화면을 통째로 바꾸지 않음
        if (res.status === 429) {
          return res.json().then((body) => {
            setAuthError(body?.error ?? "인증에 실패했어요.");
            throw new Error("unauthorized");
          });
        }
        return res.json();
      }),
      adminFetch("/api/admin/deals/manage", adminKey).then((res) =>
        res.json()
      ),
      allowed("leads", "/api/admin/interests").then((res) =>
        res.json()
      ),
      allowed("buyRequests", "/api/admin/buy-requests").then((res) =>
        res.json()
      ),
      allowed("members", "/api/admin/members").then((res) =>
        res.json()
      ),
      allowed("partnerView", "/api/admin/partner-requests")
        .then((r) => r.json())
        .then((d) => setPartnerRequests(d.items ?? [])),
      allowed("partnerView", "/api/admin/partners-overview")
        .then((r) => r.json())
        .then((d) => setPartnersOverview(d.items ?? [])),
      allowed("adminList", "/api/admin/admins")
        .then((r) => r.json())
        .then((d) => setAdmins(d.items ?? [])),
      // 내 견적함 오픈 알림 신청 수 — 테이블이 아직 없거나 실패하면 null("—" 표시)
      allowed("dashboard", "/api/admin/feature-waitlist")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          setQuotesWaitlist(d?.quotes ?? null);
          setJumpxWaitlist(typeof d?.jumpx?.total === "number" ? d.jumpx.total : null);
        })
        .catch(() => {
          setQuotesWaitlist(null);
          setJumpxWaitlist(null);
        }),
      allowed("dashboard", "/api/admin/category-kpis")
        .then((r) => r.json())
        .then((d) => setCategoryKpis(d.items ?? [])),
      allowed("noticeManage", "/api/admin/notices")
        .then((r) => r.json())
        .then((d) => setNotices(d.items ?? [])),
      allowed("dashboard", "/api/admin/kpi-daily")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setKpiDaily(d?.missing ? null : d?.items ?? null))
        .catch(() => setKpiDaily(null)),
      allowed("dashboard", "/api/admin/dashboard-metrics")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setMetrics(d?.members ? d : null))
        .catch(() => setMetrics(null)),
    ])
      .then(([reqData, dealData, interestData, buyData, memberData]) => {
        setRequests(reqData.items ?? []);
        fetchBizChecks(adminKey, ((reqData.items ?? []) as SellerRequest[]).map((r) => r.id)).then((d) => {
          setBizChecks(d.items);
          setBizPhoneMatch(d.phoneMatch);
        });
        setActiveDeals(dealData.items ?? []);
        setInterests(interestData.items ?? []);
        setBuyRequests(buyData.items ?? []);
        setMembers(memberData.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [adminKey, role]);

  const filteredMembers = members.filter((m) => {
    if (memberFilter === "business" && !m.is_business) return false;
    if (memberFilter === "subscribed" && !m.push_subscribed) return false;
    if (memberFilter === "unsubscribed" && m.push_subscribed) return false;
    if (memberSearch) {
      const q = memberSearch.replace(/-/g, "");
      const hay = `${m.phone}${m.company_name ?? ""}${m.nickname ?? ""}`.replace(/-/g, "");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filteredInterests = interests.filter((i) => {
    if (leadFilter === "uncontacted" && !leadNeedsAction(i)) return false;
    if (leadFilter === "pending" && i.outcome !== "pending") return false;
    if (leadFilter === "completed" && i.outcome !== "completed") return false;
    if (leadFilter === "no_deal" && i.outcome !== "no_deal") return false;
    if (leadSearch) {
      const q = leadSearch.replace(/-/g, "");
      const hay = `${i.members?.phone ?? i.phone ?? ""}${i.deals?.title ?? ""}`.replace(/-/g, "");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // 2026-10-02 (PR-C1): 목록 카드 정렬 — 조치 필요 먼저, 같은 묶음 안은 API 순서(최신순) 그대로(sort는 안정 정렬).
  // 관심 표시: 카드의 "미연락" 배지 기준(미연락 + 결과 진행중). 구매 요청: 미연락 → 연락했지만 매칭 결과 대기 → 끝난 건.
  // 파트너 신청: 심사중 먼저. 판매자 신청은 API가 대기(pending)만 주고, 진행 중 매물은 API가 마감 임박 순이라 그대로.
  // 카드 제목 "n건 미연락"도 같은 기준으로 셈(배지·정렬과 숫자가 어긋나지 않게)
  const sortedInterests = [...filteredInterests].sort(
    (a, b) => Number(!leadNeedsAction(a)) - Number(!leadNeedsAction(b))
  );
  const buyRank = (b: BuyRequest) => (!b.contacted ? 0 : b.outcome === "pending" ? 1 : 2);
  const sortedBuyRequests = buyRequests.filter((b) => !buyOnly || buyRequestNeedsAction(b)).sort((a, b) => buyRank(a) - buyRank(b));
  const sortedPartnerRequests = partnerRequests
    .filter((r) => !partnerOnly || partnerRequestNeedsAction(r))
    .sort((a, b) => Number(!partnerRequestNeedsAction(a)) - Number(!partnerRequestNeedsAction(b)));
  const shownSellerRequests = requests.filter((r) => !sellerOnly || sellerRequestNeedsAction(r));

  // 2026-10-06: 데이터 내보내기는 최고관리자만 — CSV 버튼도 최고관리자에게만 보이고, 내용은 서버(/api/admin/export, 역할 검사)
  // 응답으로 만든다(화면 목록 데이터를 그대로 쓰지 않음). 지금 화면의 필터·검색 결과에 있는 행만 담음.
  const isSuperAdmin = role === "최고관리자";
  async function fetchExport<T>(type: "members" | "leads"): Promise<T[] | null> {
    const res = await fetch(`/api/admin/export?type=${type}`, { headers: { "x-admin-key": adminKey } }).catch(() => null);
    if (res?.status === 403) {
      showDashToast(SUPER_ONLY_MESSAGE);
      return null;
    }
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data) {
      showDashToast("내보내지 못했어요. 다시 시도해주세요");
      return null;
    }
    return (data.items ?? []) as T[];
  }

  const exportMembersCsv = async () => {
    const items = await fetchExport<Member>("members");
    if (!items) return;
    const shown = new Set(filteredMembers.map((m) => m.id));
    downloadCsv(`members_${new Date().toISOString().slice(0, 10)}.csv`, [
      ["전화번호", "회원번호", "상호명", "사업자여부", "사업자인증", "구독여부", "카테고리", "지역", "가입일"],
      ...items.filter((m) => shown.has(m.id)).map((m) => [
        m.phone,
        m.member_no != null ? formatMemberNo(m.member_no) : "",
        m.company_name ?? "",
        m.is_business ? "Y" : "N",
        m.business_verified ? "Y" : "N",
        m.push_subscribed ? "Y" : "N",
        m.categories.join("/"),
        m.regions.join("/"),
        new Date(m.created_at).toLocaleString("ko-KR"),
      ]),
    ]);
  };

  const exportLeadsCsv = async () => {
    const items = await fetchExport<Interest>("leads");
    if (!items) return;
    const shown = new Set(filteredInterests.map((i) => `${i.source}:${i.id}`));
    downloadCsv(`leads_${new Date().toISOString().slice(0, 10)}.csv`, [
      ["번호", "매물명", "연락상태", "결과", "성사금액", "리드유형", "일시"],
      ...items.filter((i) => shown.has(`${i.source}:${i.id}`)).map((i) => [
        i.members?.phone ?? i.phone ?? "",
        i.deals?.title ?? "",
        i.contacted ? "연락완료" : "미연락",
        i.outcome === "completed" ? "성사" : i.outcome === "no_deal" ? "불발" : "진행중",
        i.completed_amount ?? "",
        i.source === "quick" ? "원클릭" : "회원",
        new Date(i.created_at).toLocaleString("ko-KR"),
      ]),
    ]);
  };

  const toggleLeadSelected = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkMarkContacted = async () => {
    const targets = filteredInterests.filter((i) => selectedLeads.has(i.id) && !i.contacted);
    if (targets.length === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(
        targets.map((i) =>
          fetch("/api/admin/interests", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify({ id: i.id, source: i.source, contacted: true }),
          })
        )
      );
      setSelectedLeads(new Set());
      load();
    } finally {
      setBulkProcessing(false);
    }
  };

  async function reviewPartnerRequest(id: string, status: "approved" | "rejected") {
    const res = await fetch("/api/admin/partner-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ id, status }),
    });
    if (res.status === 403) {
      alert(SUPER_ONLY_MESSAGE);
      return;
    }
    setPartnerRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  // 2026-10-02: 형식이 달라도("+8210…"·하이픈) 같은 번호면 관리자로 보게 normalizePhone으로 맞춰 비교
  const adminPhones = new Set(admins.map((a) => normalizePhone(a.phone)).filter(Boolean));

  const openAppoint = (member: Member) => {
    setAppointFor(member);
    setAppointName(member.nickname || member.company_name || "");
    setAppointRole("관리자");
    setAppointError("");
  };

  const submitAppoint = async () => {
    if (!appointFor) return;
    if (!appointName.trim()) {
      setAppointError("이름을 입력해주세요.");
      return;
    }
    setAppointSubmitting(true);
    setAppointError("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ memberId: appointFor.id, name: appointName.trim(), role: appointRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAppointError(data.error ?? "임명에 실패했어요.");
        return;
      }
      setAppointFor(null);
      setAppointResult({ name: data.admin.name, tempPassword: data.tempPassword });
      load();
    } finally {
      setAppointSubmitting(false);
    }
  };

  const handleShareTempPassword = async () => {
    if (!appointResult) return;
    const adminUrl = `${SITE_URL}/admin`;
    const message = `🎉 ${appointResult.name}님, 덤핑점핑 관리자로 임명됐어요!\n\n관리자 페이지: ${adminUrl}\n임시 비밀번호: ${appointResult.tempPassword}\n\n로그인 후 꼭 "비밀번호 변경"으로 새 비밀번호로 바꿔주세요.`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "덤핑점핑 관리자 임명", text: message });
      } catch {
        // 사용자가 공유를 취소한 경우 — 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      alert("메시지를 클립보드에 복사했어요. 전달할 곳에 붙여넣어주세요.");
    } catch {
      alert(message);
    }
  };

  const removeAdmin = async (admin: AdminUser) => {
    if (!confirm(`${admin.name}(${admin.role}) 관리자 권한을 해제할까요?`)) return;
    setRemovingAdminId(admin.id);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ id: admin.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "해제에 실패했어요.");
        return;
      }
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    } finally {
      setRemovingAdminId(null);
    }
  };

  // 2026-09-28: 해제→재임명 없이 role만 바꿈 — 비밀번호·로그인 이력 유지.
  // 2026-10-10: 역할 3가지(점핑매니저 추가) — 버튼 토글 대신 고르기
  const changeAdminRole = async (admin: AdminUser, nextRole: string) => {
    if (!nextRole || nextRole === admin.role) return;
    if (!confirm(`${admin.name}님을 "${nextRole}"(으)로 변경할까요?`)) return;
    setRoleChangingId(admin.id);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ id: admin.id, role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "역할 변경에 실패했어요.");
        return;
      }
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, role: nextRole } : a)));
    } finally {
      setRoleChangingId(null);
    }
  };

  const submitChangePassword = async () => {
    setChangePwError("");
    if (!oldPassword || !newPassword) {
      setChangePwError("현재/새 비밀번호를 모두 입력해주세요.");
      return;
    }
    if (newPassword !== newPassword2) {
      setChangePwError("새 비밀번호가 서로 달라요.");
      return;
    }
    setChangePwSubmitting(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChangePwError(data.error ?? "변경에 실패했어요.");
        return;
      }
      setChangePwSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
    } finally {
      setChangePwSubmitting(false);
    }
  };

  if (authError) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center mx-auto w-full max-w-md bg-white shadow-sm">
        <p className="text-orange font-bold mb-3">{authError}</p>
        <button onClick={onLogout} className="text-navy underline text-sm">
          다시 입력하기
        </button>
      </main>
    );
  }

  // "조치 필요" 타일 클릭 시 해당 섹션을 펼치고 그 위치로 스크롤 — 섹션 컨테이너에
  // id를 달아뒀고 아코디언이 접혀있어도 컨테이너 자체는 항상 렌더되므로, 상태
  // 갱신과 스크롤 타이밍을 맞출 필요 없이 바로 scrollIntoView 호출.
  const jumpToSection = (id: string, openSection?: () => void) => {
    openSection?.();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 2026-10-20: "조치 필요" 타일 → 해당 카드 펼침 + 필터 ON + 스크롤 + 테두리 1.5초 강조.
  // 필터가 줄어든 뒤의 위치로 가도록 스크롤은 다음 프레임에(상태 반영 뒤).
  const jumpToAction = (id: string, openSection: () => void, applyFilter: () => void) => {
    applyFilter();
    openSection();
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    setFlash((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  };

  // 2026-10-04: 매물 등록 폼·수정 카드의 "사업자 조회 바로가기" — 사업자 조회 섹션의 판매 신청을 "선택 안 함(직접 등록)"으로 되돌리고
  // (예전에 어떤 신청 카드에서 골라 둔 게 남아 있으면 직접 등록용 조회가 그 신청에 붙어 버림) 그 위치로 스크롤 + 잠깐 강조
  const goToBizCheck = () => {
    setBizOpen(true);
    setBizPreselect({ id: "", nonce: Date.now() });
    scrollToBizCheck();
  };
  // PC 패널의 등록 폼 → 사업자 조회: 패널만 숨기고(입력 유지) 섹션으로 스크롤, 아래 [작성 중인 등록 폼 다시 열기]로 돌아옴
  const goBizFromFormPanel = () => {
    setFormPanelMin(true);
    requestAnimationFrame(goToBizCheck);
  };

  // 2026-10-01 (커밋 J): 목록 카드를 변수로 — 📱·자동은 기존 1열 순서 그대로, 💻는 세로로 쌓는 3단(CSS columns)에
  // 중요도 순(재고문의(관심 표시) → 판매 신청 → 진행 중 매물 → 파트너 신청 → 실적 → 찾습니다 → 회원 → 관리자)으로 배치.
  // 예전 3칸 격자는 행 높이가 가장 긴 카드에 맞춰져 빈칸이 컸음. 💻에서 0건 카드는 한 줄(제목 + "없어요")로 줄임.
  // 2026-10-02 (PR-C1): 목록 카드는 AdminListCard — 안쪽 스크롤(maxHeight 480) 없이 기본 5건 + [전체 보기].
  // 회원 목록만 기존 20건씩 더보기를 그대로 두고 5건 줄이기는 안 씀(limit null).
  const membersBlock = !perm("members") ? null : (
    <>
      <AdminListCard
        id="members"
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pt-4 flex flex-col gap-3"
        }
        title={<span {...LIST_CARD_TITLE_PROPS}>최근 가입 회원</span>}
        badges={[{ text: `${members.length}명`, tone: "gray" }]}
        open={membersOpen}
        onToggle={() => setMembersOpen((v) => !v)}
        limit={null}
        toolbar={
        <>
        <input
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="번호/상호명 검색"
          className="border-2 border-gray200 rounded-xl px-3 text-sm outline-none focus:border-orange"
          style={{ height: "40px" }}
        />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { key: "all", label: "전체" },
              { key: "business", label: "사업자" },
              { key: "subscribed", label: "구독중" },
              { key: "unsubscribed", label: "미구독" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setMemberFilter(f.key)}
              className="flex-shrink-0 text-xs font-bold rounded-full px-3 py-1.5"
              style={
                memberFilter === f.key
                  ? { background: "#0B2540", color: "#fff" }
                  : { background: "#F5F6F8", color: ADMIN_TEXT.muted }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        {isSuperAdmin && (
          <button onClick={exportMembersCsv} className="self-end text-xs font-bold text-navy underline">
            CSV 내보내기 ({filteredMembers.length}건)
          </button>
        )}
        </>
        }
        empty={
          !loading && (
            <div className="text-center text-gray500 py-6 text-sm">
              {members.length === 0 ? "아직 가입한 회원이 없어요." : "검색/필터 결과가 없어요."}
            </div>
          )
        }
        items={filteredMembers.slice(0, memberShowCount)}
        renderItem={(m) => (
          <div
            key={m.id}
            className="bg-white border border-gray200 rounded-2xl px-4 py-3.5 cursor-pointer"
            onClick={() => setDetailMemberId((cur) => (!isDesktop && cur === m.id ? null : m.id))}
            data-member-card
          >
            {/* 2026-10-23: 카드를 누르면 회원 상세(보기 전용). 카드 안 버튼([번호 보기]·등록증·인증·임명)은 stopPropagation으로 상세를 열지 않음 */}
            {/* 2026-09-28: 데스크톱 3열 레이아웃의 좁은 컬럼 폭에서 전화번호+뱃지가
                줄바꿈 없이 한 줄로 강제돼 카드 자체가 옆으로 넘쳤음(overflow-y만
                걸려 있으면 overflow-x가 자동으로 auto가 되는 CSS 규칙 때문에
                가로 스크롤바까지 생김) — 그 결과 카드 하단 "관리자로 임명" 버튼도
                스크롤해야만 보이는 문제로 이어짐. flex-wrap으로 뱃지가 필요하면
                둘째 줄로 내려가게 해서 카드 폭 안에 항상 들어오도록 수정. */}
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
              <div className="text-base font-bold text-gray900">
                {m.phone_masked ? (
                  <span onClick={(e) => e.stopPropagation()}>
                    <MemberPhoneReveal memberId={m.id} masked={m.phone} adminKey={adminKey} />
                  </span>
                ) : (
                  formatPhone(m.phone)
                )}
                {m.member_no != null && (
                  <span className="text-xs font-bold text-gray500 ml-1.5 whitespace-nowrap">{formatMemberNo(m.member_no)}</span>
                )}
                {m.nickname && <span className="text-sm font-medium text-gray500 ml-1.5">{m.nickname}</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{
                    background: m.push_subscribed ? "#E8F8EC" : "#FDEEE8",
                    color: m.push_subscribed ? ADMIN_TEXT.ok : "#C2410C",
                  }}
                >
                  {m.push_subscribed ? "🔔 구독중" : "🔕 미구독"}
                </span>
                {m.is_business && (
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{ background: "#EAF0F7", color: "#1B3A5C" }}
                  >
                    사업자
                  </span>
                )}
                {m.business_verified && (
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-full inline-flex items-center gap-1"
                    style={{ background: "#E8F8EC", color: ADMIN_TEXT.ok }}
                  >
                    <CheckCircle className="w-3 h-3" /> 인증된 사업자
                  </span>
                )}
              </div>
            </div>
            {m.company_name && (
              <div className="text-sm font-bold text-navy mt-1">{m.company_name}</div>
            )}
            {m.has_business_license && !m.business_verified && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                  style={{ background: "#FFF4E0", color: "#966B00" }}
                >
                  인증 대기중
                </span>
                <button
                  onClick={() => viewBusinessLicense(m.id)}
                  disabled={licenseLoadingId === m.id}
                  className="text-xs font-bold rounded-lg px-3 py-1.5 border border-gray200 text-navy disabled:opacity-60"
                >
                  {licenseLoadingId === m.id ? "불러오는 중..." : "사업자등록증 보기"}
                </button>
                <button
                  onClick={() => verifyBusiness(m.id)}
                  className="text-xs font-bold rounded-lg px-3 py-1.5 text-white"
                  style={{ background: "#0B2540" }}
                >
                  인증 완료 처리
                </button>
              </div>
            )}
            <div className="text-sm text-gray500 mt-1">
              {m.categories.length > 0 ? m.categories.join(", ") : "관심 카테고리 미선택"}
              {" · "}
              {m.regions.length > 0 ? m.regions.join(", ") : "관심 지역 미선택"}
            </div>
            {m.referrer_phone && (
              <div className="text-xs text-gray500 mt-1">추천인: {m.referrer_phone}</div>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <div className="text-xs text-gray500">
                {new Date(m.created_at).toLocaleString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                가입
              </div>
              {role === "최고관리자" && !adminPhones.has(normalizePhone(m.phone)) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openAppoint(m);
                  }}
                  className="text-xs font-bold rounded-lg px-2.5 py-1 border border-gray200 text-navy"
                >
                  관리자로 임명
                </button>
              )}
            </div>
            {/* 모바일·📱: 카드 아래 인라인 펼침(PC는 아래 전체 화면 패널) */}
            {!isDesktop && detailMemberId === m.id && (
              <div onClick={(e) => e.stopPropagation()}>
                <MemberDetailView adminKey={adminKey} memberId={m.id} layout="inline" renderPhone={(id, masked) => <MemberPhoneReveal memberId={id} masked={masked} adminKey={adminKey} />} />
                <button
                  type="button"
                  onClick={() => setDetailMemberId(null)}
                  className="w-full mt-3 text-sm font-bold text-navy border-2 border-gray200 rounded-lg py-2"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        )}
        after={
          filteredMembers.length > memberShowCount && (
            <button
              type="button"
              onClick={() => setMemberShowCount((n) => n + 20)}
              className="text-sm font-bold text-navy border-2 border-gray200 rounded-xl py-2.5"
            >
              더보기 ({filteredMembers.length - memberShowCount}명 더 있음)
            </button>
          )
        }
      />
      {/* 2026-10-23 PC: 회원 상세(보기 전용) 전체 화면 패널 — dirty 없음, 하단 바는 [닫기]만. 제목에는 번호를 넣지 않음(JX 코드만) */}
      {isDesktop && detailMemberId && (
        <AdminFullscreenPanel
          open
          title={`회원 상세 — ${formatMemberNo(members.find((x) => x.id === detailMemberId)?.member_no)}`}
          columns={3}
          onClose={() => setDetailMemberId(null)}
          footer={({ requestClose }) => (
            <button
              type="button"
              onClick={requestClose}
              className="font-bold rounded-lg px-8 py-2.5 border-2 border-gray200 text-navy"
              style={{ fontSize: rem(15) }}
              data-panel-cancel
            >
              닫기
            </button>
          )}
        >
          <MemberDetailView adminKey={adminKey} memberId={detailMemberId} layout="panel" renderPhone={(id, masked) => <MemberPhoneReveal memberId={id} masked={masked} adminKey={adminKey} />} />
        </AdminFullscreenPanel>
      )}
    </>
  );
  const leadsBlock = !perm("leads") ? null : (
    <>
      <AdminListCard
        id="leads"
        flash={flashId === "leads"}
        limit={leadFilter === "uncontacted" ? null : 5}
        className={
          isDesktop
            ? "col-span-2 bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pt-4 flex flex-col gap-3"
        }
        title={
          <span {...LIST_CARD_TITLE_PROPS}>관심 표시한 회원</span>
        }
        badges={[{ text: `${interests.filter(leadNeedsAction).length}건 미연락`, tone: interests.filter(leadNeedsAction).length > 0 ? "orange" : "gray" }]}
        open={leadsOpen}
        onToggle={() => setLeadsOpen((v) => !v)}
        toolbar={
        <>
        {leadFilter === "uncontacted" && <ActionFilterChip label="미연락만" on onToggle={() => setLeadFilter("all")} />}
        <input
          value={leadSearch}
          onChange={(e) => setLeadSearch(e.target.value)}
          placeholder="번호/매물명 검색"
          className="border-2 border-gray200 rounded-xl px-3 text-sm outline-none focus:border-orange"
          style={{ height: "40px" }}
        />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { key: "all", label: "전체" },
              { key: "uncontacted", label: "미연락" },
              { key: "pending", label: "진행중" },
              { key: "completed", label: "성사" },
              { key: "no_deal", label: "불발" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setLeadFilter(f.key)}
              className="flex-shrink-0 text-xs font-bold rounded-full px-3 py-1.5"
              style={
                leadFilter === f.key
                  ? { background: "#0B2540", color: "#fff" }
                  : { background: "#F5F6F8", color: ADMIN_TEXT.muted }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-bold text-gray500">
            <input
              type="checkbox"
              checked={filteredInterests.length > 0 && filteredInterests.every((i) => selectedLeads.has(i.id))}
              onChange={(e) =>
                setSelectedLeads(e.target.checked ? new Set(filteredInterests.map((i) => i.id)) : new Set())
              }
            />
            전체 선택
          </label>
          {isSuperAdmin && (
            <button onClick={exportLeadsCsv} className="text-xs font-bold text-navy underline">
              CSV 내보내기 ({filteredInterests.length}건)
            </button>
          )}
        </div>
        {selectedLeads.size > 0 && (
          <button
            onClick={bulkMarkContacted}
            disabled={bulkProcessing}
            className="text-sm font-bold rounded-xl py-2.5 text-white disabled:opacity-60"
            style={{ background: "#0B2540" }}
          >
            {bulkProcessing ? "처리 중..." : `선택 ${selectedLeads.size}건 연락완료 처리`}
          </button>
        )}
        </>
        }
        empty={
          !loading && (
            leadFilter === "uncontacted" ? (
              <ActionFilterEmpty text="미연락 건이 없어요" onShowAll={() => setLeadFilter("all")} />
            ) : leadFilter === "pending" && interests.length > 0 && !leadSearch.trim() ? (
              <ActionFilterEmpty text="진행중 건이 없어요" onShowAll={() => setLeadFilter("all")} />
            ) : (
              <div className="text-center text-gray500 py-6 text-sm">
                {interests.length === 0 ? "아직 관심 표시가 없어요." : "검색/필터 결과가 없어요."}
              </div>
            )
          )
        }
        items={sortedInterests}
        renderItem={(i) => (
          <div
            key={i.id}
            className="bg-white border rounded-2xl px-4 py-3.5"
            style={{
              borderColor:
                i.outcome === "completed"
                  ? "#34C471"
                  : i.outcome === "no_deal"
                  ? "#E4E7EB"
                  : i.contacted
                  ? "#E4E7EB"
                  : "#FF6F0F",
              ...(leadNeedsAction(i) ? NEEDS_ACTION_ROW_STYLE : {}),
            }}
          >
            {/* 2026-09-29: 매물명(17/800) → 회원 정보 한 줄 → 상태 배지 → 연락·성사/불발 버튼 한 줄 */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedLeads.has(i.id)}
                onChange={() => toggleLeadSelected(i.id)}
                className="w-4 h-4 flex-shrink-0 mt-1.5"
              />
              <div className="flex-1 min-w-0">
                <div className="truncate" style={UI_CARD_TITLE}>
                  {i.deals?.title ?? "삭제된 매물"}
                </div>
                <div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden" style={{ fontSize: rem(15), color: "#4B5563", fontVariantNumeric: "tabular-nums" }}>
                  {i.members?.phone ?? i.phone ? (
                    <a href={`tel:${i.members?.phone ?? i.phone}`} className="font-bold text-navy whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {formatPhone(i.members?.phone ?? i.phone)}
                    </a>
                  ) : (
                    <span className="whitespace-nowrap">{i.members ? "번호 없음" : "연락처 삭제됨 (수집 90일 경과)"}</span>
                  )}
                  {i.members?.member_no != null && <span className="whitespace-nowrap" style={LABEL}>· {formatMemberNo(i.members.member_no)}</span>}
                  {i.members?.business_verified ? (
                    <span className="whitespace-nowrap inline-flex items-center gap-0.5" style={{ fontSize: rem(14), color: ADMIN_TEXT.ok }}>
                      · <CheckCircle className="w-3 h-3" /> 인증 사업자
                    </span>
                  ) : (
                    i.members?.is_business && <span className="whitespace-nowrap" style={LABEL}>· 사업자</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {i.outcome === "completed" && (
                    <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: rem(14), background: "#E8F8EC", color: ADMIN_TEXT.ok }}>
                      성사
                    </span>
                  )}
                  {i.outcome === "no_deal" && (
                    <span className="font-bold px-2 py-0.5 rounded-full bg-gray100 text-gray500" style={{ fontSize: rem(14) }}>
                      불발
                    </span>
                  )}
                  {i.source === "quick" && (
                    <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: rem(14), background: "#FDEEE8", color: "#C2410C" }}>
                      ⚡ 원클릭
                    </span>
                  )}
                  {i.connection_consent_at && (
                    <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ fontSize: rem(14), background: "#E8F8EC", color: ADMIN_TEXT.ok }}>
                      연결 동의 ✓ {formatConsentDate(i.connection_consent_at)}
                    </span>
                  )}
                  {leadNeedsAction(i) && <NeedsActionChip>미연락</NeedsActionChip>}
                </div>
                <div className="mt-1" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
                  {new Date(i.created_at).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {i.outcome === "completed" && i.completed_amount && (
                    <span className="ml-1.5 font-bold" style={{ color: ADMIN_TEXT.ok }}>
                      · {i.completed_amount.toLocaleString()}원
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => {
                  await fetch("/api/admin/interests", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                    body: JSON.stringify({ id: i.id, source: i.source, contacted: !i.contacted }),
                  });
                  load();
                }}
                className="flex-1 font-bold rounded-lg whitespace-nowrap"
                style={{ fontSize: rem(15), minHeight: 40, ...(i.contacted ? { background: "#F5F6F8", color: ADMIN_TEXT.muted } : { background: "#0B2540", color: "#fff" }) }}
              >
                {i.contacted ? "✓ 연락완료" : "연락완료"}
              </button>
            {/* 2026-10-04 F-4: 연결 기록이 있는 리드는 성사·불발을 연결 보드 ⑥에서(리드 값도 거기서 함께 갱신) */}
            {/* 연결이 취소로 끝난 리드: 버튼 없이 회색 표시만(리드 outcome은 그대로 — 성사율에 안 섞임) */}
            {i.outcome === "pending" && i.has_connection && i.connection_state === "cancelled" && (
              <span className="self-center font-bold px-2.5 py-1 rounded-full whitespace-nowrap bg-gray100 text-gray500" style={{ fontSize: rem(14) }} data-testid="lead-conn-cancelled">
                연결 취소됨
              </span>
            )}
            {i.outcome === "pending" && i.has_connection && i.connection_state !== "cancelled" && (
              <button
                type="button"
                onClick={() => jumpToSection("connections", () => setConnectionsOpen(true))}
                className="flex-1 font-bold rounded-lg whitespace-nowrap"
                style={{ fontSize: rem(15), minHeight: 40, background: "#EAF0F7", color: "#1B3A5C" }}
              >
                연결 보드에서 처리
              </button>
            )}
            {i.outcome === "pending" && !i.has_connection && (
              <>
                <button
                  onClick={async () => {
                    const amountStr = prompt("실제 거래 금액을 입력해주세요 (원)", String(i.deals?.deal_price ?? ""));
                    if (amountStr === null) return;
                    const amount = Number(amountStr.replace(/[^\d]/g, ""));
                    await fetch("/api/admin/interests", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                      body: JSON.stringify({ id: i.id, source: i.source, outcome: "completed", completedAmount: amount || null }),
                    });
                    load();
                  }}
                  className="flex-1 font-bold rounded-lg inline-flex items-center justify-center gap-1 whitespace-nowrap"
                  style={{ fontSize: rem(15), minHeight: 40, background: "#E8F8EC", color: ADMIN_TEXT.ok }}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> 성사
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("이 리드를 거래 불발로 처리할까요?")) return;
                    await fetch("/api/admin/interests", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                      body: JSON.stringify({ id: i.id, source: i.source, outcome: "no_deal" }),
                    });
                    load();
                  }}
                  className="flex-1 font-bold rounded-lg bg-gray100 text-gray500 whitespace-nowrap"
                  style={{ fontSize: rem(15), minHeight: 40 }}
                >
                  불발
                </button>
              </>
            )}
            </div>
          </div>
        )}
      />
    </>
  );
  const connectionsBlock = (
    <ConnectionBoard
      adminKey={adminKey}
      isDesktop={isDesktop}
      open={connectionsOpen}
      onToggle={() => setConnectionsOpen((v) => !v)}
      onCounts={setConnCounts}
      onChanged={load}
      assignees={perm("connectionAssign") ? admins.map((a) => ({ id: a.id, name: a.name, role: a.role })) : null}
    />
  );
  const formRequest = openFormFor && openFormFor !== "new" && openFormFor !== "notice" ? requests.find((r) => r.id === openFormFor) ?? null : null;
  // 2026-10-23: PC(isDesktop)는 새 매물·판매 신청 [매물로 등록하기] 폼을 전체 화면 패널에서 연다(모바일·📱는 지금 인라인 그대로)
  const dealFormEls = (
    <>
      {openFormFor === "new" && (
        <DealForm key={`new-${sameSeller?.nonce ?? 0}`} carry={sameSeller?.carry ?? null} onRegistered={load} onNextSame={(c) => setSameSeller({ nonce: Date.now(), carry: c })} adminKey={adminKey} wide={isDesktop} footerSlot={isDesktop ? panelFooterEl : undefined} onDirtyChange={setDealFormDirty} onGoBizCheck={isDesktop ? goBizFromFormPanel : goToBizCheck} sourcedOptions={sourcedOptions} onDone={() => { setOpenFormFor(null); load(); }} />
      )}
      {formRequest && (
        <DealForm
          key={formRequest.id}
          adminKey={adminKey}
          wide={isDesktop}
          footerSlot={isDesktop ? panelFooterEl : undefined}
          onDirtyChange={setDealFormDirty}
          onGoBizCheck={isDesktop ? goBizFromFormPanel : goToBizCheck}
          prefill={requestPrefill(formRequest)}
          requestId={formRequest.id}
          sourcedOptions={sourcedOptions}
          onDone={() => { setOpenFormFor(null); load(); }}
        />
      )}
    </>
  );
  const newDealBlock = (
    <>
      {/* 2026-10-26 admin-layout-v1: PC는 가운데 열 맨 위 — 버튼 두 개를 한 줄(2칸)로, 폼·목록은 전체 폭(col-span-2) */}
      <div className={isDesktop ? "grid grid-cols-2 gap-2 items-stretch" : "px-5 py-4"}>
        <div className={isDesktop && !(isSuperAdmin && openFormFor !== "notice") ? "col-span-2" : undefined} style={isDesktop ? { order: -2 } : undefined}>
        {openFormFor === "new" && !isDesktop ? (
          <button type="button" onClick={closeDealForm} className={`ml-auto ${BTN_CLASS}`} style={{ ...btnStyle("secondary"), minHeight: 40, fontSize: rem(15), padding: "0 16px" }}>
            닫기
          </button>
        ) : (
          <button onClick={() => switchForm("new")} className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
            + 새 매물 직접 등록
          </button>
        )}
        </div>
        {/* 2026-10-03 PR-D: 매물 등록 폼은 한 자리에 하나만 — 새 매물이든 판매자 신청이든 여기(전체 폭)에서 열림. PC는 아래 패널 */}
        <div id="deal-form-slot" className={isDesktop ? "col-span-2" : undefined} style={{ scrollMarginTop: 12 }}>
          {!isDesktop && formRequest && (
            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-xl"
              style={{ background: "#EEF2F7", padding: "10px 14px" }}
            >
              <span className="min-w-0 font-bold" style={{ fontSize: rem(15), color: "#0B2540" }}>
                판매자 신청 &apos;{formRequest.product_name}&apos;을 매물로 등록 중
              </span>
              <button
                type="button"
                onClick={closeDealForm}
                className={`flex-shrink-0 ${BTN_CLASS}`}
                style={{ ...btnStyle("secondary"), minHeight: 36, fontSize: rem(14), padding: "0 14px" }}
              >
                취소
              </button>
            </div>
          )}
          {!isDesktop && dealFormEls}
        </div>
        {isDesktop && formPanelMin && (openFormFor === "new" || !!formRequest) && (
          <button
            type="button"
            onClick={() => setFormPanelMin(false)}
            className="fixed z-40 font-bold text-white rounded-full shadow-lg"
            style={{ right: 24, bottom: 24, background: "#0B2540", padding: "12px 20px", fontSize: rem(15) }}
            data-panel-reopen
          >
            📝 작성 중인 등록 폼 다시 열기
          </button>
        )}
        {isDesktop && (
          <AdminFullscreenPanel
            open={openFormFor === "new" || !!formRequest}
            minimized={formPanelMin}
            title={formRequest ? `매물 등록 — 판매자 신청 '${formRequest.product_name}'` : "새 매물 직접 등록"}
            columns={1}
            dirty={dealFormDirtyState}
            onClose={() => {
              setFormPanelMin(false);
              setOpenFormFor(null);
            }}
            footerSlotRef={setPanelFooterEl}
            footer={({ requestClose }) => (
              <button
                type="button"
                onClick={requestClose}
                className="font-bold rounded-lg px-6 py-2.5 border-2 border-gray200 text-navy"
                style={{ fontSize: rem(15) }}
                data-panel-cancel
              >
                취소
              </button>
            )}
          >
            <div className="w-full max-w-[1400px] mx-auto">{dealFormEls}</div>
          </AdminFullscreenPanel>
        )}

        {/* 2026-09-28: 긴급 공지(부동산·설비 처분) — 재고 매물과 별개 등록 경로.
            방향성 확정 전까지는 메모만 해두기로 했던 부동산/설비 아이디어를
            "긴급 공지"라는 가벼운 트랙으로 구현. 구인/구직은 법률 검토 전까지 제외.
            2026-10-06: 등록(= 푸시 발송) 버튼·폼은 최고관리자만(서버 /api/admin/notices POST도 최고관리자만). 아래 목록·[마감]은 그대로 */}
        {!isSuperAdmin ? null : openFormFor === "notice" ? (
          <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${isDesktop ? "col-span-2" : "mt-3"}`} style={{ background: LIST_CARD_BAND_BG }} data-card-band-x>
            <span {...LIST_CARD_TITLE_PROPS}>긴급 공지 등록 (부동산·설비)</span>
            <button type="button" onClick={() => setOpenFormFor(null)} className={BTN_CLASS} style={{ ...btnStyle("secondary"), minHeight: 40, fontSize: rem(15), padding: "0 16px" }}>
              닫기
            </button>
          </div>
        ) : (
          <button onClick={() => switchForm("notice")} className={`w-full ${isDesktop ? "" : "mt-2"} ${BTN_CLASS}`} style={isDesktop ? { ...btnStyle("secondary"), order: -1 } : btnStyle("secondary")}>
            + 긴급 공지 등록
          </button>
        )}
        {isSuperAdmin && openFormFor === "notice" && (
          <div className={isDesktop ? "col-span-2" : undefined}>
            <NoticeForm adminKey={adminKey} onDone={() => { setOpenFormFor(null); load(); }} />
          </div>
        )}

        {/* 2026-09-28 (2): 등록 폼만 있고 내릴 방법이 없다는 지적 반영 — 등록된
            공지를 한 줄 요약 + [마감]으로 노출. deals의 "조기 마감" 패턴과 동일. */}
        {perm("noticeManage") && notices.length > 0 && (
          <div className={`flex flex-col gap-2 ${isDesktop ? "col-span-2 mt-1" : "mt-3"}`}>
            <div className="text-xs font-bold text-gray500">등록된 긴급 공지 ({notices.length})</div>
            {notices.map((n) => (
              <NoticeAdminRow key={n.id} notice={n} adminKey={adminKey} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </>
  );
  const soonDealCount = activeDeals.filter((d) => isDeadlineSoon(d, nowMs)).length;
  const passedDealCount = activeDeals.filter((d) => isDeadlinePassed(d, nowMs)).length;
  // 기본 = 서버가 준 최신 등록순(created_at desc). 필터 ON이면 마감 시각 오름차순(마감임박 = 가장 임박한 순, 마감 지남 = 가장 오래 지난 순)
  const byCloses = (a: ActiveDeal, b: ActiveDeal) => Date.parse(a.closes_at) - Date.parse(b.closes_at);
  const shownActiveDeals = soonOnly
    ? activeDeals.filter((d) => isDeadlineSoon(d, nowMs)).sort(byCloses)
    : passedOnly
      ? activeDeals.filter((d) => isDeadlinePassed(d, nowMs)).sort(byCloses)
      : activeDeals;
  const activeDealsBlock = (
    <>
      <AdminListCard
        id="active-deals"
        flash={flashId === "active-deals"}
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pb-6 flex flex-col gap-3"
        }
        title={<span {...LIST_CARD_TITLE_PROPS}>진행 중인 매물</span>}
        badges={[
          { text: `${activeDeals.length}건`, tone: "gray" },
          ...(soonDealCount > 0 ? [{ text: `마감임박 ${soonDealCount}`, tone: "orange" as const }] : []),
          ...(passedDealCount > 0 ? [{ text: `마감 지남 ${passedDealCount}`, tone: "orange" as const }] : []),
        ]}
        toolbar={
          soonOnly ? (
            <ActionFilterChip label="마감임박만" on onToggle={() => setSoonOnly(false)} />
          ) : passedOnly ? (
            <ActionFilterChip label="마감 지남만" on onToggle={() => setPassedOnly(false)} />
          ) : undefined
        }
        limit={soonOnly || passedOnly ? null : 5}
        empty={
          !loading &&
          (soonOnly ? (
            <ActionFilterEmpty text="마감 6시간 이내 매물이 없어요" onShowAll={() => setSoonOnly(false)} />
          ) : passedOnly ? (
            <ActionFilterEmpty text="마감 지난 매물이 없어요" onShowAll={() => setPassedOnly(false)} />
          ) : (
            <div className="text-center text-gray500 py-6 text-sm">진행 중인 매물이 없어요.</div>
          ))
        }
        listClassName="flex flex-col gap-3"
        items={shownActiveDeals}
        renderItem={(d) => (
          <ActiveDealCard
            key={d.id}
            deal={d}
            soonLabel={isDeadlineSoon(d, nowMs) ? deadlineChipLabel(d.closes_at, nowMs) : null}
            passedLabel={isDeadlinePassed(d, nowMs) ? "마감 지남" : null}
            adminKey={adminKey}
            onChanged={load}
            canDelete={role === "최고관리자"}
            onGoBizCheck={goToBizCheck}
            panel={isDesktop}
            onClosed={(title) => showDashToast(`"${title}" 마감했어요 · 매물 상세에서 "마감됨"으로 볼 수 있어요`)}
          />
        )}
      />
    </>
  );
  const pendingSellersBlock = (
    <>
      <AdminListCard
        id="pending-sellers"
        flash={flashId === "pending-sellers"}
        limit={sellerOnly ? null : 5}
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pb-8 flex flex-col gap-3"
        }
        title={<span {...LIST_CARD_TITLE_PROPS}>대기 중인 판매자 신청</span>}
        badges={[{ text: `${requests.filter(sellerRequestNeedsAction).length}건`, tone: requests.filter(sellerRequestNeedsAction).length > 0 ? "orange" : "gray" }]}
        open={sellerReqOpen}
        onToggle={() => setSellerReqOpen((v) => !v)}
        toolbar={
          <>
            {loading && <div className="text-center text-gray500 py-8">불러오는 중...</div>}
            {sellerOnly && <ActionFilterChip label="대기만" on onToggle={() => setSellerOnly(false)} />}
          </>
        }
        empty={
          !loading &&
          (sellerOnly ? (
            <ActionFilterEmpty text="대기 건이 없어요" onShowAll={() => setSellerOnly(false)} />
          ) : (
            <div className="text-center text-gray500 py-8 text-sm">대기 중인 신청이 없어요.</div>
          ))
        }
        items={shownSellerRequests}
        renderItem={(r) => (
          <div
            key={r.id}
            className="bg-white border border-gray200 rounded-2xl px-4 py-4"
            style={sellerRequestNeedsAction(r) ? NEEDS_ACTION_ROW_STYLE : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray500 min-w-0">
                <span className="flex-shrink-0">{categoryIcons[r.categories?.name ?? ""] ?? "🗂️"}</span>
                <span className="truncate">{[r.categories?.name, r.regions?.name].filter(Boolean).join(" · ") || "카테고리/지역 미입력"}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {r.buy_request_id && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "#E8F1FB", color: "#1A4B78" }} data-supply-badge>
                    📣 찾습니다 응답
                  </span>
                )}
                {sellerRequestNeedsAction(r) && <NeedsActionChip>대기</NeedsActionChip>}
              </div>
            </div>
            <div className="text-base font-bold text-gray900 mt-1.5">{r.product_name}</div>
            {r.buy_request_id && (
              <div className="text-sm font-bold mt-1 break-words" style={{ color: "#1A4B78" }} data-supply-response>
                찾습니다 응답: {r.buy_requests?.product_name?.trim() || "찾는 상품"}
                {r.buy_request_visible === false && <span className="font-medium" style={{ color: ADMIN_TEXT.muted }}> (노출 종료)</span>}
              </div>
            )}
            {/* 2026-09-29: 재고 유형 배지 (일반 재고는 없음) */}
            <StockTypeBadge value={r.stock_type} className="mt-1" />
            <div className="text-sm text-gray500 mt-1">
              {[r.company_name, r.contact_name, r.contact_phone && formatPhone(r.contact_phone)].filter(Boolean).join(" · ")}
            </div>
            <div className="text-sm text-gray500 mt-1">
              수량 {r.quantity}{r.quantity_unit || "개"}
              {r.min_order_qty ? ` (${formatMoq(r.min_order_qty, r.quantity_unit)})` : ""}
              {isNegotiable(r) ? ` · ${NEGOTIABLE_LABEL}` : r.hope_price ? ` · 희망단가 ${formatDealPrice(r.hope_price, r.quantity_unit, r.price_unit, { exact: true })}` : ""}
              {r.hope_duration_hours
                ? ` · 희망 마감 ${
                    r.hope_duration_hours >= 24
                      ? `${Math.round(r.hope_duration_hours / 24)}일`
                      : `${r.hope_duration_hours}시간`
                  } 후`
                : " · 마감시점 협의 필요"}
            </div>
            {!isNegotiable(r) && r.original_price ? (
              <div className="text-sm text-gray500 mt-1">정상단가 {formatDealPrice(r.original_price, r.quantity_unit, r.price_unit, { exact: true })}</div>
            ) : null}
            {(r.package_unit || r.spec || r.origin || storageSummary(r)) && (
              <div className="text-sm text-gray500 mt-1">
                {[r.package_unit, r.spec, r.origin, storageSummary(r)].filter(Boolean).join(" · ")}
              </div>
            )}
            {r.description && (
              <div className="text-sm text-gray500 mt-1 bg-gray100 rounded-lg px-3 py-2">
                {r.description}
              </div>
            )}
            {(r.pid || (r.manifest_items && r.manifest_items.length > 0)) && (
              <div className="text-sm text-gray500 mt-1 bg-gray100 rounded-lg px-3 py-2">
                🧾 혼합매물{r.pid ? ` · PID# ${r.pid}` : ""}
                {r.manifest_items && r.manifest_items.length > 0 ? ` · 구성품 ${r.manifest_items.length}개 CSV 첨부됨` : ""}
              </div>
            )}
            {r.images && r.images.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {r.images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`신청 사진 ${i + 1}`}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray200"
                  />
                ))}
              </div>
            )}
            {r.video_url && (
              <video
                src={r.video_url}
                controls
                preload="metadata"
                playsInline
                className="w-full rounded-lg mt-2 bg-black"
                style={{ maxHeight: "180px" }}
              />
            )}
            {/* 2026-10-04 판매자 신원 확인: 최신 사업자 조회 결과 + 조회 섹션 바로가기(이 신청 미리 선택) */}
            <div className="flex items-center justify-between gap-2 mt-3">
              <BusinessCheckBadge check={latestBizCheck(r.id)} />
              <button
                type="button"
                onClick={() => {
                  setBizOpen(true);
                  setBizPreselect({ id: r.id, nonce: Date.now() });
                  scrollToBizCheck();
                }}
                className="flex-shrink-0 font-bold rounded-lg text-sm px-3 py-1.5 border border-gray200 text-navy"
              >
                사업자 조회
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => (openFormFor === r.id ? closeDealForm() : switchForm(r.id))}
                disabled={openFormFor !== r.id && !isPassingCheck(latestBizCheck(r.id))}
                className="flex-1 text-navy font-bold border-2 border-navy rounded-xl text-sm disabled:opacity-40"
                style={{ padding: "10px 0" }}
              >
                {openFormFor === r.id ? "닫기" : "매물로 등록하기"}
              </button>
              <button
                onClick={async () => {
                  if (!confirm("이 신청을 거절할까요?")) return;
                  await fetch("/api/admin/seller-requests", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                    body: JSON.stringify({ id: r.id, status: "rejected" }),
                  });
                  load();
                }}
                className="text-gray500 font-bold border-2 border-gray200 rounded-xl text-sm px-4"
              >
                거절
              </button>
            </div>
            {r.buy_request_id && (
              <div className="mt-1.5 text-sm text-gray500" data-supply-note>
                ※ 공개 여부는 판매자 확인 후 등록해 주세요
              </div>
            )}
            {openFormFor !== r.id && !isPassingCheck(latestBizCheck(r.id)) && (
              <div className="mt-1.5 text-sm text-gray500">{NOT_CHECKED_MESSAGE}</div>
            )}
          </div>
        )}
      />
    </>
  );
  // 2026-10-23: [+ 찾습니다 대신 등록] — 회원 화면 /buy/new를 새 탭으로 열기만(다른 동작 없음). members 권한(최고관리자·관리자)만.
  // 2026-10-26: 사업자 조회 위에서 왼쪽 열(관심 표시한 회원 아래)로 이동
  const buyProxyBlock = !perm("members") ? null : (
    <div className={isDesktop ? "" : "px-5 pb-3"}>
      <a
        href="/buy/new"
        target="_blank"
        rel="noopener"
        className={`flex items-center justify-center w-full ${BTN_CLASS}`}
        style={btnStyle("secondary")}
        data-buy-proxy-link
      >
        + 찾습니다 대신 등록
      </a>
    </div>
  );
  // 2026-10-04 판매자 신원 확인: "사업자 조회" — 판매자 신청 목록 바로 위(📱 세로 순서·💻 3단 모두)
  const bizCheckBlock = (
    <>
      <BusinessCheckSection
        adminKey={adminKey}
        adminRole={adminRole}
        requests={requests}
        phoneMatch={bizPhoneMatch}
        preselect={bizPreselect}
        open={bizOpen}
        onToggle={() => setBizOpen((v) => !v)}
        // 2026-10-28: 접혀 있을 땐 띠 아래 빈 여백을 줄임(PC 19→11px·모바일 pb-6→pb-3) — 펼치면 그대로
        className={
          isDesktop
            ? `bg-white border border-gray200 rounded-2xl px-4 pt-4 ${bizOpen ? "pb-4" : "pb-2"} flex flex-col gap-3`
            : `px-5 ${bizOpen ? "pb-6" : "pb-3"} flex flex-col gap-3`
        }
        onChanged={() => loadBizChecks(requests.map((r) => r.id))}
      />
    </>
  );
  const partnerReqBlock = !perm("partnerView") ? null : (
    <>
      <AdminListCard
        as="section"
        id="partner-requests"
        flash={flashId === "partner-requests"}
        limit={partnerOnly ? null : 5}
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4"
            : "mt-8 px-5"
        }
        title={
          <h2 {...LIST_CARD_TITLE_PROPS}>🏅 공식 점핑파트너 신청</h2>
        }
        badges={[{ text: `${partnerRequests.filter(partnerRequestNeedsAction).length}건 심사중`, tone: partnerRequests.filter(partnerRequestNeedsAction).length > 0 ? "orange" : "gray" }]}
        open={partnerReqOpen}
        onToggle={() => setPartnerReqOpen((v) => !v)}
        toolbar={
          <div className="mt-3 flex flex-col">
            <ActionFilterChip label="심사중만" on={partnerOnly} onToggle={() => setPartnerOnly((v) => !v)} />
          </div>
        }
        empty={partnerOnly ? <ActionFilterEmpty text="심사중 건이 없어요" onShowAll={() => setPartnerOnly(false)} /> : undefined}
        listClassName="mt-3 flex flex-col gap-2"
        items={sortedPartnerRequests}
        renderItem={(r) => (
            <div
              key={r.id}
              className="bg-white border border-gray200 rounded-2xl px-4 py-4 text-sm"
              style={partnerRequestNeedsAction(r) ? NEEDS_ACTION_ROW_STYLE : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gray900">{r.members?.company_name ?? r.members?.phone ?? r.member_id}</span>
                {partnerRequestNeedsAction(r) ? (
                  <NeedsActionChip>심사중</NeedsActionChip>
                ) : (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={r.status === "approved" ? { background: "#E8F8EC", color: ADMIN_TEXT.ok } : { background: "#F1F1EF", color: ADMIN_TEXT.muted }}
                  >
                    {r.status === "approved" ? "승인됨" : "거절됨"}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-gray500">업종: {r.business_type}</p>
              <p className="text-gray500">채널: {r.channel_info}</p>
              {r.message && <p className="text-gray500">메모: {r.message}</p>}
              {r.status === "pending" && (
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => reviewPartnerRequest(r.id, "approved")}
                    className="text-white font-bold rounded-lg text-xs px-3.5 py-2"
                    style={{ background: "#0B2540" }}
                  >
                    승인
                  </button>
                  <button
                    onClick={() => reviewPartnerRequest(r.id, "rejected")}
                    className="font-bold rounded-lg text-xs px-3.5 py-2 border border-gray200 text-gray500"
                  >
                    거절
                  </button>
                </div>
              )}
            </div>
        )}
      />
    </>
  );
  const partnersOverviewBlock = !perm("partnerView") ? null : (
    <>
      {/* 2026-09-27: 운영자가 승인된 파트너 전원의 추천 실적을 한눈에 보는
          집계 대시보드 — 위 섹션(신청 승인/거절)과는 별개로, 이미 승인된
          파트너들의 성과 비교용. 승인 즉시 여기 0건으로 나타남. */}
      <AdminListCard
        as="section"
        id="partners-overview"
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4"
            : "mt-8 px-5"
        }
        title={
          <h2 {...LIST_CARD_TITLE_PROPS}>📊 점핑파트너 실적</h2>
        }
        badges={[{ text: `${partnersOverview.length}명`, tone: "gray" }]}
        open={partnersOverviewOpen}
        onToggle={() => setPartnersOverviewOpen((v) => !v)}
        empty={<p className="mt-3 text-sm text-gray500">아직 승인된 파트너가 없어요.</p>}
        listClassName="mt-3 flex flex-col gap-2"
        items={partnersOverview}
        renderItem={(p, i) => (
                <div key={p.id} className="bg-white border border-gray200 rounded-2xl px-4 py-3.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray900">
                      {i === 0 && p.total_referrals > 0 && "🥇 "}
                      {p.company_name ?? p.name ?? p.phone}
                    </span>
                    <span className="text-xs text-gray500 flex-shrink-0">
                      {p.member_no != null ? `#${p.member_no}` : p.phone}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4">
                    <div>
                      <div className="font-mono font-bold text-navy" style={{ fontSize: rem(17) }}>
                        {p.total_referrals}
                      </div>
                      <div className="text-xs text-gray500">총 추천</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold text-navy" style={{ fontSize: rem(17) }}>
                        {p.this_month_referrals}
                      </div>
                      <div className="text-xs text-gray500">이번달</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold text-navy" style={{ fontSize: rem(17) }}>
                        {p.business_verified_referrals}
                      </div>
                      <div className="text-xs text-gray500">사업자 인증</div>
                    </div>
                  </div>
                </div>
        )}
      />
    </>
  );
  const buyRequestsBlock = !perm("buyRequests") ? null : (
    <>
      <AdminListCard
        id="buy-requests"
        flash={flashId === "buy-requests"}
        limit={buyOnly ? null : 5}
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pb-8 flex flex-col gap-3"
        }
        title={
          <span {...LIST_CARD_TITLE_PROPS}>🔍 이런 재고 찾습니다</span>
        }
        badges={[{ text: `${buyRequests.filter(buyRequestNeedsAction).length}건 미연락`, tone: buyRequests.filter(buyRequestNeedsAction).length > 0 ? "orange" : "gray" }]}
        open={buyReqOpen}
        onToggle={() => setBuyReqOpen((v) => !v)}
        toolbar={
          <div className="flex flex-col">
            <ActionFilterChip label="미연락만" on={buyOnly} onToggle={() => setBuyOnly((v) => !v)} />
          </div>
        }
        empty={
          !loading &&
          (buyOnly ? (
            <ActionFilterEmpty text="미연락 건이 없어요" onShowAll={() => setBuyOnly(false)} />
          ) : (
            <div className="text-center text-gray500 py-6 text-sm">등록된 구매 희망이 없어요.</div>
          ))
        }
        items={sortedBuyRequests}
        renderItem={(b) => (
          <div
            key={b.id}
            className="bg-white border border-gray200 rounded-2xl px-4 py-4"
            style={buyRequestNeedsAction(b) ? NEEDS_ACTION_ROW_STYLE : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray500 min-w-0">
                <span className="flex-shrink-0">{categoryIcons[b.categories?.name ?? ""] ?? "🗂️"}</span>
                <span className="truncate">{b.categories?.name ?? "카테고리 미지정"} · {b.regions?.name ?? "전국 가능"}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {buyRequestNeedsAction(b) && <NeedsActionChip>미연락</NeedsActionChip>}
                {b.outcome === "matched" && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "#E8F8EC", color: ADMIN_TEXT.ok }}>
                    매칭 완료
                  </span>
                )}
                {b.outcome === "no_match" && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray100 text-gray500 whitespace-nowrap">
                    매칭 불발
                  </span>
                )}
              </div>
            </div>
            <div className="text-base font-bold text-gray900 mt-1.5">{b.product_name}</div>
            {(b.supply_pending ?? 0) > 0 && (
              <div className="mt-1.5">
                {/* 2026-10-26 공급 제안 N건(대기 중만) — 누르면 대기 중인 판매자 신청 카드로 이동(필터는 그대로) */}
                <button
                  type="button"
                  onClick={() => jumpToAction("pending-sellers", () => setSellerReqOpen(true), () => {})}
                  className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1"
                  style={{ background: "#FDEEE8", color: "#C2410C" }}
                  data-supply-chip
                >
                  📦 공급 제안 {b.supply_pending}건 ›
                </button>
              </div>
            )}
            <div className="text-sm text-gray500 mt-1">
              {/* 2026-09-26: 카드 전체는 눌러도 반응이 없어 혼란을 줬음(정보가
                  이미 다 펼쳐져 있어 상세 모달 자체가 없는 구조) — 실제로
                  누를 만한 유일한 액션인 전화번호를 tel: 링크로 만들어 탭하면
                  바로 전화가 걸리게 함. */}
              {b.contact_phone ? (
                <a href={`tel:${b.contact_phone}`} className="underline font-bold" style={{ color: "#0B2540" }}>
                  📞 {formatPhone(b.contact_phone)}
                </a>
              ) : (
                <span>연락처 삭제됨 (수집 90일 경과)</span>
              )}
              {b.quantity ? ` · 희망수량 ${b.quantity}` : ""}
              {b.hope_price ? ` · 희망가 ${formatPriceWithUnit(b.hope_price, b.hope_price_unit, { exact: true })} 이하` : ""}
            </div>
            {b.description && (
              <div className="text-sm text-gray500 mt-1 bg-gray100 rounded-lg px-3 py-2">
                <span className="font-bold" style={{ color: ADMIN_TEXT.faint }}>
                  💬 메모{" "}
                </span>
                {b.description}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => {
                  await fetch("/api/admin/buy-requests", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                    body: JSON.stringify({ id: b.id, contacted: !b.contacted }),
                  });
                  load();
                }}
                className="flex-1 text-xs font-bold rounded-lg py-2"
                style={
                  b.contacted
                    ? { background: "#F5F6F8", color: ADMIN_TEXT.muted }
                    : { background: "#FDEEE8", color: "#C2410C" }
                }
              >
                {/* 2026-09-26: "매칭 완료/불발"(outcome, 재고 매칭 여부) 배지와
                    나란히 있으면 이 버튼이 뭘 가리키는지 헷갈렸음 — 매칭과
                    무관하게 "구매 희망자한테 전화했는지"만 추적하는 버튼이라는
                    걸 라벨에 명시. */}
                {b.contacted ? "구매자 연락 완료" : "구매자 연락 전"}
              </button>
              {b.outcome === "pending" && (
                <>
                  <button
                    onClick={async () => {
                      await fetch("/api/admin/buy-requests", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                        body: JSON.stringify({ id: b.id, outcome: "matched" }),
                      });
                      load();
                    }}
                    className="flex-1 text-xs font-bold rounded-lg py-2"
                    style={{ background: "#E8F8EC", color: ADMIN_TEXT.ok }}
                  >
                    매칭 완료
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("매칭 불발로 처리할까요?")) return;
                      await fetch("/api/admin/buy-requests", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                        body: JSON.stringify({ id: b.id, outcome: "no_match" }),
                      });
                      load();
                    }}
                    className="flex-1 text-xs font-bold rounded-lg py-2 bg-gray100 text-gray500"
                  >
                    매칭 불발
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      />
    </>
  );
  const adminsBlock = role === "최고관리자" ? (
        <div id="admins" className={isDesktop ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3" : "px-5 pt-4 pb-8 flex flex-col gap-3"}>
          <div className={`${bandBleedClass(isDesktop ? "p-4" : "px-5")} py-2`} style={{ background: LIST_CARD_BAND_BG }} data-card-band-x>
            <button
              type="button"
              onClick={() => setAdminsOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left"
              style={{ minHeight: 44 }}
              data-card-toggle
            >
              <span className="min-w-0 flex items-center gap-x-2 gap-y-1 flex-wrap">
                <span {...LIST_CARD_TITLE_PROPS}>관리자 목록</span>
                <span className="inline-flex items-center rounded-full font-bold whitespace-nowrap" style={{ fontSize: rem(14), padding: "2px 10px", background: "#E5E7EB", color: "#374151" }} data-card-badge="gray">{admins.length}명</span>
              </span>
              <span className="font-bold flex-shrink-0 flex items-center justify-center" style={{ minWidth: 44, minHeight: 44, fontSize: rem(14), color: "#3730A3" }}>{adminsOpen ? "접기 ▲" : "펼치기 ▼"}</span>
            </button>
          </div>
          {adminsOpen && (
          <>
          {admins.map((a) => (
            <div
              key={a.id}
              className="bg-white border border-gray200 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-2"
            >
              <div>
                <div className="text-base font-bold text-gray900">
                  {a.name}
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full ml-1.5"
                    style={{ background: "#EAF0F7", color: "#1B3A5C" }}
                  >
                    {a.role}
                  </span>
                </div>
                <div className="text-xs text-gray500 mt-1">{a.phone ? formatPhone(a.phone) : "번호 미연결"}</div>
                <div className="text-xs text-gray500 mt-0.5">
                  {a.last_login_at
                    ? `마지막 로그인 ${new Date(a.last_login_at).toLocaleString("ko-KR", {
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "아직 로그인 기록 없음"}
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-1.5">
                <select
                  aria-label={`${a.name} 역할 변경`}
                  value={a.role}
                  onChange={(e) => changeAdminRole(a, e.target.value)}
                  disabled={roleChangingId === a.id}
                  className="text-xs font-bold rounded-lg px-2 py-1.5 border border-gray200 text-navy bg-white disabled:opacity-60"
                  data-testid="admin-role-select"
                >
                  {["최고관리자", "관리자", "점핑매니저"].map((r) => (
                    <option key={r} value={r}>
                      {roleChangingId === a.id && r === a.role ? "변경 중..." : r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeAdmin(a)}
                  disabled={removingAdminId === a.id}
                  className="text-xs font-bold rounded-lg px-3 py-1.5 border border-gray200 text-orange disabled:opacity-60"
                >
                  {removingAdminId === a.id ? "처리 중..." : "해제"}
                </button>
              </div>
            </div>
          ))}
          </>
          )}
        </div>
  ) : null;

  return (
    <main
      data-admin-root
      className={isDesktop ? `flex flex-col min-h-screen mx-auto w-full ${ADMIN_MAX_W} bg-white shadow-sm` : "flex flex-col min-h-screen mx-auto w-full max-w-md bg-white shadow-sm"}
      // 2026-10-01 (커밋 J): 맨 아래 목록이 화면 끝에 붙어 "끝난 것처럼" 보이던 문제 — 하단 여백 pb-24 + 안전 영역
      style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <SessionBanner className="sticky top-0 z-40" offsetVar />
      <div
        className="px-5 pt-6 pb-5 text-white flex items-center justify-between"
        style={{ background: "linear-gradient(120deg,#04101C,#1A4B78)" }}
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/" className="bg-white rounded-lg px-3.5 py-2.5 inline-block">
              <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
            </Link>
            <span className="text-white/70 text-sm tracking-wide">Powered by JumpX</span>
          </div>
          <div className="text-xs font-bold tracking-widest" style={{ color: "#FFD166" }}>
            관리자
          </div>
          <h1 className="font-display text-xl mt-1">매물 관리</h1>
          {adminName && (
            <div className="text-xs text-white/60 mt-0.5">
              {adminName} · {adminRole}
              {sessionExpiresAt && (
                <>
                  {" "}
                  · <SessionCountdown expiresAt={sessionExpiresAt} />
                </>
              )}
            </div>
          )}
          {interests.filter(leadNeedsAction).length > 0 && (
            <div className="text-xs font-bold mt-1" style={{ color: "var(--color-brandOrangeAccent)" }}>
              🔔 미연락 리드 {interests.filter(leadNeedsAction).length}건
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex rounded-lg overflow-hidden border border-white/25">
            {(
              [
                { mode: "auto", label: "자동" },
                { mode: "mobile", label: "📱" },
                { mode: "desktop", label: "💻" },
              ] as const
            ).map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className="text-xs font-bold px-2 py-1"
                style={
                  viewMode === mode
                    ? { background: "#fff", color: "#0B2540" }
                    : { background: "transparent", color: "rgba(255,255,255,0.7)" }
                }
              >
                {label}
              </button>
            ))}
          </div>
          {/* 2026-09-27: /p/[slug] 영업 데모 링크가 어디서도 노출이 안 돼 운영자가
              직접 못 찾는다는 지적 — 관리자 헤더에 새 탭 링크로 추가. 회원용 UI가
              아니라 후보 파트너사에 보낼 때 운영자가 주소만 복사하러 오는 용도. */}
          <a
            href="/p/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/70 font-bold underline"
          >
            파트너 데모 보기 →
          </a>
          <button
            onClick={() => {
              setShowChangePassword(true);
              setChangePwError("");
              setChangePwSuccess(false);
            }}
            className="text-xs text-white/70 font-bold underline"
          >
            비밀번호 변경
          </button>
          <button onClick={onLogout} className="text-sm text-white/70 font-bold">
            로그아웃
          </button>
        </div>
      </div>

      <AdminJumpBar
        chips={[
          { label: "조치", targetId: "actions" },
          { label: "매물", targetId: "active-deals" },
          ...(perm("buyRequests") ? [{ label: "구매요청", targetId: "buy-requests" }] : []),
          ...(perm("members") ? [{ label: "회원", targetId: "members" }] : []),
          ...(perm("dashboard") ? [{ label: "지표", targetId: "metrics" }] : []),
        ]}
      />

      {/* 2026-09-29: 시각적 위계 — ① 조치 필요 → ② 핵심 지표 → ③ 참고 현황·목록.
          색은 의미 있을 때만(조치 1건↑ 주황/빨강, 0건 회색, 일반 지표 남색 1색). 막대는 CSS만(DashboardViz). */}
      <div className={isDesktop ? `px-8 pt-5 ${ADMIN_MAX_W} mx-auto w-full flex flex-col gap-6` : "px-5 pt-5 flex flex-col gap-6"}>
        {(() => {
          const soonDeals = soonDealCount;
          const actions = [
            { label: "미연락 리드", value: interests.filter(leadNeedsAction).length, urgent: true, go: () => jumpToAction("leads", () => setLeadsOpen(true), () => setLeadFilter("uncontacted")) },
            // 2026-10-04 F-4: 24시간 단계 변화 없는 거래 연결 (거래 연결 카드가 불러온 값)
            { label: "멈춘 연결", value: connCounts.stuck, urgent: true, go: () => jumpToSection("connections", () => setConnectionsOpen(true)) },
            { label: "마감임박(6h)", value: soonDeals, urgent: true, go: () => jumpToAction("active-deals", () => {}, () => { setPassedOnly(false); setSoonOnly(true); }) },
            // 2026-10-24: 마감이 지났는데 아직 진행 중(active)인 매물 — 회색 타일(빨강 아님). 자동으로 닫히지 않아 [마감]으로 정리
            { label: "마감 지남", value: passedDealCount, urgent: false, gray: true, go: () => jumpToAction("active-deals", () => {}, () => { setSoonOnly(false); setPassedOnly(true); }) },
            { label: "대기 판매신청", value: requests.filter(sellerRequestNeedsAction).length, urgent: false, go: () => jumpToAction("pending-sellers", () => setSellerReqOpen(true), () => setSellerOnly(true)) },
            { label: "재고문의 미연락", value: buyRequests.filter(buyRequestNeedsAction).length, urgent: false, go: () => jumpToAction("buy-requests", () => setBuyReqOpen(true), () => setBuyOnly(true)) },
          ];
          // 2026-10-10: 권한 없는 타일은 뺌(점핑매니저: 미연락 리드·재고문의 미연락 없음)
          const tilePerm: Record<string, AdminPerm> = { "미연락 리드": "leads", "재고문의 미연락": "buyRequests" };
          const shown = actions.filter((a) => !tilePerm[a.label] || perm(tilePerm[a.label]));
          const hot = shown.filter((a) => a.value > 0);
          const cold = shown.filter((a) => a.value === 0);
          return (
            <section aria-label="조치 필요" id="actions" style={{ scrollMarginTop: 56 }}>
              <h2 style={UI_SECTION}>⚡ 조치 필요</h2>
              {hot.length > 0 && (
                <div className={`mt-2.5 grid gap-2 ${isDesktop ? "grid-cols-5" : "grid-cols-2"}`}>
                  {hot.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.go}
                      className="rounded-2xl text-left"
                      style={
                        a.gray
                          ? { padding: "14px 14px 12px", background: "#F3F4F6", border: "1px solid #D1D5DB" }
                          : { padding: "14px 14px 12px", background: a.urgent ? "#FDECEC" : "#FDEEE8", border: `1px solid ${a.urgent ? "#F5B5B5" : "#F5C4A8"}` }
                      }
                      data-tile={a.label}
                    >
                      <div style={{ ...BIG_NUM, color: a.gray ? "#374151" : a.urgent ? "#DC2626" : "#C2410C" }}>{a.value}</div>
                      <div className="font-bold mt-0.5" style={{ fontSize: rem(14), color: a.gray ? "#374151" : a.urgent ? "#B91C1C" : "#C2410C" }}>{a.label}</div>
                      <div className="mt-2" style={{ ...UI_LINK, color: a.gray ? "#374151" : a.urgent ? "#B91C1C" : "#C2410C" }}>바로 처리 →</div>
                    </button>
                  ))}
                </div>
              )}
              {hot.length === 0 && (
                <p className="mt-2.5 font-bold rounded-2xl" style={{ fontSize: rem(18), color: "#15703A", background: "#E8F8EC", padding: "14px 16px" }} data-all-done>
                  ✓ 모두 처리됨
                </p>
              )}
              {cold.length > 0 && hot.length > 0 && (
                <p className="mt-2" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
                  {cold.map((a) => `${a.label} 0`).join(" · ")}
                </p>
              )}
            </section>
          );
        })()}
      </div>

      {/* 2026-10-26 admin-layout-v1: 업무 카드는 PC 고정 3열(masonry 대신) — 높이에 따라 카드 위치가 바뀌지 않음.
          좌 = 관심 표시한 회원 → [+ 찾습니다 대신 등록] → 이런 재고 찾습니다 → 거래 연결
          중 = [+ 새 매물 직접 등록]·[+ 긴급 공지 등록] → 대기 중인 판매자 신청 → 진행 중인 매물
          우 = 사업자 조회(기본 접힘) → 공식 점핑파트너 신청 → 점핑파트너 실적 → 최근 가입 회원 → 관리자 목록
          📱·360 폭은 같은 순서(좌 → 중 → 우)로 1열 — 같은 트리라 보기를 바꿔도 등록 폼이 다시 마운트되지 않음(2026-10-03 PR-D).
          열 높이 보정 없음. PC에서 0건 카드는 한 줄(제목 + "없어요")로 줄임. */}
      {(() => {
        const slot = (key: string, title: string, count: number, node: React.ReactNode) =>
          !node ? null : !isDesktop ? (
            <Fragment key={key}>{node}</Fragment>
          ) : (
            <div key={key} className="min-w-0">
              {count === 0 ? (
                <div id={key} className="bg-white border border-gray200 rounded-2xl flex items-center justify-between gap-2" style={{ padding: "12px 16px" }}>
                  <span {...CARD_TITLE_PROPS}>{title}</span>
                  <span style={LABEL}>없어요</span>
                </div>
              ) : (
                node
              )}
            </div>
          );
        const col = (key: string, children: React.ReactNode) => (
          <div className={isDesktop ? "flex flex-col gap-4 min-w-0" : "contents"} data-col={key}>
            {children}
          </div>
        );
        return (
          <div id="work-cards" className={isDesktop ? `px-8 pb-6 ${ADMIN_MAX_W} mx-auto w-full` : "contents"}>
            <div className={isDesktop ? "grid grid-cols-3 gap-4 items-start" : "contents"}>
              {col("left", <>
                {slot("leads", "관심 표시한 회원", interests.length, leadsBlock)}
                {buyProxyBlock && (isDesktop ? <div key="buy-proxy">{buyProxyBlock}</div> : <Fragment key="buy-proxy">{buyProxyBlock}</Fragment>)}
                {slot("buy-requests", "🔍 이런 재고 찾습니다", buyRequests.length, buyRequestsBlock)}
                {slot("connections", "거래 연결", connCounts.open + connCounts.closed === 0 ? 0 : -1, connectionsBlock)}
              </>)}
              {col("middle", <>
                <div className={isDesktop ? "" : "contents"}>{newDealBlock}</div>
                {slot("pending-sellers", "대기 중인 판매자 신청", requests.length, pendingSellersBlock)}
                {slot("active-deals", "진행 중인 매물", activeDeals.length, activeDealsBlock)}
              </>)}
              {col("right", <>
                {slot("business-check", "사업자 조회", -1, bizCheckBlock)}
                {slot("partner-requests", "🏅 공식 점핑파트너 신청", partnerRequests.length, partnerReqBlock)}
                {slot("partners-overview", "📊 점핑파트너 실적", partnersOverview.length, partnersOverviewBlock)}
                {slot("members", "최근 가입 회원", members.length, membersBlock)}
                {slot("admins", "관리자 목록", -1, adminsBlock)}
              </>)}
            </div>
          </div>
        );
      })()}

      {/* 2026-10-26 admin-layout-v1: 지표는 업무 카드 아래로(조치 필요 → 업무 카드 → 지표) */}
      {perm("dashboard") && (
        <div id="metrics" className={isDesktop ? `px-8 pb-6 ${ADMIN_MAX_W} mx-auto w-full flex flex-col gap-6` : "px-5 pb-6 flex flex-col gap-6"} style={{ scrollMarginTop: 56 }}>
        <section aria-label="핵심 지표">
          <h2 style={UI_SECTION}>📈 핵심 지표</h2>
          {metrics?.excluded && (
            <p className="mt-1" style={LABEL}>
              관리자·테스트 계정 {metrics.excluded.members}명과 [테스트] 매물은 빼고 셌어요
              {metrics.excluded.source === "admin_phones" ? " (테스트 계정 표시 SQL 실행 전 — 관리자 번호만 제외)" : ""}
            </p>
          )}
          <div className={`mt-2.5 grid gap-2 ${isDesktop ? "grid-cols-4" : "grid-cols-1"}`}>
            {metrics ? (
              <>
                <RatioMetric label="알림 활성 회원 비율" num={metrics.members.withPush} den={metrics.members.total} unit="명" note="푸시 구독이 1개 이상이고 알림을 끄지 않은 회원 / 전체 회원" />
                <RatioMetric label="알림 → 확인 전환율 (최근 7일)" num={metrics.notifications7d.clicked} den={metrics.notifications7d.sent} unit="건" note="알림을 눌러 매물을 연 건 / 발송 건" />
              </>
            ) : (
              <div className={CARD} style={LABEL}>핵심 지표를 불러오지 못했어요.</div>
            )}
            <div className={`${CARD} ${isDesktop ? "col-span-2" : ""}`}>
              <div className="font-bold" style={LABEL}>리드 흐름</div>
              <div className="mt-2.5">
                <FunnelBars
                  steps={[
                    { label: "전체 리드", value: interests.length },
                    { label: "연락완료", value: interests.filter((i) => i.contacted).length },
                    { label: "거래 성사", value: interests.filter((i) => i.outcome === "completed").length },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {metrics && (
          <section aria-label="최근 7일 추세">
            <h2 style={UI_SECTION}>🗓️ 최근 7일 추세</h2>
            <div className={`mt-2.5 grid gap-2 ${isDesktop ? "grid-cols-3" : "grid-cols-1"}`}>
              <DailyBars title="신규 가입" days={metrics.daily.days} values={metrics.daily.signups} />
              <DailyBars title="등록 매물" days={metrics.daily.days} values={metrics.daily.deals} />
              <DailyBars title="리드" days={metrics.daily.days} values={metrics.daily.leads} />
            </div>
          </section>
        )}

        <section aria-label="참고 현황">
          <h2 style={UI_SECTION}>참고 현황</h2>
          <div className={`mt-2.5 grid gap-2 ${isDesktop ? "grid-cols-4" : "grid-cols-2"}`}>
            {[
              { label: "오늘 신규가입", value: (metrics?.counts?.todaySignups ?? members.filter((m) => isToday(m.created_at)).length).toLocaleString() },
              { label: "오늘 등록매물", value: (metrics?.counts?.todayDeals ?? activeDeals.filter((d) => isToday(d.created_at)).length).toLocaleString() },
              { label: "오늘 구매희망", value: buyRequests.filter((b) => isToday(b.created_at)).length.toLocaleString() },
              { label: "전체 회원", value: (metrics?.counts?.membersTotal ?? members.length).toLocaleString() },
              { label: "사업자 인증", value: (metrics?.counts?.businessVerified ?? members.filter((m) => m.business_verified).length).toLocaleString() },
              {
                label: "리드 성사율",
                value:
                  interests.filter((i) => i.outcome !== "pending").length > 0
                    ? `${Math.round((interests.filter((i) => i.outcome === "completed").length / interests.filter((i) => i.outcome !== "pending").length) * 100)}%`
                    : "—",
              },
              {
                label: "누적 성사금액",
                value: `${interests.filter((i) => i.outcome === "completed").reduce((sum, i) => sum + (i.completed_amount ?? 0), 0).toLocaleString()}원`,
                wide: true,
              },
              {
                label: "내 견적함 오픈 알림 신청",
                value: quotesWaitlist === null ? "—" : `${quotesWaitlist.total}명`,
                sub: quotesWaitlist === null ? undefined : `견적을 받는 쪽 ${quotesWaitlist.receiver} / 보내는 쪽 ${quotesWaitlist.sender}`,
                sub2: `점프엑스 둘러보기 오픈 알림 ${jumpxWaitlist === null ? "—" : `${jumpxWaitlist}명`}`,
                wide: true,
              },
            ].map((stat) => (
              <div key={stat.label} className={`${CARD} ${stat.wide && !isDesktop ? "col-span-2" : ""}`} style={{ padding: "12px 14px" }}>
                <div style={{ ...BIG_NUM, color: "#0B2540" }}>{stat.value}</div>
                <div className="mt-0.5 font-bold" style={LABEL}>{stat.label}</div>
                {stat.sub && <div style={LABEL}>{stat.sub}</div>}
                {"sub2" in stat && stat.sub2 && <div style={LABEL} data-waitlist-jumpx>{stat.sub2}</div>}
              </div>
            ))}
          </div>
        </section>

        <section aria-label="KPI 기록">
          <h2 style={UI_SECTION}>🗂️ KPI 기록 <span style={{ ...LABEL, fontWeight: 400 }}>(최근 30일 · 매일 00:05 저장)</span></h2>
          {kpiDaily === null ? (
            <div className={`${CARD} mt-2.5`} style={LABEL}>아직 기록이 없어요. KPI 매일 저장 SQL(schema.sql 커밋 K)을 실행하면 다음 날부터 쌓여요.</div>
          ) : kpiDaily.length === 0 ? (
            <div className={`${CARD} mt-2.5`} style={LABEL}>아직 저장된 날이 없어요. 매일 00:05에 전날 값이 저장돼요.</div>
          ) : (
            <div className="mt-2.5 bg-white border border-gray200 rounded-2xl overflow-x-auto" style={{ fontVariantNumeric: "tabular-nums" }}>
              <table className="w-full text-left" style={{ fontSize: rem(14), minWidth: 560 }}>
                <thead>
                  <tr className="bg-gray100 text-gray500">
                    {["날짜", "회원", "알림 도달 가능", "진행 매물", "신규 가입", "리드", "알림 발송·클릭"].map((h) => (
                      <th key={h} className="font-bold px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(kpiAll ? kpiDaily : kpiDaily.slice(0, 7)).map((r) => (
                    <tr key={r.snapshot_date} style={{ borderTop: "1px solid #F1F3F5" }}>
                      <td className="px-3 py-2 whitespace-nowrap">{r.snapshot_date.slice(5).replace("-", ".")}</td>
                      <td className="px-3 py-2">{r.members_total.toLocaleString()}</td>
                      <td className="px-3 py-2">{r.push_reachable_members.toLocaleString()}</td>
                      <td className="px-3 py-2">{r.deals_active.toLocaleString()}</td>
                      <td className="px-3 py-2">{r.members_new.toLocaleString()}</td>
                      <td className="px-3 py-2">{(r.leads_member_new + r.leads_guest_new).toLocaleString()}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.notifications_sent.toLocaleString()} · {r.notifications_clicked.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {kpiDaily && kpiDaily.length > 7 && (
            <button type="button" onClick={() => setKpiAll((v) => !v)} className={`w-full mt-2 ${BTN_CLASS}`} style={{ ...btnStyle("secondary"), minHeight: 44, fontSize: rem(15) }} data-kpi-toggle>
              {kpiAll ? "최근 7일만 보기 ▲" : `전체 보기 (${kpiDaily.length}일) ▼`}
            </button>
          )}
        </section>

        <section aria-label="카테고리별 현황">
          <button type="button" onClick={() => setCategoryOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left" style={{ minHeight: 44 }} data-category-toggle>
            <h2 style={UI_SECTION}>카테고리별 현황 <span style={{ ...LABEL, fontWeight: 400 }}>(액티브 = 최근 7일)</span></h2>
            <span className="font-bold flex-shrink-0" style={{ fontSize: rem(14), color: "#3730A3" }}>{categoryOpen ? "접기 ▲" : "펼치기 ▼"}</span>
          </button>
          {categoryOpen && (
          <div className="mt-2.5 bg-white border border-gray200 rounded-2xl overflow-hidden" style={{ fontVariantNumeric: "tabular-nums" }}>
            <div className="grid grid-cols-[1.3fr_1.3fr_0.7fr_0.6fr_0.6fr] gap-2 px-3 py-2 bg-gray100" style={{ fontSize: rem(14) }}>
              <span className="font-bold text-gray500">카테고리</span>
              <span className="font-bold text-gray500">리드</span>
              <span className="font-bold text-gray500 text-right">성사율</span>
              <span className="font-bold text-gray500 text-right">공급자</span>
              <span className="font-bold text-gray500 text-right">수요자</span>
            </div>
            {(() => {
              const rows = categoryKpis.filter((c) => c.leads > 0 || c.activeSuppliers > 0 || c.activeDemanders > 0);
              const maxLeads = Math.max(0, ...rows.map((c) => c.leads));
              return rows.map((c) => (
                <div key={c.name} className="grid grid-cols-[1.3fr_1.3fr_0.7fr_0.6fr_0.6fr] gap-2 px-3 py-2.5 items-center" style={{ borderTop: "1px solid #F1F3F5", fontSize: rem(15) }}>
                  <span className="truncate">{categoryIcons[c.name] ?? "🗂️"} {c.name}</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <b className="text-navy" style={{ minWidth: "2ch" }}>{c.leads}</b>
                    <InlineBar value={c.leads} max={maxLeads} />
                  </span>
                  <span className="text-right" style={{ color: c.completionRate == null ? ADMIN_TEXT.faint : "#0B2540" }}>{c.completionRate == null ? "—" : `${c.completionRate}%`}</span>
                  <span className="text-right">{c.activeSuppliers}</span>
                  <span className="text-right">{c.activeDemanders}</span>
                </div>
              ));
            })()}
            {categoryKpis.every((c) => c.leads === 0 && c.activeSuppliers === 0 && c.activeDemanders === 0) && (
              <div className="text-center" style={{ ...LABEL, padding: "16px 12px" }}>아직 데이터가 없어요.</div>
            )}
          </div>
          )}
        </section>
        </div>
      )}

      {appointFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setAppointFor(null)}
        >
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl text-navy mb-1">관리자로 임명</div>
            <div className="text-sm text-gray500 mb-5">{formatPhone(appointFor.phone)}</div>

            <label className="text-xs font-bold text-gray500 mb-1 block">이름</label>
            <input
              className="w-full border-2 border-gray200 rounded-xl px-4 mb-4 text-base outline-none focus:border-orange"
              style={{ height: "48px" }}
              value={appointName}
              onChange={(e) => setAppointName(e.target.value)}
              placeholder="담당자 이름"
            />

            <label className="text-xs font-bold text-gray500 mb-1 block">역할</label>
            <div className="flex gap-2 mb-5">
              {(["관리자", "최고관리자", "점핑매니저"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAppointRole(r)}
                  className="flex-1 text-sm font-bold rounded-xl py-3"
                  style={
                    appointRole === r
                      ? { background: "#0B2540", color: "#fff" }
                      : { background: "#F5F6F8", color: ADMIN_TEXT.muted }
                  }
                >
                  {r}
                </button>
              ))}
            </div>

            {appointError && <div className="text-xs text-orange font-medium mb-3">{appointError}</div>}

            <button
              onClick={submitAppoint}
              disabled={appointSubmitting}
              className="w-full text-white font-bold rounded-xl py-3.5 disabled:opacity-60"
              style={{ background: "#0B2540" }}
            >
              {appointSubmitting ? "임명 중..." : "임명하기"}
            </button>
          </div>
        </div>
      )}

      {appointResult && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setAppointResult(null)}
        >
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl text-navy mb-2 flex items-center gap-1.5">
              <CheckCircle className="w-5 h-5" /> 임명 완료
            </div>
            <p className="text-sm text-gray500 mb-4">
              {appointResult.name}님의 임시 비밀번호예요. 이 화면을 닫으면 다시 볼 수 없으니 지금 전달해주세요.
            </p>
            <div className="bg-gray100 rounded-xl px-4 py-3.5 flex items-center justify-between gap-2 mb-5">
              <span className="font-mono text-lg font-bold text-navy">{appointResult.tempPassword}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(appointResult.tempPassword)}
                className="text-xs font-bold text-navy underline flex-shrink-0"
              >
                복사
              </button>
            </div>
            <button
              onClick={handleShareTempPassword}
              className="w-full font-bold rounded-xl py-3.5 mb-2.5"
              style={{ background: "#FEE500", color: "#3C1E1E" }}
            >
              📤 축하 메시지와 함께 보내기
            </button>
            <button
              onClick={() => setAppointResult(null)}
              className="w-full text-white font-bold rounded-xl py-3.5"
              style={{ background: "#0B2540" }}
            >
              확인했어요
            </button>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowChangePassword(false)}
        >
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl text-navy mb-5">비밀번호 변경</div>

            {changePwSuccess ? (
              <>
                <p className="text-sm text-gray900 mb-5">비밀번호가 변경됐어요.</p>
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="w-full text-white font-bold rounded-xl py-3.5"
                  style={{ background: "#0B2540" }}
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <label className="text-xs font-bold text-gray500 mb-1 block">현재 비밀번호</label>
                <input
                  type="password"
                  className="w-full border-2 border-gray200 rounded-xl px-4 mb-3 text-base outline-none focus:border-orange"
                  style={{ height: "48px" }}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <label className="text-xs font-bold text-gray500 mb-1 block">새 비밀번호 (8자 이상)</label>
                <input
                  type="password"
                  className="w-full border-2 border-gray200 rounded-xl px-4 mb-3 text-base outline-none focus:border-orange"
                  style={{ height: "48px" }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <label className="text-xs font-bold text-gray500 mb-1 block">새 비밀번호 확인</label>
                <input
                  type="password"
                  className="w-full border-2 border-gray200 rounded-xl px-4 mb-4 text-base outline-none focus:border-orange"
                  style={{ height: "48px" }}
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitChangePassword()}
                />
                {changePwError && <div className="text-xs text-orange font-medium mb-3">{changePwError}</div>}
                <button
                  onClick={submitChangePassword}
                  disabled={changePwSubmitting}
                  className="w-full text-white font-bold rounded-xl py-3.5 disabled:opacity-60"
                  style={{ background: "#0B2540" }}
                >
                  {changePwSubmitting ? "변경 중..." : "변경하기"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <Toast message={dashToast} />
    </main>
  );
}

// 2026-10-23: 진행 중 매물 수정 = 등록 폼 재사용 — 수정 칸은 DealForm(mode="edit")이 그림. 이 카드는 요약 행 + [수정]/[마감]/[삭제] + 패널·인라인 자리만 맡음.
const DAY_MS = 24 * 3600 * 1000;
const nowMs = () => Date.now(); // 클릭 처리에서만 부름(렌더 중 호출 아님)

// ISO·ms → <input type="datetime-local"> 값(이 기기 시간대, 분까지)
function toLocalInput(v: string | number): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** deals 행 → DealForm이 채우는 모양(prefill) */
function dealToPrefill(d: ActiveDeal) {
  const sellerName = publicSellerName(d);
  return {
    title: d.title,
    category: d.categories?.name ?? "",
    region: d.regions?.name ?? "",
    dealPrice: d.deal_price ?? undefined,
    priceMode: (d.price_mode === "negotiable" ? "negotiable" : "fixed") as PriceMode,
    totalQty: d.total_qty,
    quantityUnit: d.quantity_unit ?? undefined,
    priceUnit: d.price_unit ?? undefined,
    minOrderQty: d.min_order_qty ?? undefined,
    shippingFeeType: d.shipping_fee_type ?? undefined,
    shippingNote: d.shipping_note ?? undefined,
    images: d.images ?? [],
    videoUrl: d.video_url ?? undefined,
    description: d.description ?? undefined,
    packageUnit: d.package_unit ?? undefined,
    origin: d.origin ?? undefined,
    spec: d.spec ?? undefined,
    storageType: d.storage_type ?? undefined,
    storageCondition: d.storage_condition ?? undefined,
    expiryDate: d.expiry_date ?? undefined,
    // 정상가 없이 등록하면 original_price = 판매가로 저장됨 → 칸은 비워서 보여줌
    originalPrice: d.original_price && d.original_price !== d.deal_price ? d.original_price : undefined,
    pid: d.pid ?? undefined,
    manifestItems: d.manifest_items ?? undefined,
    stockType: d.stock_type ?? undefined,
    sellerPublic: sellerName !== null,
    sellerCompanyName: sellerName ?? "",
  };
}

function ActiveDealCard({
  deal,
  adminKey,
  onChanged,
  canDelete,
  onGoBizCheck,
  onClosed,
  soonLabel = null,
  passedLabel = null,
  panel = false,
}: {
  passedLabel?: string | null; // 마감 지남이면 칩 문구("마감 지남") — 판정은 needsAction.ts isDeadlinePassed 한 곳, 회색 강조
  soonLabel?: string | null; // 마감임박(6h)이면 칩 문구("마감 3시간") — 판정은 needsAction.ts isDeadlineSoon 한 곳
  /** PC 보기(isDesktop): 수정을 인라인 대신 전체 화면 패널로 연다 — 모바일·📱는 같은 폼을 인라인으로 */
  panel?: boolean;
  deal: ActiveDeal;
  adminKey: string;
  onChanged: () => void;
  canDelete: boolean; // 2026-10-01: 영구 삭제 버튼은 최고관리자에게만 (서버도 최고관리자만 허용)
  onGoBizCheck: () => void; // "사업자 조회 바로가기" — 사업자 조회 섹션으로 이동(판매 신청 선택 안 함)
  onClosed: (title: string) => void; // 마감 성공 안내는 대시보드에서(카드는 목록에서 빠짐)
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // 2026-10-26: [삭제]는 [마감] 옆 같은 크기 버튼 대신 ⋯ 메뉴 안(최고관리자만)
  const [formDirty, setFormDirty] = useState(false); // DealForm(edit)이 알려 줌 — 패널 닫기 확인 바용. 판매자 비공개 편집기는 폼 밖이라 제외
  const [panelFooterEl, setPanelFooterEl] = useState<HTMLDivElement | null>(null);
  const { message: toastMessage, showToast } = useToast();
  // 저장 성공 → 패널 닫고(모바일은 접고) 이 카드를 1.5초 강조(globals.css [data-flash])
  const [selfFlash, setSelfFlash] = useState(false);
  useEffect(() => {
    if (!selfFlash) return;
    const t = setTimeout(() => setSelfFlash(false), 1500);
    return () => clearTimeout(t);
  }, [selfFlash]);

  // 마감 — 상태만 PATCH(마감 처리). 서버가 감사 로그(deal_close) 기록
  const closeDeal = async () => {
    if (!confirm(`"${deal.title}" 매물을 지금 마감할까요? 진행 중 목록에서 빠지고 매물 상세에는 "마감됨"으로 보여요.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/deals/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ id: deal.id, status: "closed" }),
      });
      if (res.ok) {
        onChanged();
        onClosed(deal.title);
      } else showToast("마감하지 못했어요. 다시 시도해주세요");
    } catch {
      showToast("마감하지 못했어요. 다시 시도해주세요");
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async () => {
    if (!confirm(`"${deal.title}" 매물을 삭제할까요? 되돌릴 수 없고, 이 매물에 달린 관심표시 기록도 함께 삭제돼요.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/deals/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ id: deal.id }),
      });
      if (res.status === 403) {
        showToast(SUPER_ONLY_MESSAGE);
        return;
      }
      // 2026-10-01 F-2: 거래 연결 기록이 있는 매물(409) 등 — 서버 안내를 그대로 (예전엔 실패해도 아무 표시 없었음)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "삭제하지 못했어요. 다시 시도해주세요");
        return;
      }
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  // 폼 저장 성공 — 닫기/접기 + 카드 강조 + 목록 값 다시 읽기(onChanged = load)
  const onSaved = () => {
    setExpanded(false);
    setSelfFlash(true);
    showToast("저장했어요");
    onChanged();
  };
  const goBizFromPanel = () => {
    setExpanded(false); // 패널을 먼저 닫은 뒤 사업자 조회 섹션으로
    requestAnimationFrame(() => onGoBizCheck());
  };

  const dealForm = (
    <DealForm
      key={deal.id}
      adminKey={adminKey}
      mode="edit"
      initialDeal={deal}
      prefill={dealToPrefill(deal)}
      wide={panel}
      footerSlot={panel ? panelFooterEl : undefined}
      onDirtyChange={setFormDirty}
      onGoBizCheck={panel ? goBizFromPanel : onGoBizCheck}
      onCloseDeal={closeDeal}
      onToast={showToast}
      onDone={onSaved}
    />
  );

  return (
    <div className="bg-white border border-gray200 rounded-2xl px-4 py-4" style={passedLabel ? NEEDS_ACTION_PASSED_ROW_STYLE : soonLabel ? NEEDS_ACTION_ROW_STYLE : undefined} data-deadline-soon={soonLabel ? "" : undefined} data-deadline-passed={passedLabel ? "" : undefined} data-flash={selfFlash ? "1" : undefined}>
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray500 min-w-0">
          <span>{categoryIcons[deal.categories?.name ?? ""] ?? "🗂️"}</span>
          <span className="truncate">{deal.categories?.name} · {deal.regions?.name}</span>
        </div>
        {passedLabel ? <NeedsActionChip tone="gray">{passedLabel}</NeedsActionChip> : soonLabel && <NeedsActionChip>{soonLabel}</NeedsActionChip>}
        {/* 2026-09-27: "관심 표시한 회원" 섹션이 전역 리스트라 어떤 매물이 뜨거운지
            한눈에 안 보였음 — deals.interest_count(이미 트리거로 실시간 유지되는
            비정규화 카운터, 별도 조회 불필요)를 매물 관리 행에도 바로 노출.
            2026-09-28: 총합만 보이면 회원/비회원 비중을 알 수 없어 quick_lead_count를
            추가로 빼서 회원(interest_count - quick_lead_count) · 비회원(quick_lead_count)
            브레이크다운을 타이틀 툴팁으로 제공. */}
        {(deal.interest_count ?? 0) > 0 && (
          <span
            className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#FFF0E8", color: ADMIN_TEXT.warn }}
            title={`회원 ${(deal.interest_count ?? 0) - (deal.quick_lead_count ?? 0)} · 비회원 ${deal.quick_lead_count ?? 0}`}
          >
            ❤️ {deal.interest_count}
            {(deal.quick_lead_count ?? 0) > 0 && (
              <span className="font-medium" style={{ color: "#B85A2E" }}>
                {" "}
                (비회원 {deal.quick_lead_count})
              </span>
            )}
          </span>
        )}
      </div>
      <div className="text-base font-bold text-gray900 mt-1.5">{deal.title}</div>
      <div className="text-sm text-gray500 mt-1">
        {deal.price_mode === "negotiable" || deal.deal_price == null ? NEGOTIABLE_TEXT : `${deal.deal_price.toLocaleString()}원`} · 마감{" "}
        {new Date(deal.closes_at).toLocaleString("ko-KR", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      <div className="text-xs text-gray500 mt-1">
        재고 {deal.remaining_qty}/{deal.total_qty}{deal.quantity_unit || "개"}
      </div>

      {(!expanded || panel) && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex-1 text-xs font-bold text-navy border-2 border-gray200 rounded-lg py-2"
          >
            ✏️ 수정
          </button>
          {/* 2026-10-01: [마감] — 관리자·최고관리자. 마감되면 이 목록에서 빠지고 매물 상세·지난 매물에 "마감됨"으로 남음 */}
          <button
            type="button"
            onClick={closeDeal}
            disabled={saving}
            className="flex-1 text-xs font-bold text-orange border-2 border-orange rounded-lg py-2 disabled:opacity-50"
          >
            ⏹ 마감
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="더보기"
              aria-expanded={moreOpen}
              className="flex-shrink-0 font-bold text-navy border-2 border-gray200 rounded-lg flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44, fontSize: rem(18) }}
              data-deal-more
            >
              ⋯
            </button>
          )}
        </div>
      )}
      {canDelete && moreOpen && (!expanded || panel) && (
        <div className="mt-2 flex justify-end" data-deal-more-menu>
          <button
            type="button"
            onClick={() => { setMoreOpen(false); void deleteDeal(); }}
            disabled={deleting}
            className="font-bold rounded-lg px-4 disabled:opacity-50"
            style={{ color: "#C2410C", border: "2px solid #FDEEE8", background: "#FFF9F7", minHeight: 44, fontSize: rem(14) }}
          >
            {deleting ? "삭제 중..." : "🗑️ 삭제"}
          </button>
        </div>
      )}

      {/* 모바일·📱: 같은 폼을 인라인으로 — [접기]·[삭제]는 폼 아래 */}
      {expanded && !panel && (
        <>
          {dealForm}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex-1 text-xs font-bold text-navy border-2 border-gray200 rounded-lg py-2"
            >
              접기
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={deleteDeal}
                disabled={deleting}
                className="flex-1 text-xs font-bold rounded-lg py-2 disabled:opacity-50"
                style={{ color: "#C2410C", border: "2px solid #FDEEE8", background: "#FFF9F7" }}
              >
                {deleting ? "삭제 중..." : "🗑️ 매물 삭제"}
              </button>
            )}
          </div>
        </>
      )}

      {/* PC(isDesktop): 전체 화면 패널 안에 같은 DealForm — 저장 버튼은 폼이 하단 바로 옮겨 옴 */}
      {panel && (
        <AdminFullscreenPanel
          open={expanded}
          title={`매물 수정 — ${deal.title}`}
          columns={1}
          dirty={formDirty}
          onClose={() => setExpanded(false)}
          footerSlotRef={setPanelFooterEl}
          footer={({ requestClose }) => (
            <>
              {canDelete && (
                <button
                  type="button"
                  onClick={deleteDeal}
                  disabled={deleting}
                  className="font-bold rounded-lg px-4 py-2.5 disabled:opacity-50 mr-auto"
                  style={{ color: "#C2410C", border: "2px solid #FDEEE8", background: "#FFF9F7", fontSize: rem(14) }}
                >
                  {deleting ? "삭제 중..." : "🗑️ 매물 삭제"}
                </button>
              )}
              <button
                type="button"
                onClick={requestClose}
                className="font-bold rounded-lg px-6 py-2.5 border-2 border-gray200 text-navy"
                style={{ fontSize: rem(15) }}
                data-panel-cancel
              >
                취소
              </button>
            </>
          )}
        >
          <div className="w-full h-full">{dealForm}</div>
        </AdminFullscreenPanel>
      )}

      <Toast message={toastMessage} />
    </div>
  );
}

// 2026-10-28 7b: 다음 매물 폼으로 이월하는 값 — 판매자 3칸·방금 쓴 사업자 조회 기록 id(다시 붙일 순 없어서 재사용의 원본으로만 씀)·지역. 상품 칸은 이월하지 않음
type SameSellerCarry = { company: string; name: string; phone: string; checkId: string; region: string };

function DealForm({
  adminKey,
  prefill,
  carry = null,
  onRegistered,
  onNextSame,
  requestId,
  onDone,
  wide = false,
  onDirtyChange,
  onGoBizCheck,
  sourcedOptions = [],
  footerSlot,
  mode = "create",
  initialDeal,
  onCloseDeal,
  onToast,
}: {
  adminKey: string;
  /** 2026-10-23 "edit" = 진행 중 매물 수정(initialDeal로 채움, 저장은 PATCH /api/admin/deals/manage — 등록 API·알림 발송은 절대 부르지 않음) */
  mode?: "create" | "edit";
  /** 7b: 이전 매물에서 이월한 판매자·지역(있으면 판매자 정보를 펼쳐 열고 조회 기록은 재사용으로 이어받음) */
  carry?: SameSellerCarry | null;
  /** 7b: 등록 직후 부르는 쪽이 목록만 다시 읽음(폼은 안 닫음) */
  onRegistered?: () => void;
  /** 7b: 주면 직접 등록 성공 뒤 [같은 판매자로 다음 매물 등록] 버튼이 있는 완료 카드를 보여 줌 */
  onNextSame?: (carry: SameSellerCarry) => void;
  initialDeal?: ActiveDeal;
  /** edit의 [조기 마감] */
  onCloseDeal?: () => void;
  /** edit: 판매자 비공개 정보 저장 결과 등 짧은 안내 */
  onToast?: (message: string) => void;
  /** PC 패널: 하단 바 안 빈 자리 — 있으면 [매물 등록 확정](+오류 문구)을 그리로 옮김(sticky 자리 대신). undefined = 인라인, null = 패널은 열렸지만 자리가 아직 없음 */
  footerSlot?: HTMLElement | null;
  /** 2026-10-10 [발굴 매니저] 선택지 — 비면 칸을 그리지 않음 */
  sourcedOptions?: { id: string; name: string; role: string }[];
  prefill?: {
    title?: string;
    category?: string;
    region?: string;
    dealPrice?: number;
    priceMode?: PriceMode;
    totalQty?: number;
    quantityUnit?: string;
    priceUnit?: string;
    minOrderQty?: number;
    shippingFeeType?: string;
    shippingNote?: string;
    images?: string[];
    videoUrl?: string;
    description?: string;
    packageUnit?: string;
    origin?: string;
    spec?: string;
    storageCondition?: string; // 예전 자유 입력(보관조건·소비기한) — 새 칸이 비었을 때만
    storageType?: string;
    expiryDate?: string;
    originalPrice?: number;
    pid?: string;
    manifestItems?: ManifestRow[];
    closesInHours?: number;
    stockType?: string;
    sellerPublic?: boolean;
    sellerCompanyName?: string;
  };
  requestId?: string;
  onDone: () => void;
  /** PC 보기(isDesktop)면 2단 — 왼쪽 입력칸 / 오른쪽 사진·영상·등록 버튼 */
  wide?: boolean;
  /** 입력 중인지(처음 값과 달라졌거나 사진·영상 상태가 바뀜) — 다른 폼으로 바꿀 때 확인 창용 */
  onDirtyChange?: (dirty: boolean) => void;
  /** "사업자 조회 바로가기" — 사업자 조회 섹션으로 이동(판매 신청 선택 안 함) */
  onGoBizCheck?: () => void;
}) {
  const edit = mode === "edit" && !!initialDeal;
  const initial = edit ? initialDeal! : null;
  const [title, setTitle] = useState(prefill?.title ?? "");
  // 재고 유형 — 판매신청 승인이면 신청서 값을 이어받음
  const [stockType, setStockType] = useState<StockType>(isStockType(prefill?.stockType) ? prefill!.stockType as StockType : "general");
  // prefill이 없으면 비워둬서 관리자가 직접 고르게 함 (예전엔 첫 항목이 미리 선택돼 있어
  // 카테고리·지역을 안 고르고 그대로 등록되는 실수가 가능했음)
  const [category, setCategory] = useState(prefill?.category ?? "");
  const [region, setRegion] = useState(carry?.region ?? prefill?.region ?? "");
  const [originalPrice, setOriginalPrice] = useState(prefill?.originalPrice ? String(prefill.originalPrice) : "");
  const [dealPrice, setDealPrice] = useState(prefill?.dealPrice ? String(prefill.dealPrice) : "");
  const [priceMode, setPriceMode] = useState<PriceMode>(prefill?.priceMode === "negotiable" ? "negotiable" : "fixed"); // 2026-10-04 가격 방식 — 가격 협의면 판매·정상 단가 없이 등록 (2026-10-05: 협의 신청이면 협의로 시작)
  const [totalQty, setTotalQty] = useState(prefill?.totalQty ? String(prefill.totalQty) : "");
  const [quantityUnit, setQuantityUnit] = useState(prefill?.quantityUnit || quantityUnits[0]);
  // 2026-10-28 J: 총수량 단위를 직접 고르기 전(신청서·수정 값이 아닐 때)에는 판매 단가 단위를 따라감
  const [quantityUnitTouched, setQuantityUnitTouched] = useState(!!prefill?.quantityUnit);
  // 2026-10-28 A: 배송비 안내(기본 별도) · 배송 메모(선택, 60자)
  const [shippingFeeType, setShippingFeeType] = useState<ShippingFeeType>(shippingFeeTypeOf(prefill?.shippingFeeType));
  const [shippingNote, setShippingNote] = useState(prefill?.shippingNote ?? "");
  // 2026-09-29: 단가 단위 — 신청서 값 이어받기, 없으면 수량 단위를 따라감(직접 고르면 유지). 정상가·판매가 공통
  const [priceUnit, setPriceUnit] = useState<string>(
    isDealPriceUnit(prefill?.priceUnit) ? prefill!.priceUnit! : prefill?.quantityUnit || quantityUnits[0]
  );
  const [priceUnitTouched, setPriceUnitTouched] = useState(isDealPriceUnit(prefill?.priceUnit));
  const lumpSum = isLumpSum(priceUnit);
  const [minOrderQty, setMinOrderQty] = useState(
    prefill?.minOrderQty ? String(prefill.minOrderQty) : ""
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  // edit 전용: 재고 수량(잔량)·마감 일시(연장 버튼은 이 칸 값에서 +n일) — create는 총수량·마감까지 남은 시간만
  const [remainingQty, setRemainingQty] = useState(initial ? String(initial.remaining_qty) : "");
  const [closesAtLocal, setClosesAtLocal] = useState(initial ? toLocalInput(initial.closes_at) : "");
  const [minClosesLocal] = useState(() => toLocalInput(Date.now())); // 달력에서 지난 시각 흐리게(서버도 지금 이후만 허용)
  const [initialPriceUnit] = useState(priceUnit);
  // 2026-10-24 마감 기간: 24시간·3일·7일(기본)·14일·30일·날짜 직접 선택(src/lib/dealDeadline.ts). 판매 신청의 희망 기간은 가장 가까운 큰 값으로(3·12시간 → 24시간),
  // 협의(희망 기간 없음)는 미선택("") + 필수 선택. 직접 등록은 7일이 기본
  const [closesChoice, setClosesChoice] = useState(() => (requestId ? mapHopeHoursToChoice(prefill?.closesInHours ?? null) : DEADLINE_DEFAULT));
  const [closesCustom, setClosesCustom] = useState(""); // closesChoice === "custom"일 때의 날짜·시각(datetime-local)
  const [maxClosesLocal] = useState(() => toLocalInput(Date.now() + DEADLINE_MAX_MS)); // 달력 상한: 지금 + 60일
  const [images, setImages] = useState<string[]>(prefill?.images ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(prefill?.videoUrl ?? null);
  // 2026-10-27 브랜드 보호 — 켜면 공개 사진 1장 + 보호 사진(비공개 버킷)·브랜드명(회원 전용)·영상 없음. 규칙은 서버·DB 제약도 같음
  const [brandProtected, setBrandProtected] = useState(initial?.brand_protected === true);
  const [brandName, setBrandName] = useState(initial?.brand_name ?? "");
  const [photoRefs, setPhotoRefs] = useState<PhotoRef[]>([]); // ImageUploader가 알려 주는 올라간 사진(화면 순서)과 공개/보호 표시
  const protRefs = photoRefs.filter((x) => x.isProtected).map((x) => x.ref);
  const publicRefs = photoRefs.filter((x) => !x.isProtected).map((x) => x.ref);
  const initProtRefs = (initial?.protected_images ?? []).map(toProtectedRef);
  // 켜기·끄기 조건(서버도 400): 켜려면 영상이 없어야 하고(기존 매물은 공개 사진도 1장 이하), 끄려면 보호 사진이 없어야 함
  const bpBlock: string | null = brandProtected
    ? protRefs.length > 0 ? BP_MESSAGES.clearProtectedFirst : null
    : videoUrl ? "영상을 먼저 지워야 켤 수 있어요." : edit && images.length > 1 ? BP_MESSAGES.convertTooManyPublic : null;
  // 2026-10-02 PR-A2: 영상 올리는 중엔 등록 막고, 안 올라간 채 등록하면 시트로 확인
  const [videoStatus, setVideoStatus] = useState<VideoUploadStatus>(prefill?.videoUrl ? "done" : "idle");
  const [videoSheet, setVideoSheet] = useState<{ confirmWarnings: boolean } | null>(null);
  const videoUploaderRef = useRef<VideoUploaderHandle>(null);
  // 2026-10-02 PR-B: 사진도 같은 규칙 — 올리는 중엔 등록 막고, 실패한 사진이 있으면 시트로 확인(사진 → 영상 순서)
  const [photoStatus, setPhotoStatus] = useState<ImageUploadStatus>({ uploading: 0, failed: 0 });
  const [photoSheet, setPhotoSheet] = useState<{ confirmWarnings: boolean } | null>(null);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
  // 2026-10-23 사진 확대·영상 재생(라이트박스) — 등록·수정·모바일 인라인 모두 같은 폼이라 동작 동일
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const openPhotoPreview = (urls: string[], index: number) =>
    setLightbox({ items: [...urls.map((src) => ({ type: "image" as const, src })), ...(videoUrl ? [{ type: "video" as const, src: videoUrl }] : [])], index });
  const openVideoPreview = () => {
    if (videoUrl) setLightbox({ items: [...images.map((src) => ({ type: "image" as const, src })), { type: "video" as const, src: videoUrl }], index: images.length });
  };
  const busyLabel = uploadingLabel(photoStatus.uploading > 0, videoStatus === "uploading");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [packageUnit, setPackageUnit] = useState(prefill?.packageUnit ?? "");
  const [origin, setOrigin] = useState(prefill?.origin ?? "");
  const [spec, setSpec] = useState(prefill?.spec ?? "");
  // 2026-10-01 PR-B [6]: 보관 조건(상온·냉장·냉동)과 소비기한(날짜) 분리. 예전 신청서의 자유 입력은 안내로만 보여주고 그대로 저장
  const [storageType, setStorageType] = useState<StorageType | "">(isStorageType(prefill?.storageType) ? prefill!.storageType as StorageType : "");
  const [expiryDate, setExpiryDate] = useState(prefill?.expiryDate?.slice(0, 10) ?? "");
  const legacyStorage = prefill?.storageCondition?.trim() ?? "";
  const [pid, setPid] = useState(prefill?.pid ?? "");
  const [manifestItems, setManifestItems] = useState<ManifestRow[]>(prefill?.manifestItems ?? []);
  // 2026-09-30: 판매자 표시 — 기본 대리 게시(비공개)
  const [seller, setSeller] = useState({ isPublic: prefill?.sellerPublic ?? false, companyName: prefill?.sellerCompanyName ?? "" });
  // 2026-10-04: 직접 등록(판매 신청 아님)의 실제 판매자(내부 전용)·연결할 사업자 조회 — 판매 신청 승인은 신청 정보를 쓰므로 칸을 숨김
  const [sellerPrivate, setSellerPrivate] = useState<SellerPrivateDraft>(carry ? { company: carry.company, name: carry.name, phone: carry.phone, checkId: "" } : EMPTY_SELLER_PRIVATE);
  const [posted, setPosted] = useState<{ title: string; carry: SameSellerCarry } | null>(null); // 7b 등록 완료 카드
  const [sourcedBy, setSourcedBy] = useState(""); // 2026-10-10 [발굴 매니저] 관리자 id("" = 없음)
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DealField, string>>>({});
  // 2026-10-01 PR-A [11]: 확인 후 저장 경고(매물명·설명) — 서버(/api/admin/deals)도 같은 검사, 같은 판매자 같은 이름 진행 중 매물은 서버에서만
  const [titleWarnings, setTitleWarnings] = useState<string[]>([]);
  const [descWarnings, setDescWarnings] = useState<string[]>([]);
  const [priceWarns, setPriceWarns] = useState<string[]>([]); // [12] 할인율 80% 이상

  // 2026-09-28: 필수 = 매물명·카테고리·지역·판매가·수량. 서버(/api/admin/deals)도 같은 규칙으로
  // 400 { error, field }를 돌려준다. 제출 시 첫 누락 칸으로 스크롤·포커스.
  // 2026-10-01 2차: 묶음 펼침 — 제품 상세·거래 조건·판매자 정보 모두 기본 접힘. 접힌 칸이면 펼친 뒤(다음 렌더) 스크롤
  const [openDeal, setOpenDeal] = useState(edit); // edit: 제품 상세·거래 조건은 펼쳐서 시작(판매자 정보는 접힘)
  const [openDetail, setOpenDetail] = useState(edit);
  const [openSeller, setOpenSeller] = useState(!!carry);
  const focusField = (field: DealField | "description") => {
    if (field === "category") setOpenDeal(true); // 거래 조건
    if (field === "minOrderQty" || field === "expiryDate" || field === "description" || (field === "closesAt" && !edit)) setOpenDetail(true); // 제품 상세
    if (field === "sellerPrivateCompany" || field === "sellerPrivatePhone" || field === "sellerPrivateName" || field === "businessCheckId" || field === "sourcedBy") setOpenSeller(true); // 판매자 정보
    setTimeout(() => {
      const el = document.getElementById(field === "closesAt" && !edit ? "deal-closesIn" : `deal-${field}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }, 30);
  };
  // 묶음 제목 "○개 입력됨" — 기본값(일반 재고·24시간)은 세지 않음
  const detailCount = [!lumpSum && minOrderQty, !edit && closesChoice !== DEADLINE_DEFAULT, storageType, expiryDate, packageUnit, spec, origin, description].filter(Boolean).length;
  const dealCount = [category, stockType !== "general", pid, manifestItems.length > 0].filter(Boolean).length;
  // 재고 유형 "소비기한 임박"이면 소비기한(제품 상세)이 필수라 제품 상세를 펼쳐 둠
  useEffect(() => {
    if (stockType === "near_expiry") setOpenDetail(true);
  }, [stockType]);

  // 2026-10-03 PR-D: 입력 중 여부 — 첫 렌더 값과 비교(사진·영상 업로드 상태 포함)
  const snapshot = JSON.stringify([
    title, stockType, category, region, priceMode, originalPrice, dealPrice, totalQty, quantityUnit, priceUnit, minOrderQty, location,
    closesChoice, closesCustom, remainingQty, closesAtLocal, images, videoUrl, videoStatus, photoStatus, description, packageUnit, origin, spec, storageType, expiryDate,
    pid, manifestItems, seller, sellerPrivate, brandProtected, brandName, photoRefs,
  ]);
  const [initialSnapshot] = useState(snapshot);
  const dirty = snapshot !== initialSnapshot;
  useEffect(() => {
    onDirtyChange?.(dirty && !posted); // 등록이 끝난 완료 카드는 "작성 중" 아님
  }, [dirty, posted, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const validate = (): Partial<Record<DealField, string>> => {
    const errs: Partial<Record<DealField, string>> = {};
    const deal = parsePriceInput(dealPrice);
    const orig = parsePriceInput(originalPrice);
    const qty = parsePriceInput(totalQty) ?? 0;
    if (!title.trim()) errs.title = "매물명을 입력해주세요.";
    else {
      const block = checkTitle(normalizeTitle(title, { admin: true }), { admin: true }).block;
      if (block) errs.title = block;
    }
    if (brandProtected && !brandName.trim()) errs.brandName = BP_MESSAGES.brandNameRequired;
    if (!category) errs.category = "카테고리를 선택해주세요.";
    if (!region) errs.region = "지역을 선택해주세요.";
    if (priceMode === "fixed") {
      if (!dealPrice.trim()) errs.dealPrice = "판매가를 입력해주세요.";
      else if (!deal || deal <= 0) errs.dealPrice = "판매가는 0보다 커야 해요.";
      if (originalPrice.trim() && (!orig || orig <= 0)) errs.originalPrice = "정상가는 0보다 커야 해요.";
    }
    if (shippingNote.trim().length > SHIPPING_NOTE_MAX) errs.shippingNote = SHIPPING_NOTE_ERROR;
    if (!totalQty.trim()) errs.totalQty = "재고 총수량을 입력해주세요.";
    else if (!Number.isFinite(qty) || qty <= 0) errs.totalQty = "재고 총수량은 0보다 커야 해요.";
    if (!lumpSum && minOrderQty.trim() && !(Number(minOrderQty) > 0 && Number.isInteger(Number(minOrderQty)))) errs.minOrderQty = "최소 주문량은 1 이상의 정수로 입력해주세요.";
    else if (!lumpSum && minOrderQty.trim() && qty > 0 && Number(minOrderQty) > qty) errs.minOrderQty = "최소주문량은 재고 총수량보다 클 수 없어요.";
    if (stockType === "near_expiry" && !expiryDate) errs.expiryDate = EXPIRY_REQUIRED_MESSAGE;
    if (edit) {
      // 재고 수량(잔량)은 0 이상의 정수, 재고 총수량 이하 — 서버(validateDealEdit)와 같은 문구
      const rem = Number(remainingQty);
      if (remainingQty.trim() === "" || !Number.isInteger(rem) || rem < 0) errs.remainingQty = "재고 수량은 0 이상의 정수로 입력해주세요.";
      else if (qty > 0 && rem > qty) errs.remainingQty = `재고 수량은 재고 총수량(${qty})보다 클 수 없어요.`;
      // 마감: 지금 이후 · 지금+60일 이하 · 소비기한이 있으면 소비기한 23:59(KST) 이하 — 서버(validateDealEdit)와 같은 규칙(src/lib/dealDeadline.ts)
      const closesChanged = closesAtLocal !== toLocalInput(initial!.closes_at);
      const closesMs = Date.parse(closesAtLocal);
      if (closesChanged) {
        const e = checkClosesAt(closesMs, Date.now(), expiryDate || null);
        if (e) errs.closesAt = e;
      } else if (expiryDate && expiryDate !== (initial!.expiry_date?.slice(0, 10) ?? "") && closesMs > expiryLimitMs(expiryDate)) {
        errs.expiryDate = closesAfterExpiryMessage(expiryDate); // 소비기한만 앞당겼는데 마감이 그 뒤
      }
    } else {
      // 등록: 고른 기간·직접 고른 날짜 → 마감 시각(지금 + N시간)
      if (closesChoice === "") errs.closesAt = DEADLINE_CHOOSE_MESSAGE;
      else if (closesChoice === DEADLINE_CUSTOM && !closesCustom) errs.closesAt = "마감 날짜와 시각을 골라주세요.";
      else {
        const ms = closesChoice === DEADLINE_CUSTOM ? Date.parse(closesCustom) : Date.now() + Number(closesChoice) * 3600 * 1000;
        const e = checkClosesAt(ms, Date.now(), expiryDate || null);
        if (e) errs.closesAt = e;
      }
    }
    if (!requestId && !edit) {
      if (!sellerPrivate.company.trim()) errs.sellerPrivateCompany = "실제 판매자 상호를 입력해주세요.";
      const sellerPhone = normalizePhone(sellerPrivate.phone);
      if (!sellerPhone) errs.sellerPrivatePhone = "실제 판매자 연락처를 입력해주세요.";
      else if (!/^[0-9]{8,11}$/.test(sellerPhone)) errs.sellerPrivatePhone = "연락처는 숫자 8~11자리로 적어주세요.";
      if (!sellerPrivate.checkId) errs.businessCheckId = NOT_CHECKED_MESSAGE;
    }
    return errs;
  };

  const clearErr = (field: DealField) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const showWarnings = (t: string[], d: string[], pr: string[] = []) => {
    setTitleWarnings(t);
    setDescWarnings(d);
    setPriceWarns(pr);
    setError("주황 안내를 확인하고 \"그대로 저장\"을 눌러주세요.");
    focusField(t.length ? "title" : pr.length ? "originalPrice" : "description");
  };
  const submit = async (confirmWarnings = false, skipVideo = false, skipPhotos = false) => {
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    const firstMissing = DEAL_FIELD_ORDER.find((f) => errs[f]);
    if (firstMissing) {
      setError("빨간 안내가 있는 칸을 확인해주세요.");
      focusField(firstMissing);
      return;
    }
    const cleanTitle = normalizeTitle(title, { admin: true });
    if (cleanTitle !== title) setTitle(cleanTitle);
    const deal = parsePriceInput(dealPrice) ?? 0;
    const orig = parsePriceInput(originalPrice);
    if (!confirmWarnings) {
      const t = checkTitle(cleanTitle, { admin: true }).warnings;
      const d = checkDescription(description);
      const pr = priceMode === "fixed" ? priceWarnings(orig, deal) : [];
      if (t.length || d.length || pr.length) {
        showWarnings(t, d, pr);
        return;
      }
    }
    setTitleWarnings([]);
    setDescWarnings([]);
    setPriceWarns([]);
    if (priceMode === "fixed" && orig && deal >= orig && !window.confirm("판매가가 정상가보다 높거나 같아요. 할인율이 표시되지 않아요. 그대로 등록할까요?")) {
      focusField("dealPrice");
      return;
    }
    if (busyLabel) return;
    if (!skipPhotos && photoStatus.failed > 0) {
      setPhotoSheet({ confirmWarnings });
      return;
    }
    if (!skipVideo && videoNotUploaded(videoStatus)) {
      setVideoSheet({ confirmWarnings });
      return;
    }
    // 2026-10-23 edit: 바뀐 칸만 PATCH(/api/admin/deals/manage)로 — 등록 API(POST)·알림 발송은 부르지 않음
    let editBody: Record<string, unknown> | null = null;
    if (edit && initial) {
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      const initOrig = initial.original_price && initial.original_price !== initial.deal_price ? String(initial.original_price) : "";
      const initPriceMode: PriceMode = initial.price_mode === "negotiable" ? "negotiable" : "fixed";
      const c: Record<string, unknown> = {};
      if (cleanTitle !== initial.title) c.title = cleanTitle;
      if (priceMode !== initPriceMode) c.priceMode = priceMode;
      if (priceMode === "fixed" && (initPriceMode === "negotiable" || deal !== initial.deal_price || originalPrice !== initOrig)) {
        c.dealPrice = deal;
        c.originalPrice = orig ?? null;
      }
      const qtyNum = parsePriceInput(totalQty);
      if (qtyNum !== initial.total_qty) c.totalQty = qtyNum;
      if (quantityUnit !== (initial.quantity_unit || "개")) c.quantityUnit = quantityUnit;
      if (priceUnit !== initialPriceUnit) c.priceUnit = priceUnit;
      if (!lumpSum && minOrderQty !== (initial.min_order_qty ? String(initial.min_order_qty) : "")) c.minOrderQty = minOrderQty.trim() ? Number(minOrderQty) : null;
      if (category !== (initial.categories?.name ?? "")) c.category = category;
      if (region !== (initial.regions?.name ?? "")) c.region = region;
      if (location !== (initial.location ?? "")) c.location = location || null;
      if (stockType !== (initial.stock_type ?? "general")) c.stockType = stockType;
      if (packageUnit !== (initial.package_unit ?? "")) c.packageUnit = packageUnit || null;
      if (shippingFeeType !== shippingFeeTypeOf(initial.shipping_fee_type)) c.shippingFeeType = shippingFeeType;
      if (shippingNote.trim() !== (initial.shipping_note ?? "")) c.shippingNote = shippingNote.trim() || null;
      if (spec !== (initial.spec ?? "")) c.spec = spec || null;
      if (origin !== (initial.origin ?? "")) c.origin = origin || null;
      if (storageType !== (initial.storage_type ?? "")) c.storageType = storageType || null;
      if (expiryDate !== (initial.expiry_date?.slice(0, 10) ?? "")) c.expiryDate = expiryDate || null;
      if (description !== (initial.description ?? "")) c.description = description || null;
      if (pid !== (initial.pid ?? "")) c.pid = pid || null;
      if (!same(manifestItems, initial.manifest_items ?? [])) c.manifestItems = manifestItems.length ? manifestItems : null;
      if (remainingQty !== String(initial.remaining_qty)) c.remainingQty = Number(remainingQty);
      if (closesAtLocal !== toLocalInput(initial.closes_at)) c.closesAt = new Date(Date.parse(closesAtLocal)).toISOString();
      // 2026-10-27 브랜드 보호: 켜기·끄기·브랜드명·사진(공개/보호 목록) — 보호 매물은 공개 목록(images)과 보호 목록(protectedImages)을 같이 보냄
      const initBp = initial.brand_protected === true;
      if (brandProtected !== initBp) c.brandProtected = brandProtected;
      if (brandProtected && brandName.trim() !== (initial.brand_name ?? "")) c.brandName = brandName.trim();
      if (brandProtected || initBp) {
        if (!same(publicRefs, initial.images ?? []) || !same(protRefs, initProtRefs) || brandProtected !== initBp) {
          c.images = publicRefs;
          c.protectedImages = brandProtected ? protRefs : [];
        }
      } else if (!same(images, initial.images ?? [])) c.images = images;
      const videoToSend = skipVideo ? initial.video_url ?? null : videoUrl;
      if (videoToSend !== (initial.video_url ?? null)) c.videoUrl = videoToSend;
      const initSellerName = publicSellerName(initial);
      if (seller.isPublic !== (initSellerName !== null) || (seller.isPublic && seller.companyName.trim() !== (initSellerName ?? ""))) {
        c.sellerPublic = seller.isPublic;
        c.sellerCompanyName = seller.companyName;
      }
      if (Object.keys(c).length === 0) {
        setError("바뀐 내용이 없어요.");
        return;
      }
      editBody = { id: initial.id, ...c, confirmWarnings: confirmWarnings || undefined };
    }
    setSubmitting(true);
    const closesAt = new Date(closesChoice === DEADLINE_CUSTOM ? Date.parse(closesCustom) : Date.now() + Number(closesChoice) * 3600 * 1000).toISOString();
    try {
      const res = await adminFetch(edit ? "/api/admin/deals/manage" : "/api/admin/deals", adminKey, {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editBody ?? {
          title: cleanTitle,
          confirmWarnings,
          stockType,
          category,
          region,
          priceMode,
          // 가격 협의면 가격 칸은 보내지 않음(서버·DB도 두 가격 null만 허용)
          ...(priceMode === "fixed" ? { originalPrice: orig, dealPrice: deal } : {}),
          totalQty: parsePriceInput(totalQty),
          quantityUnit,
          priceUnit,
          minOrderQty: !lumpSum && minOrderQty ? Number(minOrderQty) : null,
          location,
          closesAt,
          requestId,
          // 2026-10-27 브랜드 보호: 공개 사진은 images, 보호 사진은 protectedImages(서버가 비공개 버킷으로 정리)
          images: brandProtected ? publicRefs : images,
          ...(brandProtected ? { brandProtected: true, brandName: brandName.trim(), protectedImages: protRefs } : {}),
          videoUrl: skipVideo || brandProtected ? null : videoUrl,
          description,
          packageUnit: packageUnit || null,
          // 2026-10-28 배송비 안내 — 기본(별도)·메모 없음이면 보내지 않음(price_mode 선례)
          ...(shippingFeeType !== DEFAULT_SHIPPING_FEE_TYPE ? { shippingFeeType } : {}),
          ...(shippingNote.trim() ? { shippingNote: shippingNote.trim() } : {}),
          origin: origin || null,
          spec: spec || null,
          storageType: storageType || null,
          expiryDate: expiryDate || null,
          storageCondition: legacyStorage || null,
          pid: pid || null,
          manifestItems: manifestItems.length ? manifestItems : null,
          sellerPublic: seller.isPublic,
          sellerCompanyName: seller.companyName,
          sourcedById: sourcedBy || null,
          ...(requestId
            ? {}
            : {
                sellerPrivateCompany: sellerPrivate.company,
                sellerPrivateName: sellerPrivate.name,
                sellerPrivatePhone: sellerPrivate.phone,
                businessCheckId: sellerPrivate.checkId,
              }),
        }),
      });
      if (res.status === 401) {
        // 세션 만료 — 로그인 창은 adminFetch가 띄움. 입력은 그대로, 다시 로그인한 뒤 직접 누르게 함(자동 재제출 없음: 중복 등록·알림 발송 방지)
        setError(adminSaveAuthMessage(edit ? "변경사항 저장" : "매물 등록 확정"));
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.needsConfirm) {
        showWarnings(data.warnings?.title ?? [], data.warnings?.description ?? [], data.warnings?.price ?? []);
        return;
      }
      if (!res.ok) {
        const field = data.field as DealField | undefined;
        if (field && DEAL_FIELD_ORDER.includes(field)) {
          setFieldErrors({ [field]: data.error ?? "값을 확인해주세요." });
          focusField(field);
        }
        setError(data.error ?? (edit ? "저장에 실패했어요." : "등록에 실패했어요."));
        return;
      }
      if (edit) {
        onDone(); // 저장 성공 — 닫기·토스트·목록 다시 읽기는 부르는 쪽(ActiveDealCard)
        return;
      }
      const sent = data.push?.sentCount ?? 0;
      alert(
        data.push?.held
          ? "매물이 등록됐어요. 밤 9시~아침 8시라 알림은 아침 8시에 발송돼요."
          : `매물이 등록됐어요. 구독자 ${sent}명에게 알림을 발송했어요.`
      );
      if (onNextSame && !requestId && sellerPrivate.checkId) {
        // 7b: 폼을 닫지 않고 완료 카드 — [같은 판매자로 다음 매물 등록] / [닫기]. 목록은 지금 다시 읽음
        onRegistered?.();
        setPosted({ title: title.trim(), carry: { company: sellerPrivate.company, name: sellerPrivate.name, phone: sellerPrivate.phone, checkId: sellerPrivate.checkId, region } });
        return;
      }
      onDone();
    } catch {
      setError(edit ? "저장에 실패했어요." : "등록에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };
  // edit: 마감 빠른 버튼 — 지금 칸 값(비었거나 지난 시각이면 지금)에서 n일 뒤. 저장해야 반영
  const addDays = (n: number) => {
    const t = Date.parse(closesAtLocal);
    const base = Math.max(Number.isNaN(t) ? Date.parse(initial?.closes_at ?? "") || 0 : t, nowMs());
    const next = base + n * DAY_MS;
    if (next > nowMs() + DEADLINE_MAX_MS) {
      // 2026-10-24 마감은 지금 + 60일까지 — 넘으면 막고 안내(값은 그대로)
      setFieldErrors((prev) => ({ ...prev, closesAt: DEADLINE_MAX_MESSAGE }));
      return;
    }
    setClosesAtLocal(toLocalInput(next));
    clearErr("closesAt");
  };

  const groupCls = (field: DealField) =>
    `flex items-stretch w-full min-w-0 border-2 rounded-lg bg-white overflow-hidden focus-within:border-orange ${
      fieldErrors[field] ? "border-[#DC2626]" : "border-gray200"
    }`;
  const inputCls = (field?: DealField) =>
    `w-full min-w-0 border-2 rounded-lg px-3 py-2.5 text-[0.8889rem] outline-none focus:border-orange ${
      field && fieldErrors[field] ? "border-[#DC2626]" : "border-gray200"
    }`;

  const dealAccordionEl = (
      <FormAccordion id="deal-sec-deal" title="거래 조건" count={dealCount} requiredCount={1} open={openDeal} onToggle={() => setOpenDeal((v) => !v)}>
        <div className="flex flex-col gap-3">
          <div className={FORM_ROW2}>
            <DealFormField label="카테고리" required error={fieldErrors.category} htmlFor="deal-category">
              <select
                id="deal-category"
                className={inputCls("category")}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  clearErr("category");
                }}
              >
                <option value="">선택해주세요</option>
                {mockCategories.map((c) => (
                  <option key={c} value={c}>
                    {categoryIcons[c]} {c}
                  </option>
                ))}
              </select>
            </DealFormField>
            <DealFormField label="재고 유형" htmlFor="deal-stockType">
              {/* 2026-10-01: 버튼 10개 → 드롭다운 (기본 일반 재고, 이모지 라벨 그대로) */}
              <select
                id="deal-stockType"
                className={inputCls()}
                value={stockType}
                onChange={(e) => {
                  if (isStockType(e.target.value)) setStockType(e.target.value);
                }}
              >
                {STOCK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
              {stockType === "near_expiry" && (
                <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>소비기한은 &quot;제품 상세&quot;에서 꼭 입력해주세요.</p>
              )}
            </DealFormField>
          </div>
          {/* 2026-09-26: 혼합매물(리퀴데이션 파렛트 등) — 신청서에서 이미 첨부됐으면 prefill로
              채워지고, 여기서도 직접 추가/수정 가능 (전화 접수 등 신청서 없이 등록하는 경우 대비). */}
          <DealFormField label="PID / 매니페스트 번호" htmlFor="deal-pid">
            <input
              id="deal-pid"
              className={inputCls()}
              placeholder="예: PID-240915-01"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
            />
          </DealFormField>
          <ManifestUploader onChange={setManifestItems} initialRows={prefill?.manifestItems} />
        </div>
      </FormAccordion>
  );
  // edit + wide(PC 패널)는 3열: ① 필수 정보+재고·마감 ② 제품 상세+판매자 정보 ③ 사진·영상+거래 조건 — 거래 조건 묶음이 오른쪽 열로 가서 따로 그림
  const editWide = edit && wide;
  const sellerAccordionEl = (
      <FormAccordion id="deal-sec-seller" title="판매자 정보" count={(seller.isPublic ? 1 : 0) + (!requestId ? [sellerPrivate.company, sellerPrivate.phone, sellerPrivate.name, sellerPrivate.checkId].filter(Boolean).length : 0)} open={openSeller} onToggle={() => setOpenSeller((v) => !v)}>
        <SellerDisplayPicker idPrefix={edit ? `deal-${initial!.id}` : "deal-new"} isPublic={seller.isPublic} companyName={seller.companyName} onChange={setSeller} />
        {edit && (
          <div className="mt-3">
            <h4 className="font-bold mb-1" style={{ fontSize: rem(15), color: "#0B2540" }}>판매자 비공개 정보 — 따로 저장</h4>
            {/* 실제 판매자(내부 전용) — 매물 내용 저장과 별개로 저장(자체 [판매자 정보 저장] 버튼, 알림 재발송 없음) */}
            <DealSellerPrivateEditor adminKey={adminKey} dealId={initial!.id} onToast={(m) => (onToast ? onToast(m) : setError(m))} onGoBizCheck={onGoBizCheck ?? (() => {})} />
          </div>
        )}
        {!requestId && !edit && (
          <div className="mt-3">
            <SellerPrivateFields
              adminKey={adminKey}
              idPrefix="deal"
              value={sellerPrivate}
              onChange={(n) => {
                setSellerPrivate(n);
                setFieldErrors((prev) => ({ ...prev, sellerPrivateCompany: undefined, sellerPrivatePhone: undefined, sellerPrivateName: undefined, businessCheckId: undefined }));
              }}
              errors={{ company: fieldErrors.sellerPrivateCompany, phone: fieldErrors.sellerPrivatePhone, name: fieldErrors.sellerPrivateName, checkId: fieldErrors.businessCheckId }}
              showCheckPicker
              onGoBizCheck={onGoBizCheck}
              disabled={submitting}
              reuseFromCheckId={carry?.checkId}
            />
          </div>
        )}
        {/* 2026-10-10 매니저 실적: 이 판매자를 찾아온 관리자(새 판매자 발굴). 직접 등록·판매 신청 승인 공통, 기본 "없음" */}
        {!edit && sourcedOptions.length > 0 && (
          <div className="mt-3">
            <DealFormField label="발굴 매니저" htmlFor="deal-sourced-by" error={fieldErrors.sourcedBy}>
              <select
                id="deal-sourced-by"
                className={inputCls("sourcedBy")}
                value={sourcedBy}
                onChange={(e) => {
                  setSourcedBy(e.target.value);
                  clearErr("sourcedBy");
                }}
                disabled={submitting}
                data-testid="deal-sourced-by"
              >
                <option value="">없음</option>
                {sourcedOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.role})
                  </option>
                ))}
              </select>
            </DealFormField>
          </div>
        )}
      </FormAccordion>
  );

  if (posted) {
    return (
      <div className="rounded-2xl flex flex-col gap-3" style={{ border: "2px solid #BFE6CB", background: "#F3FBF6", padding: 16 }} data-posted-card>
        <div className="font-extrabold" style={{ fontSize: rem(17), color: "#1D8A44" }}>✓ 매물이 등록됐어요</div>
        <div className="break-words" style={{ fontSize: rem(15), color: "#374151" }}>{posted.title}</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => onNextSame?.(posted.carry)} className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")} data-next-same>
            같은 판매자로 다음 매물 등록
          </button>
          <button type="button" onClick={onDone} className={`w-full ${BTN_CLASS}`} style={btnStyle("secondary")} data-posted-close>
            닫기
          </button>
        </div>
        <p style={{ fontSize: rem(14), color: "#6B7280" }}>판매자 정보(상호·연락처·담당자)와 지역만 이어져요. 상품 칸은 비어 있어요.</p>
      </div>
    );
  }

  return (
    // 2026-10-03 PR-D: PC 보기(wide)면 2단 — 왼쪽(필수 정보·접는 묶음 3개) / 오른쪽(사진·영상·안내·등록 버튼 sticky).
    // /sell(#45)과 같은 방식: 좁을 땐 두 열 틀이 display:contents라 바깥 세로 줄에 그대로 서고 order로 순서(① → 사진·영상 → 묶음 → 안내·버튼).
    // 틀 요소는 그대로 두고 클래스만 바뀌어서 "모바일 보기" ↔ PC 전환해도 업로드 중 상태가 유지됨
    <div
      className={
        wide
          ? editWide
            ? "bg-gray100 rounded-xl p-2.5 w-full h-full grid grid-cols-3 grid-rows-[minmax(0,1fr)] gap-x-6 items-stretch"
            : "mt-3 bg-gray100 rounded-xl p-3.5 w-full grid grid-cols-[minmax(0,1fr)_clamp(360px,38%,420px)] gap-x-8 items-start"
          : "@container mt-3 bg-gray100 rounded-xl p-3.5 flex flex-col gap-3 w-full max-w-[720px] mx-auto"
      }
    >
      <div className={wide && !editWide ? "@container flex flex-col gap-3 min-w-0" : "contents"}>
        <div className={editWide ? "@container flex flex-col gap-2 min-w-0 min-h-0 overflow-y-auto [&_label]:mb-0.5 [&_input]:py-2 [&_select]:py-2 [&_div.mb-3]:mb-1.5" : "contents"} data-col={editWide ? "1" : undefined}>
        {!edit && (
        <p className="text-[0.7778rem] text-gray500">
          <span className="text-orange font-bold">*</span> 필수 항목
        </p>
        )}
        {requestId && (!prefill?.category || !prefill?.region) && (
          <div
            className="rounded-lg text-sm font-bold leading-relaxed"
            style={{ background: "#FDEEE8", color: "#C2410C", padding: "10px 12px" }}
          >
            이 판매신청에는 {!prefill?.category && !prefill?.region ? "카테고리·지역이" : !prefill?.category ? "카테고리가" : "지역(재고 위치)이"}{" "}
            없어요. {!prefill?.category ? "카테고리를 지정해야 알림이 발송돼요. " : ""}
            {!prefill?.region ? "매물 등록에는 지역이 꼭 필요해요(알림 조건은 아니에요). " : ""}아래에서 선택해주세요.
          </div>
        )}

        {/* 2026-10-01 feat/form-order-v2: 매물 폼 재배치 2차 — 항목·검증·저장 그대로, 순서·묶음·표시만 (/sell과 같은 순서).
            ① 필수 정보 → ② 사진·영상 → ④ 제품 상세(접힘) → ⑤ 거래 조건(접힘, 카테고리 필수 "필수 1개") → ⑥ 판매자 정보(접힘).
            칸 수는 폼 폭 기준(@container) — 관리자 "모바일 보기"에서도 맞게. 접힌 묶음 칸에서 오류 나면 펼치고 그 칸으로 스크롤 */}
        <section className="order-1">
          <FormSectionTitle>필수 정보</FormSectionTitle>
          <div className={edit ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
            <DealFormField label="매물명" required error={fieldErrors.title} htmlFor="deal-title">
              <input
                id="deal-title"
                className={inputCls("title")}
                placeholder="예: 국내산 갈치 5kg"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearErr("title");
                  setTitleWarnings([]);
                }}
              />
              <ConfirmWarnings warnings={titleWarnings} onConfirm={() => submit(true)} busy={submitting} />
            </DealFormField>


              <div className="min-w-0">
                <div className="font-bold mb-1" style={{ fontSize: rem(15), color: "#374151" }}>가격 방식</div>
                <div className="flex gap-2" role="radiogroup" aria-label="가격 방식">
                  {(["fixed", "negotiable"] as const).map((m) => (
                    <label
                      key={m}
                      className="flex-1 flex items-center gap-2 rounded-xl cursor-pointer"
                      style={{ border: `2px solid ${priceMode === m ? "#0B2540" : "#E4E7EB"}`, padding: "10px 12px", background: "#fff" }}
                    >
                      <input type="radio" name="deal-priceMode" className="w-4 h-4 accent-navy flex-shrink-0" checked={priceMode === m} onChange={() => { setPriceMode(m); setFieldErrors((prev) => ({ ...prev, dealPrice: undefined, originalPrice: undefined })); setPriceWarns([]); }} />
                      <span className="font-bold text-navy" style={{ fontSize: rem(14) }}>{m === "fixed" ? "가격 입력" : "가격 협의"}</span>
                    </label>
                  ))}
                </div>
              </div>

            {/* 가격 한 줄: [판매 단가 | 원 / 단위] · 정상 단가(같은 단위) · 할인율 — "단가 기준" 칸을 판매 단가 단위로 합침(price_unit 그대로) */}
            {priceMode === "negotiable" ? (
              <div className="rounded-xl" style={{ background: "#FFF4EC", border: "1.5px solid #F6D3BF", padding: "12px 14px", fontSize: rem(14), lineHeight: 1.55, color: "#0B2540" }}>
                <span className="font-bold">{NEGOTIABLE_TEXT}</span>
                <br />
                목록·상세·알림에 가격 대신 이렇게 보여요. 판매·정상 단가는 저장하지 않아요.
              </div>
            ) : (
            <div className={FORM_ROW3}>
              <DealFormField label="판매 단가" required error={fieldErrors.dealPrice} htmlFor="deal-dealPrice">
                <div className={groupCls("dealPrice")}>
                  <input
                    id="deal-dealPrice"
                    type="text"
                    inputMode="numeric"
                    className={GROUP_INPUT_CLS}
                    placeholder="예: 30,000"
                    value={formatPriceInput(dealPrice)}
                    onChange={(e) => {
                      setDealPrice(e.target.value);
                      clearErr("dealPrice");
                      setPriceWarns([]);
                    }}
                  />
                  <span className="flex-shrink-0 flex items-center font-bold" style={{ fontSize: rem(15), color: "#0B2540", padding: "0 4px 0 6px" }}>원 /</span>
                  <select
                    id="deal-priceUnit"
                    aria-label="판매 단가 단위"
                    className={GROUP_SELECT_CLS}
                    value={priceUnit}
                    onChange={(e) => {
                      setPriceUnit(e.target.value);
                      setPriceUnitTouched(true);
                      if (e.target.value === LUMP_SUM) setMinOrderQty("");
                      // 2026-10-28 J: 총수량 단위를 직접 고르지 않았으면 같은 값으로 맞춤(새 등록만, 일괄 제외)
                      else if (!edit && !quantityUnitTouched && quantityUnits.includes(e.target.value)) setQuantityUnit(e.target.value);
                    }}
                  >
                    {DEAL_PRICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u === LUMP_SUM ? "일괄(전체)" : u}
                      </option>
                    ))}
                  </select>
                </div>
                {!edit && (
                <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>
                  목록에 &quot;{formatDealPrice(30000, quantityUnit, priceUnit, { exact: true })}&quot;처럼 보여요 · {shippingFeeType === "included" ? "배송비 포함 가격" : shippingFeeType === "negotiable" ? "배송비 협의" : "창고 출고가(배송비 별도)"}
                </p>
                )}
              </DealFormField>
              <DealFormField label="정상 단가" error={fieldErrors.originalPrice} htmlFor="deal-originalPrice">
                <div className={groupCls("originalPrice")}>
                  <input
                    id="deal-originalPrice"
                    type="text"
                    inputMode="numeric"
                    className={GROUP_INPUT_CLS}
                    placeholder="예: 50,000"
                    value={formatPriceInput(originalPrice)}
                    onChange={(e) => {
                      setOriginalPrice(e.target.value);
                      clearErr("originalPrice");
                      setPriceWarns([]);
                    }}
                  />
                  <span className="flex-shrink-0 flex items-center font-bold whitespace-nowrap" style={{ fontSize: rem(15), color: "#0B2540", padding: "0 12px 0 4px" }}>{priceUnitSuffix(priceUnit)}</span>
                </div>
                {!edit && <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>판매 단가와 같은 단위로 적어주세요</p>}
              </DealFormField>
              {(!edit || (parsePriceInput(originalPrice) && parsePriceInput(dealPrice))) && (
              <div className="min-w-0 @min-[560px]:col-span-2" data-field="discount">
                <p className="font-bold mb-1" style={{ fontSize: rem(15), color: "#374151" }}>할인율</p>
                <DiscountHint original={parsePriceInput(originalPrice)} deal={parsePriceInput(dealPrice)} />
                {!edit && !(parsePriceInput(originalPrice) && parsePriceInput(dealPrice)) && (
                  <p className="text-gray500" style={{ fontSize: rem(14) }}>판매·정상 단가를 넣으면 보여요</p>
                )}
                <ConfirmWarnings warnings={priceWarns} onConfirm={titleWarnings.length ? undefined : () => submit(true)} busy={submitting} />
              </div>
              )}
            </div>
            )}

            {/* 2026-10-28 A 배송비 안내 — 상세(회원)에 "창고 출고가 기준이에요 (배송비 별도)" 대신 이 선택대로 보임. 가격 협의 매물도 같음 */}
            <div className="min-w-0" data-shipping-fee>
              <div className="font-bold mb-1" style={{ fontSize: rem(15), color: "#374151" }}>배송비 안내</div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="배송비 안내">
                {SHIPPING_FEE_TYPES.map((t) => (
                  <label
                    key={t}
                    className="flex-1 min-w-[7.5rem] flex items-center gap-2 rounded-xl cursor-pointer"
                    style={{ border: `2px solid ${shippingFeeType === t ? "#0B2540" : "#E4E7EB"}`, padding: "10px 12px", background: "#fff" }}
                  >
                    <input type="radio" name="deal-shippingFeeType" className="w-4 h-4 accent-navy flex-shrink-0" checked={shippingFeeType === t} onChange={() => setShippingFeeType(t)} />
                    <span className="font-bold text-navy" style={{ fontSize: rem(14) }}>{SHIPPING_FEE_LABELS[t]}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2">
                <label htmlFor="deal-shippingNote" className="font-bold mb-1 block" style={{ fontSize: rem(15), color: "#374151" }}>배송 메모 (선택)</label>
                <input
                  id="deal-shippingNote"
                  className={inputCls("shippingNote")}
                  maxLength={SHIPPING_NOTE_MAX}
                  placeholder="예: 500kg 이상 배송 지원"
                  value={shippingNote}
                  onChange={(e) => { setShippingNote(e.target.value); clearErr("shippingNote"); }}
                />
                <p className="mt-1 text-gray500 text-right" style={{ fontSize: rem(14) }} data-shipping-count>{shippingNote.length}/{SHIPPING_NOTE_MAX}</p>
                {fieldErrors.shippingNote && <p className="font-medium" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{fieldErrors.shippingNote}</p>}
              </div>
            </div>

            {/* 재고 총수량+단위(한 덩어리) · 재고 위치 · 지역 상세 */}
            <div className={FORM_ROW3}>
              <DealFormField label="재고 총수량" required error={fieldErrors.totalQty} htmlFor="deal-totalQty">
                <div className={groupCls("totalQty")}>
                  <input
                    id="deal-totalQty"
                    type="text"
                    inputMode="numeric"
                    className={GROUP_INPUT_CLS}
                    placeholder="예: 100"
                    value={formatPriceInput(totalQty)}
                    onChange={(e) => {
                      setTotalQty(e.target.value);
                      clearErr("totalQty");
                    }}
                  />
                  <select
                    id="deal-quantityUnit"
                    aria-label="재고 총수량 단위"
                    className={GROUP_SELECT_CLS}
                    style={{ width: 84 }}
                    value={quantityUnit}
                    onChange={(e) => {
                      setQuantityUnit(e.target.value);
                      setQuantityUnitTouched(true);
                      if (!priceUnitTouched && isDealPriceUnit(e.target.value)) setPriceUnit(e.target.value);
                    }}
                  >
                    {quantityUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                {!edit && <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }} data-qty-hint>소수점은 작은 단위로 적어주세요 (1.5톤 → 1,500kg)</p>}
                {priceMode === "fixed" && !lumpSum && priceUnit !== quantityUnit && (
                  <p className="mt-1 rounded-lg font-bold" role="status" data-unit-warn style={{ fontSize: rem(14), background: "#FFF8E1", border: "1.5px solid #F2D36B", color: "#7A5B00", padding: "6px 10px" }}>
                    가격은 {priceUnit}, 수량은 {quantityUnit}예요
                  </p>
                )}
              </DealFormField>
              <DealFormField label="재고 위치(지역)" required error={fieldErrors.region} htmlFor="deal-region">
                <select
                  id="deal-region"
                  className={inputCls("region")}
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    clearErr("region");
                  }}
                >
                  <option value="">지역을 선택해주세요</option>
                  {mockRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {!edit && (
                <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>
                  물건이 있는 곳(알림 매칭 기준)
                </p>
                )}
              </DealFormField>
              <DealFormField label="지역 상세" htmlFor="deal-location">
                <input
                  id="deal-location"
                  className={inputCls()}
                  placeholder="예: 가락동"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </DealFormField>
            </div>
          </div>
        </section>

        {/* 2026-10-23 edit 전용 — 재고 수량(총수량 이하)·마감 일시 + 연장·[조기 마감]. 사진 순서·대표 사진·영상은 오른쪽 사진·영상 칸(같은 업로더) */}
        {edit && (
          <section className="order-1" data-edit-only>
            <FormSectionTitle>재고 · 마감</FormSectionTitle>
            <div className="flex flex-col gap-2">
              <DealFormField label="재고 수량(남은 수량)" error={fieldErrors.remainingQty} htmlFor="deal-remainingQty">
                <div className={groupCls("remainingQty")}>
                  <input
                    id="deal-remainingQty"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={GROUP_INPUT_CLS}
                    value={remainingQty}
                    onChange={(e) => {
                      setRemainingQty(e.target.value);
                      clearErr("remainingQty");
                    }}
                  />
                  <span className="flex-shrink-0 flex items-center font-bold whitespace-nowrap" style={{ fontSize: rem(15), color: "#0B2540", padding: "0 12px 0 4px" }}>
                    / {parsePriceInput(totalQty) ?? initial!.total_qty}{quantityUnit}
                  </span>
                </div>
              </DealFormField>
              <DealFormField label="마감 일시" error={fieldErrors.closesAt} htmlFor="deal-closesAt">
                <div className="flex gap-1.5 items-center">
                  {[1, 7, 30].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => addDays(n)}
                      className="flex-shrink-0 font-bold text-navy border-2 border-gray200 rounded-lg px-3 bg-white"
                      style={{ fontSize: rem(14), height: 42 }}
                    >
                      +{n}일
                    </button>
                  ))}
                  <input
                    id="deal-closesAt"
                    type="datetime-local"
                    className={`${inputCls("closesAt")} flex-1`}
                    value={closesAtLocal}
                    min={minClosesLocal}
                    max={expiryDate && `${expiryDate}T23:59` < maxClosesLocal ? `${expiryDate}T23:59` : maxClosesLocal}
                    onChange={(e) => {
                      setClosesAtLocal(e.target.value);
                      clearErr("closesAt");
                    }}
                  />
                </div>
                <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>
                  {expiryDate ? `소비기한(${expiryDate.replace(/-/g, ".")}) 23:59까지 정할 수 있어요 · ` : ""}저장해야 반영돼요 · 알림은 다시 보내지 않아요
                </p>
              </DealFormField>
              {onCloseDeal && (
                <button
                  type="button"
                  onClick={onCloseDeal}
                  disabled={submitting}
                  className="font-bold text-orange border-2 border-orange rounded-lg py-2.5 bg-white disabled:opacity-50"
                  style={{ fontSize: rem(15) }}
                  data-early-close
                >
                  조기 마감
                </button>
              )}
            </div>
          </section>
        )}
        </div>

        <div className={editWide ? "@container flex flex-col gap-3 min-w-0 min-h-0 overflow-y-auto" : "order-3 flex flex-col gap-3"} data-col={editWide ? "2" : undefined}>
          <FormAccordion id="deal-sec-detail" title="제품 상세" count={detailCount} open={openDetail} onToggle={() => setOpenDetail((v) => !v)}>
            <div className="flex flex-col gap-3">
              <div className={FORM_ROW2}>
                {/* 2026-09-29: 일괄(전체 가격)이면 최소주문 없음 */}
                {!lumpSum && (
                <DealFormField label="최소 주문량(MOQ)" error={fieldErrors.minOrderQty} htmlFor="deal-minOrderQty">
                  <div className="relative">
                    <input
                      id="deal-minOrderQty"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      onWheel={(e) => e.currentTarget.blur()} // 휠로 값 바뀜 방지 (재고 칸과 같음)
                      className={`${inputCls("minOrderQty")} pr-20`}
                      placeholder="예: 10"
                      value={minOrderQty}
                      onChange={(e) => {
                        setMinOrderQty(e.target.value);
                        clearErr("minOrderQty");
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold whitespace-nowrap" style={{ fontSize: rem(15), color: "#0B2540" }}>{moqUnit(quantityUnit)} 이상</span>
                  </div>
                </DealFormField>
                )}
                {!edit && (
                <DealFormField label="마감까지 남은 시간" required={!!requestId} error={fieldErrors.closesAt} htmlFor="deal-closesIn">
                  <select
                    id="deal-closesIn"
                    className={inputCls("closesAt")}
                    value={closesChoice}
                    onChange={(e) => {
                      setClosesChoice(e.target.value);
                      clearErr("closesAt");
                    }}
                  >
                    {closesChoice === "" && <option value="">선택해주세요</option>}
                    {DEADLINE_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                  {closesChoice === DEADLINE_CUSTOM && (
                    <input
                      id="deal-closesCustom"
                      type="datetime-local"
                      className={`${inputCls("closesAt")} mt-1.5`}
                      value={closesCustom}
                      min={minClosesLocal}
                      max={expiryDate && `${expiryDate}T23:59` < maxClosesLocal ? `${expiryDate}T23:59` : maxClosesLocal}
                      onChange={(e) => {
                        setClosesCustom(e.target.value);
                        clearErr("closesAt");
                      }}
                    />
                  )}
                  <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>
                    최대 60일까지{expiryDate ? " · 소비기한 23:59 이전" : ""}
                  </p>
                </DealFormField>
                )}
              </div>

              <div className={FORM_ROW2}>
                <DealFormField label="보관 조건" htmlFor="deal-storageType">
                  <StorageTypeButtons id="deal-storageType" value={storageType} onChange={setStorageType} />
                </DealFormField>
                <DealFormField label="소비기한" required={stockType === "near_expiry"} error={fieldErrors.expiryDate} htmlFor="deal-expiryDate">
                  <input
                    id="deal-expiryDate"
                    type="date"
                    className={inputCls("expiryDate")}
                    value={expiryDate}
                    onChange={(e) => {
                      setExpiryDate(e.target.value);
                      clearErr("expiryDate");
                    }}
                  />
                  <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>
                    {expiryDate ? `상세·카드에 "${formatExpiry(expiryDate)}"로 보여요.` : stockType === "near_expiry" ? "소비기한 임박 재고는 꼭 입력해주세요." : "식품이면 입력해주세요."}
                  </p>
                  {legacyStorage && (
                    <p className="mt-1 rounded-lg" style={{ fontSize: rem(14), background: "#F5F6F8", color: "#4B5563", padding: "6px 10px" }}>
                      신청서 기존 입력: {legacyStorage} (위 칸을 비워 두면 이 내용이 그대로 표시돼요)
                    </p>
                  )}
                </DealFormField>
              </div>

              <div className={FORM_ROW3}>
                <DealFormField label="포장 단위" htmlFor="deal-packageUnit">
                  <SuggestInput id="deal-packageUnit" className={inputCls()} value={packageUnit} onChange={setPackageUnit} examples={edit ? [] : PACKAGE_UNIT_ADMIN_EXAMPLES} placeholder="예: 5kg 박스" />
                </DealFormField>
                <DealFormField label="규격/사이즈" htmlFor="deal-spec">
                  <SuggestInput id="deal-spec" className={inputCls()} value={spec} onChange={setSpec} examples={edit ? [] : SPEC_EXAMPLES} placeholder="예: 대 / 30cm" />
                </DealFormField>
                <DealFormField label="원산지" htmlFor="deal-origin">
                  <SuggestInput id="deal-origin" className={inputCls()} value={origin} onChange={setOrigin} examples={edit ? [] : ORIGIN_EXAMPLES} placeholder="예: 국내산" />
                </DealFormField>
              </div>
              <DealFormField label="상세 설명" htmlFor="deal-description">
                <textarea
                  id="deal-description"
                  className={`${inputCls()} focus:border-navy`}
                  rows={2}
                  placeholder="예: 소비기한 26년 10월, 냉동 보관 상태 양호"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDescWarnings([]);
                  }}
                />
                <ConfirmWarnings warnings={descWarnings} onConfirm={titleWarnings.length || priceWarns.length ? undefined : () => submit(true)} busy={submitting} />
              </DealFormField>
            </div>
          </FormAccordion>

          {!editWide && dealAccordionEl}

          {sellerAccordionEl}
        </div>
      </div>

      {/* 오른쪽 — 행 높이만큼 늘어나고(self-stretch) 등록 버튼(+ 오류 문구)만 맨 아래에서 sticky. 관리자는 하단 탭바가 없어 아래 여백 12px */}
      <div className={editWide ? "@container flex flex-col gap-4 min-w-0 min-h-0 overflow-y-auto" : wide ? "@container flex flex-col gap-4 min-w-0 self-stretch" : "contents"} data-col={editWide ? "3" : undefined}>
        <section className="order-2">
          <FormSectionTitle hint={edit ? undefined : "사진이 있으면 더 빨리 연결돼요"}>사진·영상</FormSectionTitle>
          <div className="flex flex-col gap-4">
            {/* 2026-10-27 브랜드 보호 — 공개 사진은 1장, 브랜드명·나머지 사진은 가입한 회원에게만. 켜면 영상 칸이 꺼짐 */}
            <div
              className="rounded-xl flex flex-col gap-2"
              style={{ border: `2px solid ${brandProtected ? "#9FB2C8" : "#E4E7EB"}`, background: brandProtected ? "#F3F6FA" : bpBlock ? "#F1F3F5" : "#fff", padding: brandProtected || bpBlock ? 12 : "8px 12px" }}
              data-brand-protect
            >
              <label className="flex items-center gap-3" style={{ cursor: bpBlock && !brandProtected ? "not-allowed" : "pointer" }}>
                <input
                  id="deal-brandProtected"
                  type="checkbox"
                  className="flex-shrink-0"
                  style={{ width: 26, height: 26, accentColor: "#0B2540" }}
                  checked={brandProtected}
                  disabled={!!bpBlock}
                  onChange={(e) => {
                    setBrandProtected(e.target.checked);
                    clearErr("brandName");
                  }}
                />
                <span className="min-w-0 flex flex-wrap items-baseline gap-x-2">
                  <b style={{ fontSize: rem(16), color: bpBlock && !brandProtected ? "#6B7480" : "#1a1f26" }}>🛡 브랜드 보호{edit ? (initial?.brand_protected === true ? "" : "로 바꾸기") : "로 등록"}</b>
                  <span className={brandProtected || bpBlock ? "basis-full" : ""} style={{ fontSize: rem(13), color: "#6B7480" }}>
                    {brandProtected || bpBlock ? "공개 사진은 1장만 나가고, 브랜드명과 나머지 사진은 가입한 회원에게만 보여요." : "공개 1장 · 브랜드명·나머지는 회원 전용"}
                  </span>
                </span>
              </label>
              {bpBlock && (
                <p className="font-bold" style={{ fontSize: rem(14), color: "#7A3E00" }} data-brand-protect-block>
                  {bpBlock}
                </p>
              )}
              {edit && brandProtected && initial?.brand_protected !== true && (
                <p className="rounded-lg" style={{ fontSize: rem(13), background: "#FFF4E0", border: "1px solid #F5D9A8", color: "#7A3E00", padding: "8px 10px" }}>
                  이미 공개된 사진은 보호로 바꿔도 이미 퍼진 곳(검색 결과·공유 미리보기 등)에서 바로 사라지지 않을 수 있어요.
                </p>
              )}
              {brandProtected && (
                <DealFormField label="브랜드명 (회원 전용)" required error={fieldErrors.brandName} htmlFor="deal-brandName">
                  <input
                    id="deal-brandName"
                    className={inputCls("brandName")}
                    value={brandName}
                    maxLength={BRAND_NAME_MAX}
                    onChange={(e) => {
                      setBrandName(e.target.value);
                      clearErr("brandName");
                    }}
                    placeholder="예: ○○제약"
                  />
                  <p style={{ fontSize: rem(13), color: "#6B7480", marginTop: 4 }}>비회원에게는 보이지 않아요. 매물명·설명에는 브랜드명을 쓰지 마세요.</p>
                </DealFormField>
              )}
            </div>
            <div id="deal-photos">
            <ImageUploader
              ref={imageUploaderRef}
              adminKey={adminKey}
              onChange={setImages}
              onPhotosChange={setPhotoRefs}
              protectMode={brandProtected}
              initialProtected={(initial?.protected_images ?? []).map((path, i) => ({ path, preview: initial?.protected_preview_urls?.[i] ?? null }))}
              onStatusChange={setPhotoStatus}
              label="매물 사진"
              // 2026-10-12: 관리자 한도 25장(판매신청은 12장까지 오고 관리자가 더 붙일 수 있음) — src/lib/photoLimit.ts
              max={ADMIN_PHOTO_LIMIT}
              hint={edit ? "정사각형(1080×1080) 권장" : `최대 ${ADMIN_PHOTO_LIMIT}장 (신청서에 첨부된 사진 포함) · 정사각형(1080×1080) 권장`}
              globalPaste // 2026-10-28 D: 폼 어디에서든 Ctrl+V로 사진 붙여넣기
              initialUrls={prefill?.images ?? []}
              onPreview={openPhotoPreview}
            />
            </div>
            <div id="deal-video">
              {brandProtected ? (
                <div className="rounded-xl" style={{ border: "2px dashed #C9CED4", background: "#F1F3F5", padding: 12, color: "#6B7480" }} data-video-disabled>
                  <b style={{ color: "#4B5563", fontSize: rem(15) }}>🚫 브랜드 보호 매물은 영상을 올릴 수 없어요</b>
                  <p style={{ fontSize: rem(13), marginTop: 2 }}>
                    영상에 브랜드가 그대로 나오기 때문이에요. 회원 전용 영상은 준비 중입니다. 영상이 필요하면 브랜드 보호를 끄고 등록해 주세요.
                  </p>
                </div>
              ) : (
                <VideoUploader
                  ref={videoUploaderRef}
                  adminKey={adminKey}
                  onChange={setVideoUrl}
                  initialUrl={prefill?.videoUrl}
                  onStatusChange={setVideoStatus}
                  inlinePlayer
                  hint={edit ? "" : undefined}
                  onPreview={openVideoPreview}
                />
              )}
            </div>
          </div>
        </section>

        {editWide && <div className="order-3">{dealAccordionEl}</div>}
        {!edit && (
        <div className="order-4 flex flex-col gap-3">
          <p className="text-[0.7778rem] text-gray500">
            <span className="text-orange font-bold">*</span> 매물명·카테고리·지역·판매 단가·재고 총수량은 필수예요{stockType === "near_expiry" ? " (소비기한 임박이면 소비기한도)" : ""}.
          </p>
          <p className="text-gray500" style={{ fontSize: rem(14) }}>
            {edit ? "수정·연장은 알림을 다시 보내지 않아요." : "🌙 밤 9시~아침 8시 등록 매물은 아침 8시에 발송돼요."}
          </p>
        </div>
        )}

        {footerSlot !== undefined ? (
          footerSlot &&
          createPortal(
            <>
              {error && <div className="text-[0.7778rem] font-medium" style={{ color: BLOCK_COLOR }} data-panel-error>{error}</div>}
              <button
                type="button"
                onClick={() => submit()}
                disabled={submitting || busyLabel !== null}
                className="text-white font-bold rounded-lg disabled:opacity-60 px-10 py-2.5"
                style={{ background: "#0B2540", fontSize: rem(15) }}
                data-panel-save
              >
                {submitting ? (edit ? "저장 중..." : "등록 중...") : busyLabel ?? (edit ? "변경사항 저장" : "매물 등록 확정")}
              </button>
            </>,
            footerSlot
          )
        ) : (
          <div className={wide ? "order-5 mt-auto sticky bottom-0 z-10 bg-gray100 pt-2 pb-3 flex flex-col gap-2" : "order-5 flex flex-col gap-3"}>
            {error && <div className="text-[0.7778rem] font-medium" style={{ color: BLOCK_COLOR }}>{error}</div>}
            <button
              onClick={() => submit()}
              disabled={submitting || busyLabel !== null}
              className="text-white font-bold rounded-lg disabled:opacity-60"
              style={{ background: "#0B2540", padding: "12px 0", fontSize: rem(15) }}
            >
              {submitting ? (edit ? "저장 중..." : "등록 중...") : busyLabel ?? (edit ? "변경사항 저장" : "매물 등록 확정")}
            </button>
          </div>
        )}
      </div>
      {lightbox && <AdminMediaLightbox items={lightbox.items} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <VideoNotUploadedSheet
        open={photoSheet !== null}
        title={`사진 ${photoStatus.failed}장이 올라가지 않았어요`}
        description={PHOTO_FAILED_DESCRIPTION}
        reselectLabel="다시 시도"
        skipLabel={edit ? "빼고 저장" : "빼고 등록"}
        onClose={() => setPhotoSheet(null)}
        onReselect={() => {
          imageUploaderRef.current?.retryFailed();
          document.getElementById("deal-photos")?.scrollIntoView({ behavior: "smooth", block: "center" });
          setPhotoSheet(null);
        }}
        onSkip={() => {
          const confirmWarnings = photoSheet?.confirmWarnings ?? false;
          imageUploaderRef.current?.removeFailed();
          setPhotoSheet(null);
          submit(confirmWarnings, false, true);
        }}
      />
      <VideoNotUploadedSheet
        open={videoSheet !== null}
        onClose={() => setVideoSheet(null)}
        onReselect={() => {
          videoUploaderRef.current?.reselect();
          document.getElementById("deal-video")?.scrollIntoView({ behavior: "smooth", block: "center" });
          setVideoSheet(null);
        }}
        skipLabel={edit && initial?.video_url ? "기존 영상 유지하고 저장" : edit ? "영상 빼고 저장" : undefined}
        description={edit && initial?.video_url ? "새로 고른 영상이 저장되지 않았어요. 기존 영상을 그대로 두고 저장하거나, 영상을 다시 골라주세요." : undefined}
        onSkip={() => {
          const confirmWarnings = videoSheet?.confirmWarnings ?? false;
          // edit + 기존 영상이 있으면 기존 영상 유지(다음에 열 때도 그 영상으로 시작), 없으면 비움
          if (edit && initial?.video_url) setVideoUrl(initial.video_url);
          else videoUploaderRef.current?.clear();
          setVideoSheet(null);
          submit(confirmWarnings, true);
        }}
      />
    </div>
  );
}

// 판매자 신청 → 매물 등록 폼 미리 채움 (2026-10-03 PR-D: 신청 카드 안이 아니라 새 매물 자리에서 열려 함수로 뺌, 값은 그대로)
function requestPrefill(r: SellerRequest) {
  return {
    title: r.product_name,
    // 신청서에 없으면 비워서 관리자가 직접 고르게 함 — 예전엔 첫 항목(수산·축산물/서울)이
    // 조용히 들어가 엉뚱한 구독자에게 알림이 갈 수 있었음
    category: r.categories?.name ?? undefined,
    region: r.regions?.name ?? undefined,
    // 2026-10-05: 협의 신청은 가격 방식 "가격 협의"로 미리 채움(관리자가 바꿀 수 있음) — 가격은 비워 둠
    priceMode: (isNegotiable(r) ? "negotiable" : "fixed") as PriceMode,
    dealPrice: isNegotiable(r) ? undefined : r.hope_price ?? undefined,
    originalPrice: isNegotiable(r) ? undefined : r.original_price ?? undefined,
    totalQty: r.quantity,
    quantityUnit: r.quantity_unit ?? undefined,
    priceUnit: r.price_unit ?? undefined,
    minOrderQty: r.min_order_qty ?? undefined,
    images: r.images ?? [],
    videoUrl: r.video_url ?? undefined,
    description: r.description ?? "",
    packageUnit: r.package_unit ?? "",
    origin: r.origin ?? "",
    spec: r.spec ?? "",
    // 2026-10-01 PR-B: 새 칸(보관·소비기한)을 이어받고, 둘 다 없는 예전 신청만 자유 입력 값을 그대로 넘김
    storageType: r.storage_type ?? undefined,
    expiryDate: r.expiry_date ?? undefined,
    storageCondition: r.storage_type || r.expiry_date ? "" : r.storage_condition ?? "",
    pid: r.pid ?? "",
    manifestItems: r.manifest_items ?? [],
    closesInHours: r.hope_duration_hours ?? undefined,
    stockType: r.stock_type ?? undefined,
    // 2026-09-30: 판매자 표시 — 신청서에서 공개를 고르고 업체명이 있을 때만 상호 공개로 시작
    sellerPublic: r.is_anonymous === false && !!r.company_name?.trim(),
    sellerCompanyName: r.company_name ?? "",
  };
}

type DealField = "title" | "brandName" | "category" | "region" | "originalPrice" | "dealPrice" | "totalQty" | "remainingQty" | "closesAt" | "minOrderQty" | "expiryDate" | "sellerPrivateCompany" | "sellerPrivatePhone" | "sellerPrivateName" | "businessCheckId" | "sourcedBy" | "shippingNote";
// 화면 위→아래 순서 (첫 누락 칸 포커스용) — 2026-10-01 2차: ① 매물명·판매/정상 단가·재고 총수량·지역 → 제품 상세(MOQ·소비기한) → 거래 조건(카테고리)
const DEAL_FIELD_ORDER: DealField[] = ["title", "brandName", "dealPrice", "originalPrice", "shippingNote", "totalQty", "remainingQty", "closesAt", "region", "minOrderQty", "expiryDate", "category", "sellerPrivateCompany", "sellerPrivatePhone", "sellerPrivateName", "businessCheckId", "sourcedBy"];

// 붙인 입력 그룹(한 테두리) — [입력 | 원 / 단위] (2026-10-01 2차)
const GROUP_INPUT_CLS = "flex-1 min-w-0 px-3 py-2.5 text-[0.8889rem] outline-none bg-transparent";
const GROUP_SELECT_CLS = "flex-shrink-0 outline-none font-bold px-2 border-l border-gray200 bg-[#FAFBFC] text-[0.8889rem] text-navy";

// 정상 단가 칸 아래 — "○% 할인으로 보여요" / 판매가 ≥ 정상가면 주황 안내 (2026-10-01 PR-B [3])
function DiscountHint({ original, deal }: { original?: number | null; deal?: number | null }) {
  if (!original || !deal) return null;
  const pct = discountPercent(original, deal);
  if (pct === null) {
    return <p className="mt-1 font-medium" style={{ fontSize: rem(14), color: WARN_COLOR }}>판매가가 정상가보다 높거나 같아 할인율이 안 보여요.</p>;
  }
  return <p className="mt-1 font-bold" style={{ fontSize: rem(14), color: pct >= HIGH_DISCOUNT_PCT ? WARN_COLOR : "#0B7A3E" }}>{pct}% 할인으로 보여요</p>;
}

function DealFormField({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="font-bold mb-1 block" style={{ fontSize: rem(15), color: "#374151" }}>
        {label}
        {required && <span className="text-orange ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="font-medium mt-1" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{error}</p>}
    </div>
  );
}

const NOTICE_CATEGORIES = ["부동산", "설비", "기타"];

// 2026-09-28: 긴급 공지(부동산·설비 처분 등) 등록 폼 — DealForm과 같은 패턴(adminKey
// 헤더, ImageUploader)을 쓰지만, 재고 매물의 수량/가격/카테고리 스키마와는 완전히
// 분리된 별도 폼. 지역은 "전국"(공백) 선택도 가능 — deals와 달리 특정 지역 없이도
// 등록 가능해야 해서 select 맨 앞에 "전국" 옵션을 추가로 둠.
// 2026-09-28 (2): 등록된 공지 한 줄 요약 + 마감 버튼. deals의 ActiveDealCard처럼
// 수정 UI까지는 필요 없어 보여 조회/마감만 지원 (수정이 필요해지면 그때 확장).
// 2026-10-10 관리자(일반) 회원 목록: 가린 번호 + [번호 보기] — 누를 때마다 감사 기록(member_phone_view)
function MemberPhoneReveal({ memberId, masked, adminKey }: { memberId: string; masked: string; adminKey: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/phone`, { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "번호를 불러오지 못했어요.");
      else setPhone(data.phone);
    } finally {
      setBusy(false);
    }
  };
  if (phone) return <a href={`tel:${phone}`} className="text-navy" data-testid="member-phone-full">{formatPhone(phone)}</a>;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span style={{ fontVariantNumeric: "tabular-nums" }} data-testid="member-phone-masked">{masked}</span>
      <button
        type="button"
        onClick={reveal}
        disabled={busy}
        className="text-xs font-bold rounded-lg px-2.5 py-1 border border-gray200 text-navy disabled:opacity-60 whitespace-nowrap"
        data-testid="member-phone-reveal"
      >
        {busy ? "불러오는 중..." : "번호 보기"}
      </button>
      {error && <span className="text-xs font-bold" style={{ color: "#B91C1C" }}>{error}</span>}
    </span>
  );
}

function NoticeAdminRow({
  notice,
  adminKey,
  onChanged,
}: {
  notice: NoticeItem;
  adminKey: string;
  onChanged: () => void;
}) {
  const [closing, setClosing] = useState(false);

  const close = async () => {
    if (!confirm(`"${notice.title}" 공지를 마감할까요?`)) return;
    setClosing(true);
    try {
      await fetch("/api/admin/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ id: notice.id, status: "closed" }),
      });
      onChanged();
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="bg-white border border-gray200 rounded-xl px-3.5 py-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs font-bold text-gray500">
          {notice.category} · {notice.regions?.name ?? "전국"}
        </div>
        <div className="text-sm font-bold text-gray900 truncate">{notice.title}</div>
      </div>
      <button
        type="button"
        onClick={close}
        disabled={closing}
        className="flex-shrink-0 text-xs font-bold rounded-lg px-3 py-2 disabled:opacity-50"
        style={{ color: "#C2410C", border: "2px solid #FDEEE8", background: "#FFF9F7" }}
      >
        {closing ? "마감 중..." : "마감"}
      </button>
    </div>
  );
}

function NoticeForm({ adminKey, onDone }: { adminKey: string; onDone: () => void }) {
  const [category, setCategory] = useState(NOTICE_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [region, setRegion] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2026-10-02 PR-B: 매물 폼과 같은 사진 규칙(영상 없음)
  const [photoStatus, setPhotoStatus] = useState<ImageUploadStatus>({ uploading: 0, failed: 0 });
  const [photoSheet, setPhotoSheet] = useState(false);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
  const busyLabel = uploadingLabel(photoStatus.uploading > 0, false);

  const submit = async (skipPhotos = false) => {
    setError(null);
    if (!title || !noticeBody) {
      setError("제목·내용은 필수예요.");
      return;
    }
    if (busyLabel) return;
    if (!skipPhotos && photoStatus.failed > 0) {
      setPhotoSheet(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminFetch("/api/admin/notices", adminKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          noticeBody,
          region: region || null,
          contactName: contactName || null,
          contactPhone: contactPhone || null,
          images,
        }),
      });
      if (res.status === 403) {
        setError(SUPER_ONLY_MESSAGE);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const sent = data.push?.sentCount ?? 0;
      alert(
        data.push?.held
          ? "공지가 등록됐어요. 밤 9시~아침 8시라 알림은 아침 8시에 발송돼요."
          : `공지가 등록됐어요. 긴급 공지 알림에 동의한 ${sent}명에게 발송했어요.`
      );
      onDone();
    } catch {
      setError("등록에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // 2026-09-29: 폼 라벨 방식(FieldLabel) — 안내가 placeholder에만 있던 문제, 사진 "최대 6장" 중복 제거
    <div className="mt-2 bg-gray100 rounded-2xl p-4 flex flex-col gap-4">
      <div>
        <FieldLabel need="required">분류</FieldLabel>
        <select className="w-full border-2 border-gray200 rounded-xl px-3.5 outline-none focus:border-navy bg-white" style={{ height: 52, fontSize: FORM_INPUT_FONT_SIZE }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {NOTICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel need="required">제목</FieldLabel>
        <input className="w-full border-2 border-gray200 rounded-xl px-3.5 outline-none focus:border-navy bg-white" style={{ height: 52, fontSize: FORM_INPUT_FONT_SIZE }} placeholder="예: 하남 사세확장으로 인수하실분 찾습니다" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <FieldLabel need="required">내용</FieldLabel>
        <textarea
          className="w-full border-2 border-gray200 rounded-xl px-3.5 py-3 outline-none focus:border-navy bg-white"
          style={{ fontSize: FORM_INPUT_FONT_SIZE, lineHeight: 1.55 }}
          rows={4}
          placeholder="평수, 시설, 가격 협의 여부 등"
          value={noticeBody}
          onChange={(e) => setNoticeBody(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel need="optional">소재지(표시용)</FieldLabel>
        <select className="w-full border-2 border-gray200 rounded-xl px-3.5 outline-none focus:border-navy bg-white" style={{ height: 52, fontSize: FORM_INPUT_FONT_SIZE }} value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">표시 안 함</option>
          {mockRegions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>공지 목록에 보이는 소재지예요. 알림은 지역과 관계없이 전체 발송돼요.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <FieldLabel need="optional">담당자명</FieldLabel>
          <input className="w-full border-2 border-gray200 rounded-xl px-3.5 outline-none focus:border-navy bg-white" style={{ height: 52, fontSize: FORM_INPUT_FONT_SIZE }} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="min-w-0">
          <FieldLabel need="optional">연락처</FieldLabel>
          <input className="w-full border-2 border-gray200 rounded-xl px-3.5 outline-none focus:border-navy bg-white" style={{ height: 52, fontSize: FORM_INPUT_FONT_SIZE }} inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>

      <ImageUploader ref={imageUploaderRef} adminKey={adminKey} onChange={setImages} onStatusChange={setPhotoStatus} max={ADMIN_PHOTO_LIMIT} label="사진" hint={`부동산·설비 현장 사진, 최대 ${ADMIN_PHOTO_LIMIT}장`} />

      {error && <div className="text-orange font-medium" style={{ fontSize: rem(15) }}>{error}</div>}

      <p className="text-gray500" style={{ fontSize: rem(14) }}>
        🌙 밤 9시~아침 8시 등록 공지는 아침 8시에 발송돼요.
      </p>

      <button onClick={() => submit()} disabled={submitting || busyLabel !== null} className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
        {submitting ? "등록 중..." : busyLabel ?? "공지 등록 확정"}
      </button>
      <VideoNotUploadedSheet
        open={photoSheet}
        title={`사진 ${photoStatus.failed}장이 올라가지 않았어요`}
        description={PHOTO_FAILED_DESCRIPTION}
        reselectLabel="다시 시도"
        skipLabel="빼고 등록"
        onClose={() => setPhotoSheet(false)}
        onReselect={() => {
          imageUploaderRef.current?.retryFailed();
          setPhotoSheet(false);
        }}
        onSkip={() => {
          setPhotoSheet(false);
          imageUploaderRef.current?.removeFailed();
          submit(true);
        }}
      />
    </div>
  );
}
