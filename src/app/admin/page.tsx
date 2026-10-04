"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { mockCategories, mockRegions, categoryIcons, quantityUnits } from "@/lib/mockData";
import ImageUploader, { type ImageUploadStatus, type ImageUploaderHandle } from "@/components/ImageUploader";
import VideoUploader, { type VideoUploadStatus, type VideoUploaderHandle } from "@/components/VideoUploader";
import VideoNotUploadedSheet, { PHOTO_FAILED_DESCRIPTION, uploadingLabel, videoNotUploaded } from "@/components/VideoNotUploadedSheet";
import SellerDisplayPicker from "@/components/SellerDisplayPicker";
import { scrollToBizCheck } from "@/lib/bizCheckJump";
import { NEGOTIABLE_TEXT, type PriceMode } from "@/lib/priceMode";
import SellerPrivateFields, { EMPTY_SELLER_PRIVATE, type SellerPrivateDraft } from "@/components/admin/SellerPrivateFields";
import DealSellerPrivateEditor from "@/components/admin/DealSellerPrivateEditor";
import { publicSellerName } from "@/lib/sellerDisplay";
import { isTestTitle } from "@/lib/categoryAvg";
import { formatPhoneTyping } from "@/lib/auth";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { normalizeTitle, checkTitle, checkDescription } from "@/lib/titleGuard";
import ConfirmWarnings, { BLOCK_COLOR, WARN_COLOR } from "@/components/ConfirmWarnings";
import {
  isStorageType, discountPercent, priceWarnings, HIGH_DISCOUNT_PCT, storageSummary, formatExpiry, EXPIRY_REQUIRED_MESSAGE,
  PACKAGE_UNIT_EXAMPLES, SPEC_EXAMPLES, ORIGIN_EXAMPLES, type StorageType,
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
import { MAX_PHOTO_SLOTS } from "@/lib/photoLimit";
import { validateDealEdit, dealEditWarnings, type DealEditField, type DealEditInput } from "@/lib/dealEdit";
import { DEAL_PRICE_UNITS, LUMP_SUM, isDealPriceUnit, isLumpSum, priceUnitSuffix } from "@/lib/priceUnit";
import { UI_SECTION, UI_CARD_TITLE, UI_LINK, BTN_CLASS, btnStyle } from "@/lib/uiText";
import { FieldLabel, FORM_INPUT_FONT_SIZE } from "@/components/FormField";
import { RatioMetric, DailyBars, FunnelBars, InlineBar, BIG_NUM, LABEL, CARD } from "@/components/admin/DashboardViz";
import AdminListCard from "@/components/admin/AdminListCard";
import BusinessCheckSection, { BusinessCheckBadge } from "@/components/admin/BusinessCheckSection";
import ConnectionBoard from "@/components/admin/ConnectionBoard";
import { CARD_TITLE_PROPS } from "@/components/admin/cardTitle";
import { isPassingCheck, NOT_CHECKED_MESSAGE, type BusinessCheck } from "@/lib/businessCheck";
import { formatConsentDate } from "@/lib/consent";

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
  // 2026-10-03 feat/admin-deal-edit: 카드에서 수정하는 칸 (목록 API가 select * 로 이미 줌)
  original_price?: number | null;
  min_order_qty?: number | null;
  price_unit?: string | null;
  stock_type?: string | null;
  expiry_date?: string | null;
  description?: string | null;
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
// 2026-10-01: 최고관리자 전용 API(영구 삭제·공식 파트너 승인/거절·긴급 공지)가 403이면 안내 (버튼 숨김은 공개 후)
const SUPER_ONLY_MESSAGE = "최고관리자만 할 수 있어요";

export default function AdminPage() {
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loginPhone, setLoginPhone] = useState(""); // 2026-10-01: 번호 + 비밀번호 로그인
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

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
      const session = { key: data.token, ts, name: data.admin.name, role: data.admin.role };
      sessionStorage.setItem("jumpingbid_admin_session", JSON.stringify(session));
      setKey(data.token);
      setAdminName(data.admin.name);
      setAdminRole(data.admin.role);
      setSessionExpiresAt(ts + ADMIN_SESSION_TTL_MS);
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
        <input
          type="tel"
          name="username"
          autoComplete="username"
          inputMode="numeric"
          className="w-full max-w-xs border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange mb-2"
          style={{ height: "52px" }}
          value={loginPhone}
          onChange={(e) => setLoginPhone(formatPhoneTyping(e.target.value))}
          placeholder="관리자 휴대폰 번호"
        />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="w-full max-w-xs border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
          style={{ height: "52px" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="비밀번호 입력"
        />
        {loginError && <p className="text-orange text-sm font-medium mt-2">{loginError}</p>}
        <button
          onClick={login}
          disabled={loggingIn}
          className="w-full max-w-xs mt-3 text-white font-bold rounded-xl text-base disabled:opacity-60"
          style={{ background: "#0B2540", padding: "14px 0" }}
        >
          {loggingIn ? "확인 중..." : "입장"}
        </button>
      </main>
    );
  }

  return (
    <AdminDashboard
      adminKey={key}
      adminName={adminName}
      adminRole={adminRole}
      sessionExpiresAt={sessionExpiresAt}
      onLogout={logout}
    />
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
  // 2026-10-03 PR-D: 매물 등록 폼(새 매물·판매자 신청)은 한 자리에 하나만 — 작성 중이면 바꾸기 전에 확인
  const dealFormDirtyRef = useRef(false);
  const setDealFormDirty = useCallback((dirty: boolean) => {
    dealFormDirtyRef.current = dirty;
  }, []);
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
    if (next !== "new" && next !== "notice") {
      // 판매자 신청 → 새 매물 자리로 스크롤 (폼이 그려진 다음)
      setTimeout(() => document.getElementById("deal-form-slot")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    }
  };
  const [authError, setAuthError] = useState<string | null>(null);
  const [licenseLoadingId, setLicenseLoadingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "business" | "subscribed" | "unsubscribed">("all");
  const [leadFilter, setLeadFilter] = useState<"all" | "uncontacted" | "pending" | "completed" | "no_deal">("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [appointFor, setAppointFor] = useState<Member | null>(null);
  const [appointName, setAppointName] = useState("");
  const [appointRole, setAppointRole] = useState<"관리자" | "최고관리자">("관리자");
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
  const [partnerReqOpen, setPartnerReqOpen] = useState(true);
  const [buyReqOpen, setBuyReqOpen] = useState(true);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [memberShowCount, setMemberShowCount] = useState(20);

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
    Promise.all([
      fetch("/api/admin/seller-requests", { headers: { "x-admin-key": adminKey } }).then((res) => {
        if (res.status === 401 || res.status === 429) {
          return res.json().then((body) => {
            setAuthError(body?.error ?? "인증에 실패했어요.");
            throw new Error("unauthorized");
          });
        }
        return res.json();
      }),
      fetch("/api/admin/deals/manage", { headers: { "x-admin-key": adminKey } }).then((res) =>
        res.json()
      ),
      fetch("/api/admin/interests", { headers: { "x-admin-key": adminKey } }).then((res) =>
        res.json()
      ),
      fetch("/api/admin/buy-requests", { headers: { "x-admin-key": adminKey } }).then((res) =>
        res.json()
      ),
      fetch("/api/admin/members", { headers: { "x-admin-key": adminKey } }).then((res) =>
        res.json()
      ),
      fetch("/api/admin/partner-requests", { headers: { "x-admin-key": adminKey } })
        .then((r) => r.json())
        .then((d) => setPartnerRequests(d.items ?? [])),
      fetch("/api/admin/partners-overview", { headers: { "x-admin-key": adminKey } })
        .then((r) => r.json())
        .then((d) => setPartnersOverview(d.items ?? [])),
      fetch("/api/admin/admins", { headers: { "x-admin-key": adminKey } })
        .then((r) => r.json())
        .then((d) => setAdmins(d.items ?? [])),
      // 내 견적함 오픈 알림 신청 수 — 테이블이 아직 없거나 실패하면 null("—" 표시)
      fetch("/api/admin/feature-waitlist", { headers: { "x-admin-key": adminKey } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setQuotesWaitlist(d?.quotes ?? null))
        .catch(() => setQuotesWaitlist(null)),
      fetch("/api/admin/category-kpis", { headers: { "x-admin-key": adminKey } })
        .then((r) => r.json())
        .then((d) => setCategoryKpis(d.items ?? [])),
      fetch("/api/admin/notices", { headers: { "x-admin-key": adminKey } })
        .then((r) => r.json())
        .then((d) => setNotices(d.items ?? [])),
      fetch("/api/admin/kpi-daily", { headers: { "x-admin-key": adminKey } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setKpiDaily(d?.missing ? null : d?.items ?? null))
        .catch(() => setKpiDaily(null)),
      fetch("/api/admin/dashboard-metrics", { headers: { "x-admin-key": adminKey } })
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

  useEffect(load, [adminKey]);

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
    if (leadFilter === "uncontacted" && i.contacted) return false;
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
  const leadNeedsAction = (i: Interest) => !i.contacted && i.outcome === "pending";
  const sortedInterests = [...filteredInterests].sort(
    (a, b) => Number(!leadNeedsAction(a)) - Number(!leadNeedsAction(b))
  );
  const buyRank = (b: BuyRequest) => (!b.contacted ? 0 : b.outcome === "pending" ? 1 : 2);
  const sortedBuyRequests = [...buyRequests].sort((a, b) => buyRank(a) - buyRank(b));
  const sortedPartnerRequests = [...partnerRequests].sort(
    (a, b) => Number(a.status !== "pending") - Number(b.status !== "pending")
  );

  const exportMembersCsv = () => {
    downloadCsv(`members_${new Date().toISOString().slice(0, 10)}.csv`, [
      ["전화번호", "회원번호", "상호명", "사업자여부", "사업자인증", "구독여부", "카테고리", "지역", "가입일"],
      ...filteredMembers.map((m) => [
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

  const exportLeadsCsv = () => {
    downloadCsv(`leads_${new Date().toISOString().slice(0, 10)}.csv`, [
      ["번호", "매물명", "연락상태", "결과", "성사금액", "리드유형", "일시"],
      ...filteredInterests.map((i) => [
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
  // 역할이 두 가지뿐이라 버튼 하나로 토글(관리자 ↔ 최고관리자).
  const changeAdminRole = async (admin: AdminUser) => {
    const nextRole = admin.role === "최고관리자" ? "관리자" : "최고관리자";
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

  // 2026-10-04: 매물 등록 폼·수정 카드의 "사업자 조회 바로가기" — 사업자 조회 섹션의 판매 신청을 "선택 안 함(직접 등록)"으로 되돌리고
  // (예전에 어떤 신청 카드에서 골라 둔 게 남아 있으면 직접 등록용 조회가 그 신청에 붙어 버림) 그 위치로 스크롤 + 잠깐 강조
  const goToBizCheck = () => {
    setBizPreselect({ id: "", nonce: Date.now() });
    scrollToBizCheck();
  };

  // 2026-10-01 (커밋 J): 목록 카드를 변수로 — 📱·자동은 기존 1열 순서 그대로, 💻는 세로로 쌓는 3단(CSS columns)에
  // 중요도 순(재고문의(관심 표시) → 판매 신청 → 진행 중 매물 → 파트너 신청 → 실적 → 찾습니다 → 회원 → 관리자)으로 배치.
  // 예전 3칸 격자는 행 높이가 가장 긴 카드에 맞춰져 빈칸이 컸음. 💻에서 0건 카드는 한 줄(제목 + "없어요")로 줄임.
  // 2026-10-02 (PR-C1): 목록 카드는 AdminListCard — 안쪽 스크롤(maxHeight 480) 없이 기본 5건 + [전체 보기].
  // 회원 목록만 기존 20건씩 더보기를 그대로 두고 5건 줄이기는 안 씀(limit null).
  const membersBlock = (
    <>
      <AdminListCard
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pt-4 flex flex-col gap-3"
        }
        title={<span {...CARD_TITLE_PROPS}>최근 가입 회원 <span style={{ ...LABEL, fontWeight: 400 }}>({members.length}명)</span></span>}
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
                  : { background: "#F5F6F8", color: "#6B7480" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={exportMembersCsv} className="self-end text-xs font-bold text-navy underline">
          CSV 내보내기 ({filteredMembers.length}건)
        </button>
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
          <div key={m.id} className="bg-white border border-gray200 rounded-2xl px-4 py-3.5">
            {/* 2026-09-28: 데스크톱 3열 레이아웃의 좁은 컬럼 폭에서 전화번호+뱃지가
                줄바꿈 없이 한 줄로 강제돼 카드 자체가 옆으로 넘쳤음(overflow-y만
                걸려 있으면 overflow-x가 자동으로 auto가 되는 CSS 규칙 때문에
                가로 스크롤바까지 생김) — 그 결과 카드 하단 "관리자로 임명" 버튼도
                스크롤해야만 보이는 문제로 이어짐. flex-wrap으로 뱃지가 필요하면
                둘째 줄로 내려가게 해서 카드 폭 안에 항상 들어오도록 수정. */}
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
              <div className="text-base font-bold text-gray900">
                {formatPhone(m.phone)}
                {m.member_no != null && (
                  <span className="text-xs font-bold text-gray500 ml-1.5">{formatMemberNo(m.member_no)}</span>
                )}
                {m.nickname && <span className="text-sm font-medium text-gray500 ml-1.5">{m.nickname}</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{
                    background: m.push_subscribed ? "#E8F8EC" : "#FDEEE8",
                    color: m.push_subscribed ? "#1D8A44" : "#C2410C",
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
                    style={{ background: "#E8F8EC", color: "#1D8A44" }}
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
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
              {adminRole === "최고관리자" && !adminPhones.has(normalizePhone(m.phone)) && (
                <button
                  onClick={() => openAppoint(m)}
                  className="text-xs font-bold rounded-lg px-2.5 py-1 border border-gray200 text-navy"
                >
                  관리자로 임명
                </button>
              )}
            </div>
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
    </>
  );
  const leadsBlock = (
    <>
      <AdminListCard
        id="leads"
        className={
          isDesktop
            ? "col-span-2 bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pt-4 flex flex-col gap-3"
        }
        title={
          <span {...CARD_TITLE_PROPS}>
            관심 표시한 회원 <span style={{ ...LABEL, fontWeight: 400 }}>({interests.filter(leadNeedsAction).length}건 미연락)</span>
          </span>
        }
        open={leadsOpen}
        onToggle={() => setLeadsOpen((v) => !v)}
        toolbar={
        <>
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
                  : { background: "#F5F6F8", color: "#6B7480" }
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
          <button onClick={exportLeadsCsv} className="text-xs font-bold text-navy underline">
            CSV 내보내기 ({filteredInterests.length}건)
          </button>
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
            <div className="text-center text-gray500 py-6 text-sm">
              {interests.length === 0 ? "아직 관심 표시가 없어요." : "검색/필터 결과가 없어요."}
            </div>
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
                    <span className="whitespace-nowrap inline-flex items-center gap-0.5" style={{ fontSize: rem(14), color: "#1D8A44" }}>
                      · <CheckCircle className="w-3 h-3" /> 인증 사업자
                    </span>
                  ) : (
                    i.members?.is_business && <span className="whitespace-nowrap" style={LABEL}>· 사업자</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {i.outcome === "completed" && (
                    <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: rem(14), background: "#E8F8EC", color: "#1D8A44" }}>
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
                    <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ fontSize: rem(14), background: "#E8F8EC", color: "#1D8A44" }}>
                      연결 동의 ✓ {formatConsentDate(i.connection_consent_at)}
                    </span>
                  )}
                  {!i.contacted && i.outcome === "pending" && (
                    <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: rem(14), background: "#FDECEC", color: "#B91C1C" }}>
                      미연락
                    </span>
                  )}
                </div>
                <div className="mt-1" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
                  {new Date(i.created_at).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {i.outcome === "completed" && i.completed_amount && (
                    <span className="ml-1.5 font-bold" style={{ color: "#1D8A44" }}>
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
                style={{ fontSize: rem(15), minHeight: 40, ...(i.contacted ? { background: "#F5F6F8", color: "#6B7480" } : { background: "#0B2540", color: "#fff" }) }}
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
                  style={{ fontSize: rem(15), minHeight: 40, background: "#E8F8EC", color: "#1D8A44" }}
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
    />
  );
  const formRequest = openFormFor && openFormFor !== "new" && openFormFor !== "notice" ? requests.find((r) => r.id === openFormFor) ?? null : null;
  const newDealBlock = (
    <>
      <div
        className={isDesktop ? "col-span-3" : "px-5 py-4"}
        style={isDesktop ? { order: -1 } : undefined}
      >
        {openFormFor === "new" ? (
          <button type="button" onClick={closeDealForm} className={`ml-auto ${BTN_CLASS}`} style={{ ...btnStyle("secondary"), minHeight: 40, fontSize: rem(15), padding: "0 16px" }}>
            닫기
          </button>
        ) : (
          <button onClick={() => switchForm("new")} className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
            + 새 매물 직접 등록
          </button>
        )}
        {/* 2026-10-03 PR-D: 매물 등록 폼은 한 자리에 하나만 — 새 매물이든 판매자 신청([매물로 등록하기])이든 여기(전체 폭)에서 열림 */}
        <div id="deal-form-slot" style={{ scrollMarginTop: 12 }}>
          {formRequest && (
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
          {openFormFor === "new" && (
            <DealForm key="new" adminKey={adminKey} wide={isDesktop} onDirtyChange={setDealFormDirty} onGoBizCheck={goToBizCheck} onDone={() => { setOpenFormFor(null); load(); }} />
          )}
          {formRequest && (
            <DealForm
              key={formRequest.id}
              adminKey={adminKey}
              wide={isDesktop}
              onDirtyChange={setDealFormDirty}
              onGoBizCheck={goToBizCheck}
              prefill={requestPrefill(formRequest)}
              requestId={formRequest.id}
              onDone={() => { setOpenFormFor(null); load(); }}
            />
          )}
        </div>

        {/* 2026-09-28: 긴급 공지(부동산·설비 처분) — 재고 매물과 별개 등록 경로.
            방향성 확정 전까지는 메모만 해두기로 했던 부동산/설비 아이디어를
            "긴급 공지"라는 가벼운 트랙으로 구현. 구인/구직은 법률 검토 전까지 제외. */}
        {openFormFor === "notice" ? (
          <div className="flex items-center justify-between mt-3">
            <span {...CARD_TITLE_PROPS}>긴급 공지 등록</span>
            <button type="button" onClick={() => setOpenFormFor(null)} className={BTN_CLASS} style={{ ...btnStyle("secondary"), minHeight: 40, fontSize: rem(15), padding: "0 16px" }}>
              닫기
            </button>
          </div>
        ) : (
          <button onClick={() => switchForm("notice")} className={`w-full mt-2 ${BTN_CLASS}`} style={btnStyle("secondary")}>
            + 긴급 공지 등록 (부동산·설비)
          </button>
        )}
        {openFormFor === "notice" && (
          <NoticeForm adminKey={adminKey} onDone={() => { setOpenFormFor(null); load(); }} />
        )}

        {/* 2026-09-28 (2): 등록 폼만 있고 내릴 방법이 없다는 지적 반영 — 등록된
            공지를 한 줄 요약 + [마감]으로 노출. deals의 "조기 마감" 패턴과 동일. */}
        {notices.length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
            <div className="text-xs font-bold text-gray500">등록된 긴급 공지 ({notices.length})</div>
            {notices.map((n) => (
              <NoticeAdminRow key={n.id} notice={n} adminKey={adminKey} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </>
  );
  const activeDealsBlock = (
    <>
      <AdminListCard
        id="active-deals"
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pb-6 flex flex-col gap-3"
        }
        title={<span {...CARD_TITLE_PROPS}>진행 중인 매물 <span style={{ ...LABEL, fontWeight: 400 }}>({activeDeals.length}건)</span></span>}
        empty={!loading && <div className="text-center text-gray500 py-6 text-sm">진행 중인 매물이 없어요.</div>}
        listClassName="flex flex-col gap-3"
        items={activeDeals}
        renderItem={(d) => (
          <ActiveDealCard
            key={d.id}
            deal={d}
            adminKey={adminKey}
            onChanged={load}
            canDelete={adminRole === "최고관리자"}
            onGoBizCheck={goToBizCheck}
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
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pb-8 flex flex-col gap-3"
        }
        title={<span {...CARD_TITLE_PROPS}>대기 중인 판매자 신청 <span style={{ ...LABEL, fontWeight: 400 }}>({requests.length}건)</span></span>}
        open={sellerReqOpen}
        onToggle={() => setSellerReqOpen((v) => !v)}
        toolbar={loading && <div className="text-center text-gray500 py-8">불러오는 중...</div>}
        empty={!loading && <div className="text-center text-gray500 py-8 text-sm">대기 중인 신청이 없어요.</div>}
        items={requests}
        renderItem={(r) => (
          <div key={r.id} className="bg-white border border-gray200 rounded-2xl px-4 py-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray500">
              <span>{categoryIcons[r.categories?.name ?? ""] ?? "🗂️"}</span>
              {[r.categories?.name, r.regions?.name].filter(Boolean).join(" · ") || "카테고리/지역 미입력"}
            </div>
            <div className="text-base font-bold text-gray900 mt-1.5">{r.product_name}</div>
            {/* 2026-09-29: 재고 유형 배지 (일반 재고는 없음) */}
            <StockTypeBadge value={r.stock_type} className="mt-1" />
            <div className="text-sm text-gray500 mt-1">
              {[r.company_name, r.contact_name, r.contact_phone && formatPhone(r.contact_phone)].filter(Boolean).join(" · ")}
            </div>
            <div className="text-sm text-gray500 mt-1">
              수량 {r.quantity}{r.quantity_unit || "개"}
              {r.min_order_qty ? ` (MOQ ${r.min_order_qty}${r.quantity_unit || "개"})` : ""}
              {r.hope_price ? ` · 희망단가 ${formatDealPrice(r.hope_price, r.quantity_unit, r.price_unit)}` : ""}
              {r.hope_duration_hours
                ? ` · 희망 마감 ${
                    r.hope_duration_hours >= 24
                      ? `${Math.round(r.hope_duration_hours / 24)}일`
                      : `${r.hope_duration_hours}시간`
                  } 후`
                : " · 마감시점 협의 필요"}
            </div>
            {r.original_price ? (
              <div className="text-sm text-gray500 mt-1">정상단가 {formatDealPrice(r.original_price, r.quantity_unit, r.price_unit)}</div>
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
            {openFormFor !== r.id && !isPassingCheck(latestBizCheck(r.id)) && (
              <div className="mt-1.5 text-sm text-gray500">{NOT_CHECKED_MESSAGE}</div>
            )}
          </div>
        )}
      />
    </>
  );
  // 2026-10-04 판매자 신원 확인: "사업자 조회" — 판매자 신청 목록 바로 위(📱 세로 순서·💻 3단 모두)
  const bizCheckBlock = (
    <BusinessCheckSection
      adminKey={adminKey}
      adminRole={adminRole}
      requests={requests}
      phoneMatch={bizPhoneMatch}
      preselect={bizPreselect}
      className={
        isDesktop
          ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
          : "px-5 pb-6 flex flex-col gap-3"
      }
      onChanged={() => loadBizChecks(requests.map((r) => r.id))}
    />
  );
  const partnerReqBlock = (
    <>
      <AdminListCard
        as="section"
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4"
            : "mt-8 px-5"
        }
        title={
          <h2 {...CARD_TITLE_PROPS}>
            🏅 공식 점핑파트너 신청 <span style={{ ...LABEL, fontWeight: 400 }}>({partnerRequests.filter((r) => r.status === "pending").length}건 대기)</span>
          </h2>
        }
        open={partnerReqOpen}
        onToggle={() => setPartnerReqOpen((v) => !v)}
        listClassName="mt-3 flex flex-col gap-2"
        items={sortedPartnerRequests}
        renderItem={(r) => (
            <div key={r.id} className="bg-white border border-gray200 rounded-2xl px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gray900">{r.members?.company_name ?? r.members?.phone ?? r.member_id}</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={
                    r.status === "pending"
                      ? { background: "#FFF4E0", color: "#966B00" }
                      : r.status === "approved"
                      ? { background: "#E8F8EC", color: "#1D8A44" }
                      : { background: "#F1F1EF", color: "#6B7480" }
                  }
                >
                  {r.status === "pending" ? "심사중" : r.status === "approved" ? "승인됨" : "거절됨"}
                </span>
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
  const partnersOverviewBlock = (
    <>
      {/* 2026-09-27: 운영자가 승인된 파트너 전원의 추천 실적을 한눈에 보는
          집계 대시보드 — 위 섹션(신청 승인/거절)과는 별개로, 이미 승인된
          파트너들의 성과 비교용. 승인 즉시 여기 0건으로 나타남. */}
      <AdminListCard
        as="section"
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4"
            : "mt-8 px-5"
        }
        title={
          <h2 {...CARD_TITLE_PROPS}>
            📊 점핑파트너 실적 <span style={{ ...LABEL, fontWeight: 400 }}>({partnersOverview.length}명)</span>
          </h2>
        }
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
  const buyRequestsBlock = (
    <>
      <AdminListCard
        id="buy-requests"
        className={
          isDesktop
            ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3"
            : "px-5 pb-8 flex flex-col gap-3"
        }
        title={
          <span {...CARD_TITLE_PROPS}>
            🔍 이런 재고 찾습니다 <span style={{ ...LABEL, fontWeight: 400 }}>({buyRequests.filter((b) => !b.contacted).length}건 미연락)</span>
          </span>
        }
        open={buyReqOpen}
        onToggle={() => setBuyReqOpen((v) => !v)}
        empty={!loading && <div className="text-center text-gray500 py-6 text-sm">등록된 구매 희망이 없어요.</div>}
        items={sortedBuyRequests}
        renderItem={(b) => (
          <div key={b.id} className="bg-white border border-gray200 rounded-2xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray500">
                <span>{categoryIcons[b.categories?.name ?? ""] ?? "🗂️"}</span>
                {b.categories?.name ?? "카테고리 미지정"} · {b.regions?.name ?? "전국 가능"}
              </div>
              {b.outcome === "matched" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#E8F8EC", color: "#1D8A44" }}>
                  매칭 완료
                </span>
              )}
              {b.outcome === "no_match" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray100 text-gray500">
                  매칭 불발
                </span>
              )}
            </div>
            <div className="text-base font-bold text-gray900 mt-1.5">{b.product_name}</div>
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
              {b.hope_price ? ` · 희망가 ${formatPriceWithUnit(b.hope_price, b.hope_price_unit)} 이하` : ""}
            </div>
            {b.description && (
              <div className="text-sm text-gray500 mt-1 bg-gray100 rounded-lg px-3 py-2">
                <span className="font-bold" style={{ color: "#9AA3AD" }}>
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
                    ? { background: "#F5F6F8", color: "#6B7480" }
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
                    style={{ background: "#E8F8EC", color: "#1D8A44" }}
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
  const adminsBlock = adminRole === "최고관리자" ? (
        <div className={isDesktop ? "bg-white border border-gray200 rounded-2xl p-4 flex flex-col gap-3" : "px-5 pt-4 pb-8 flex flex-col gap-3"}>
          <button
            type="button"
            onClick={() => setAdminsOpen((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <span {...CARD_TITLE_PROPS}>관리자 목록 <span style={{ ...LABEL, fontWeight: 400 }}>({admins.length}명)</span></span>
            <span className="text-sm font-bold text-gray500">{adminsOpen ? "접기 ▲" : "펼치기 ▼"}</span>
          </button>
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
                <button
                  onClick={() => changeAdminRole(a)}
                  disabled={roleChangingId === a.id}
                  className="text-xs font-bold rounded-lg px-3 py-1.5 border border-gray200 text-navy disabled:opacity-60"
                >
                  {roleChangingId === a.id ? "변경 중..." : "역할 변경"}
                </button>
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
      className={isDesktop ? "flex flex-col min-h-screen mx-auto w-full max-w-[1200px] bg-white shadow-sm" : "flex flex-col min-h-screen mx-auto w-full max-w-md bg-white shadow-sm"}
      // 2026-10-01 (커밋 J): 맨 아래 목록이 화면 끝에 붙어 "끝난 것처럼" 보이던 문제 — 하단 여백 pb-24 + 안전 영역
      style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
    >
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
          {interests.filter((i) => !i.contacted).length > 0 && (
            <div className="text-xs font-bold mt-1" style={{ color: "var(--color-brandOrangeAccent)" }}>
              🔔 미연락 리드 {interests.filter((i) => !i.contacted).length}건
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

      {/* 2026-09-29: 시각적 위계 — ① 조치 필요 → ② 핵심 지표 → ③ 참고 현황·목록.
          색은 의미 있을 때만(조치 1건↑ 주황/빨강, 0건 회색, 일반 지표 남색 1색). 막대는 CSS만(DashboardViz). */}
      <div className={isDesktop ? "px-8 pt-5 max-w-[1200px] mx-auto w-full flex flex-col gap-6" : "px-5 pt-5 flex flex-col gap-6"}>
        {(() => {
          const soonDeals = activeDeals.filter((d) => {
            if (isTestTitle(d.title)) return false; // [테스트] 매물 제외 (커밋 K)
            const remainMs = new Date(d.closes_at).getTime() - new Date().getTime();
            return remainMs > 0 && remainMs <= 6 * 60 * 60 * 1000;
          }).length;
          const actions = [
            { label: "미연락 리드", value: metrics?.counts?.uncontactedLeads ?? interests.filter((i) => !i.contacted).length, urgent: true, go: () => { setLeadFilter("uncontacted"); jumpToSection("leads", () => setLeadsOpen(true)); } },
            // 2026-10-04 F-4: 24시간 단계 변화 없는 거래 연결 (거래 연결 카드가 불러온 값)
            { label: "멈춘 연결", value: connCounts.stuck, urgent: true, go: () => jumpToSection("connections", () => setConnectionsOpen(true)) },
            { label: "마감임박(6h)", value: soonDeals, urgent: true, go: () => jumpToSection("active-deals") },
            { label: "대기 판매신청", value: metrics?.counts?.pendingSellerRequests ?? requests.length, urgent: false, go: () => jumpToSection("pending-sellers", () => setSellerReqOpen(true)) },
            { label: "재고문의 미연락", value: metrics?.counts?.uncontactedBuyRequests ?? buyRequests.filter((b) => !b.contacted).length, urgent: false, go: () => jumpToSection("buy-requests", () => setBuyReqOpen(true)) },
          ];
          const hot = actions.filter((a) => a.value > 0);
          const cold = actions.filter((a) => a.value === 0);
          return (
            <section aria-label="조치 필요">
              <h2 style={UI_SECTION}>⚡ 조치 필요</h2>
              {hot.length > 0 && (
                <div className={`mt-2.5 grid gap-2 ${isDesktop ? "grid-cols-5" : "grid-cols-2"}`}>
                  {hot.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.go}
                      className="rounded-2xl text-left"
                      style={{ padding: "14px 14px 12px", background: a.urgent ? "#FDECEC" : "#FDEEE8", border: `1px solid ${a.urgent ? "#F5B5B5" : "#F5C4A8"}` }}
                    >
                      <div style={{ ...BIG_NUM, color: a.urgent ? "#DC2626" : "#C2410C" }}>{a.value}</div>
                      <div className="font-bold mt-0.5" style={{ fontSize: rem(14), color: a.urgent ? "#B91C1C" : "#C2410C" }}>{a.label}</div>
                      <div className="mt-2" style={{ ...UI_LINK, color: a.urgent ? "#B91C1C" : "#C2410C" }}>바로 처리 →</div>
                    </button>
                  ))}
                </div>
              )}
              {cold.length > 0 && (
                <p className="mt-2" style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
                  {hot.length === 0 ? "✓ 지금 처리할 일이 없어요 · " : ""}
                  {cold.map((a) => `${a.label} 0`).join(" · ")}
                </p>
              )}
            </section>
          );
        })()}

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
                sub: quotesWaitlist === null ? undefined : `받은 견적 ${quotesWaitlist.receiver} / 보낸 견적 ${quotesWaitlist.sender}`,
                wide: true,
              },
            ].map((stat) => (
              <div key={stat.label} className={`${CARD} ${stat.wide && !isDesktop ? "col-span-2" : ""}`} style={{ padding: "12px 14px" }}>
                <div style={{ ...BIG_NUM, color: "#0B2540" }}>{stat.value}</div>
                <div className="mt-0.5 font-bold" style={LABEL}>{stat.label}</div>
                {stat.sub && <div style={LABEL}>{stat.sub}</div>}
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
                  {kpiDaily.map((r) => (
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
        </section>

        <section aria-label="카테고리별 현황">
          <h2 style={UI_SECTION}>카테고리별 현황 <span style={{ ...LABEL, fontWeight: 400 }}>(액티브 = 최근 7일)</span></h2>
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
                  <span className="text-right" style={{ color: c.completionRate == null ? "#9AA3AD" : "#0B2540" }}>{c.completionRate == null ? "—" : `${c.completionRate}%`}</span>
                  <span className="text-right">{c.activeSuppliers}</span>
                  <span className="text-right">{c.activeDemanders}</span>
                </div>
              ));
            })()}
            {categoryKpis.every((c) => c.leads === 0 && c.activeSuppliers === 0 && c.activeDemanders === 0) && (
              <div className="text-center" style={{ ...LABEL, padding: "16px 12px" }}>아직 데이터가 없어요.</div>
            )}
          </div>
        </section>
      </div>

      {/* 2026-09-26 (4): PC에서도 그냥 한 열로 쭉 늘어놓기만 해서 여전히 스크롤이
          길다는 피드백 — 리드/진행중매물/판매자신청/점핑파트너신청/재고찾습니다/
          최근가입회원 6개 섹션을 3열 패널 그리드로 묶고, 패널마다 내부 스크롤을
          줘서 전체 대시보드가 한 화면에 가깝게 들어오도록 함. 모바일에서는
          display:contents로 그리드를 무효화해 기존 구조 그대로 유지 — "+ 새 매물
          직접 등록" 버튼은 DOM 위치(모바일 순서)는 그대로 두고 desktop에서만
          order:-1로 그리드 맨 앞 전체 폭 줄로 끌어올림. */}
      {/* 2026-10-03 PR-D: 매물 등록 폼 자리(newDealBlock)를 PC·모바일 보기에서 같은 트리 위치에 둠 — 보기 전환해도 폼이 다시 마운트되지 않아
          작성 중 내용·업로드 상태 유지. 모바일 보기에선 바깥 틀이 display:contents라 예전 세로 순서 그대로 */}
      <div className={isDesktop ? "px-8 pb-6 max-w-[1200px] mx-auto w-full" : "contents"}>
        {!isDesktop && membersBlock}
        {!isDesktop && leadsBlock}
        {!isDesktop && connectionsBlock}
        <div className={isDesktop ? "mb-4" : "contents"}>{newDealBlock}</div>
        {isDesktop ? (
          <div className="columns-3 gap-4">
            {[
              { key: "leads", title: "관심 표시한 회원", count: interests.length, node: leadsBlock },
              { key: "connections", title: "거래 연결", count: connCounts.open + connCounts.closed === 0 ? 0 : -1, node: connectionsBlock },
              { key: "business-check", title: "사업자 조회", count: -1, node: bizCheckBlock },
              { key: "pending-sellers", title: "대기 중인 판매자 신청", count: requests.length, node: pendingSellersBlock },
              { key: "active-deals", title: "진행 중인 매물", count: activeDeals.length, node: activeDealsBlock },
              { key: "partner-requests", title: "🏅 공식 점핑파트너 신청", count: partnerRequests.length, node: partnerReqBlock },
              { key: "partners-overview", title: "📊 점핑파트너 실적", count: partnersOverview.length, node: partnersOverviewBlock },
              { key: "buy-requests", title: "🔍 이런 재고 찾습니다", count: buyRequests.length, node: buyRequestsBlock },
              { key: "members", title: "최근 가입 회원", count: members.length, node: membersBlock },
              { key: "admins", title: "관리자 목록", count: -1, node: adminsBlock },
            ]
              .filter((c) => c.node)
              .map((c) => (
                <div key={c.key} className="break-inside-avoid mb-4">
                  {c.count === 0 ? (
                    <div className="bg-white border border-gray200 rounded-2xl flex items-center justify-between gap-2" style={{ padding: "12px 16px" }}>
                      <span {...CARD_TITLE_PROPS}>{c.title}</span>
                      <span style={LABEL}>없어요</span>
                    </div>
                  ) : (
                    c.node
                  )}
                </div>
              ))}
          </div>
        ) : (
          <>
            {activeDealsBlock}
            {bizCheckBlock}
            {pendingSellersBlock}
            {partnerReqBlock}
            {partnersOverviewBlock}
            {buyRequestsBlock}
            {adminsBlock}
          </>
        )}
      </div>

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
              {(["관리자", "최고관리자"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAppointRole(r)}
                  className="flex-1 text-sm font-bold rounded-xl py-3"
                  style={
                    appointRole === r
                      ? { background: "#0B2540", color: "#fff" }
                      : { background: "#F5F6F8", color: "#6B7480" }
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

// 2026-10-03 feat/admin-deal-edit: 진행 중 매물 수정 칸 공용
type EditWarnings = { title: string[]; description: string[]; price: string[] };
const NO_EDIT_WARNINGS: EditWarnings = { title: [], description: [], price: [] };
const EDIT_FIELDS: DealEditField[] = ["priceMode", "title", "dealPrice", "originalPrice", "minOrderQty", "expiryDate", "description", "closesAt"];
const DAY_MS = 24 * 3600 * 1000;
const nowMs = () => Date.now(); // 클릭 처리에서만 부름(렌더 중 호출 아님)

// ISO·ms → <input type="datetime-local"> 값(이 기기 시간대, 분까지)
function toLocalInput(v: string | number): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const editInputCls = (error?: boolean) =>
  `w-full min-w-0 border-2 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-orange bg-white ${error ? "border-[#DC2626]" : "border-gray200"}`;

function EditField({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="text-xs font-bold text-gray500 block mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs font-medium mt-1" style={{ color: BLOCK_COLOR }}>
          {error}
        </p>
      )}
    </div>
  );
}

function ActiveDealCard({
  deal,
  adminKey,
  onChanged,
  canDelete,
  onGoBizCheck,
  onClosed,
}: {
  deal: ActiveDeal;
  adminKey: string;
  onChanged: () => void;
  canDelete: boolean; // 2026-10-01: 영구 삭제 버튼은 최고관리자에게만 (서버도 최고관리자만 허용)
  onGoBizCheck: () => void; // "사업자 조회 바로가기" — 사업자 조회 섹션으로 이동(판매 신청 선택 안 함)
  onClosed: (title: string) => void; // 마감 성공 안내는 대시보드에서(카드는 목록에서 빠짐)
}) {
  const [expanded, setExpanded] = useState(false);
  const [remainingQty, setRemainingQty] = useState(String(deal.remaining_qty));
  const [saving, setSaving] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [images, setImages] = useState<string[]>(deal.images ?? []);
  const [editingVideo, setEditingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(deal.video_url ?? null);
  // 2026-10-02 PR-A2: 영상 올리는 중엔 저장 막고, 안 올라간 채 저장하면 시트로 확인
  const [videoStatus, setVideoStatus] = useState<VideoUploadStatus>(deal.video_url ? "done" : "idle");
  const [videoSheet, setVideoSheet] = useState(false);
  const videoUploaderRef = useRef<VideoUploaderHandle>(null);
  // 2026-10-02 PR-B: 새 사진 올리는 중엔 저장 막고, 실패한 새 사진이 있으면 시트로 확인. [빼고 저장]은 실패한 새 사진만 빼고 기존 사진(deal.images)은 그대로
  const [photoStatus, setPhotoStatus] = useState<ImageUploadStatus>({ uploading: 0, failed: 0 });
  const [photoSheet, setPhotoSheet] = useState(false);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
  const busyLabel = uploadingLabel(photoStatus.uploading > 0, videoStatus === "uploading");
  // 2026-09-30: 판매자 표시 수정 — 지금 값에서 시작 (예전 임의 이름·"비공개 판매자"는 비공개)
  const initialSellerName = publicSellerName(deal);
  const [seller, setSeller] = useState({ isPublic: initialSellerName !== null, companyName: initialSellerName ?? "" });
  const sellerChanged =
    seller.isPublic !== (initialSellerName !== null) || (seller.isPublic && seller.companyName.trim() !== (initialSellerName ?? ""));
  const [deleting, setDeleting] = useState(false);
  const { message: toastMessage, showToast } = useToast();

  // 2026-10-03 feat/admin-deal-edit: 매물 내용·마감 일시 수정 — 바꾼 칸만 보내고, 검증은 서버와 같은 src/lib/dealEdit.ts.
  // 저장은 기존 "변경사항 저장" 한 번으로. 수정·연장은 알림을 다시 보내지 않음.
  const editCurrent = {
    title: deal.title,
    deal_price: deal.deal_price,
    price_mode: deal.price_mode ?? "fixed",
    original_price: deal.original_price ?? null,
    total_qty: deal.total_qty,
    price_unit: deal.price_unit ?? null,
    stock_type: deal.stock_type ?? null,
    expiry_date: deal.expiry_date ?? null,
    description: deal.description ?? null,
    closes_at: deal.closes_at,
  };
  // 정상가 없이 등록하면 original_price = 판매가로 저장됨 → 칸은 비워서 보여줌
  const initialOrig = deal.original_price && deal.original_price !== deal.deal_price ? String(deal.original_price) : "";
  const initialMoq = deal.min_order_qty ? String(deal.min_order_qty) : "";
  const initialPriceMode: PriceMode = deal.price_mode === "negotiable" ? "negotiable" : "fixed";
  const [priceMode, setPriceModeRaw] = useState<PriceMode>(initialPriceMode); // 2026-10-04 가격 방식 전환(가격 입력 ↔ 가격 협의)
  const initialExpiry = deal.expiry_date?.slice(0, 10) ?? "";
  const [form, setForm] = useState(() => ({
    title: deal.title,
    dealPrice: deal.deal_price != null ? String(deal.deal_price) : "",
    originalPrice: initialOrig,
    minOrderQty: initialMoq,
    expiryDate: initialExpiry,
    description: deal.description ?? "",
    closesAt: toLocalInput(deal.closes_at),
  }));
  const [editError, setEditError] = useState<{ field: DealEditField; error: string } | null>(null);
  const [editWarns, setEditWarns] = useState<EditWarnings>(NO_EDIT_WARNINGS);
  const confirmedRef = useRef(false); // 주황 경고를 "그대로 저장"으로 확인함 — 칸을 다시 고치면 풀림
  const lumpSum = isLumpSum(deal.price_unit);
  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setEditError(null);
    setEditWarns(NO_EDIT_WARNINGS);
    confirmedRef.current = false;
  };
  const setPriceMode = (m: PriceMode) => {
    setPriceModeRaw(m);
    setEditError(null);
    setEditWarns(NO_EDIT_WARNINGS);
    confirmedRef.current = false;
  };
  const fieldError = (f: DealEditField) => (editError?.field === f ? editError.error : undefined);
  const buildEdit = (): DealEditInput => {
    const e: DealEditInput = {};
    if (normalizeTitle(form.title, { admin: true }) !== deal.title) e.title = form.title;
    if (priceMode !== initialPriceMode) e.priceMode = priceMode;
    if (priceMode === "fixed") {
      // 가격 협의 → 가격 입력으로 바꾸면 가격이 없던 매물이라 판매가를 꼭 보냄(서버·validateDealEdit도 같은 규칙)
      const dealPrice = parsePriceInput(form.dealPrice) ?? null;
      if (initialPriceMode === "negotiable" || dealPrice !== deal.deal_price || form.originalPrice !== initialOrig) {
        e.dealPrice = dealPrice;
        e.originalPrice = parsePriceInput(form.originalPrice) ?? null;
      }
    }
    if (!lumpSum && form.minOrderQty !== initialMoq) e.minOrderQty = form.minOrderQty.trim() ? Number(form.minOrderQty) : null;
    if (form.expiryDate !== initialExpiry) e.expiryDate = form.expiryDate || null;
    if (form.description !== (deal.description ?? "")) e.description = form.description || null;
    if (form.closesAt !== toLocalInput(deal.closes_at)) {
      const t = Date.parse(form.closesAt);
      e.closesAt = Number.isNaN(t) ? "" : new Date(t).toISOString();
    }
    return e;
  };
  // 마감 빠른 버튼 — 지금 칸 값(비었거나 지난 시각이면 지금)에서 n일 뒤. 저장해야 반영
  const addDays = (n: number) => {
    const t = Date.parse(form.closesAt);
    const base = Math.max(Number.isNaN(t) ? Date.parse(deal.closes_at) : t, nowMs());
    setField("closesAt", toLocalInput(base + n * DAY_MS));
  };

  // 2026-09-26: 재고 저장 / 사진 저장 버튼이 따로 있어서 "이걸 왜 두 번 눌러야
  // 하냐"는 피드백 — 재고·사진·영상을 한 번에 PATCH하는 단일 저장 버튼으로
  // 통합. 저장 성공 시 토스트로 알리고, 열려 있던 사진/영상 관리 패널은
  // 접어서 리스트 카드 형태로 되돌아가게 함.
  // 2026-09-26 (2): "진행 중인 매물"이 항상 펼쳐진 카드라 목록이 길고 눈에
  // 잘 안 들어온다는 피드백 — 기본은 요약 한 줄 + [수정]/[삭제] 리스트 행,
  // [수정] 클릭 시에만 아래 편집 UI가 펼쳐지는 아코디언으로 전환. 저장
  // 성공 시 리스트 행으로 자동 접힘.
  // 성공 여부를 반환 — 토스트가 실패(세션 만료 401, 서버 500, 네트워크 오류)를
  // "저장했어요"로 잘못 안내하지 않도록 응답 상태를 확인함.
  // 2026-10-02 PR-A: 실패하면 서버가 준 이유(error·field)도 돌려줌 — 영상 주소 검사 실패(field "video")는 그 이유를 토스트로
  const patch = async (
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; error?: string; field?: string; warnings?: EditWarnings }> => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/deals/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ id: deal.id, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          ok: false,
          error: typeof data.error === "string" ? data.error : undefined,
          field: data.field,
          warnings: res.status === 422 && data.needsConfirm ? { ...NO_EDIT_WARNINGS, ...data.warnings } : undefined,
        };
      }
      onChanged();
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      setSaving(false);
    }
  };

  // skipVideo: 새 영상이 안 올라간 채 저장 — skipVideoUrl(기존 영상 유지면 그 URL, 아니면 null)로 저장
  const saveAll = async (skipVideo = false, skipVideoUrl: string | null = null, skipPhotos = false, confirmWarnings = confirmedRef.current) => {
    if (busyLabel) return;
    const edit = buildEdit();
    const invalid = validateDealEdit(edit, editCurrent);
    if (invalid) {
      setEditError(invalid);
      showToast("빨간 안내가 있는 칸을 확인해주세요");
      return;
    }
    if (!confirmWarnings) {
      const w = dealEditWarnings(edit, editCurrent);
      if (w.title.length || w.description.length || w.price.length) {
        setEditWarns(w);
        return;
      }
    }
    if (
      priceMode === "fixed" &&
      edit.dealPrice != null &&
      edit.originalPrice &&
      edit.dealPrice >= edit.originalPrice &&
      !window.confirm("판매가가 정상가보다 높거나 같아요. 할인율이 표시되지 않아요. 그대로 저장할까요?")
    ) {
      return;
    }
    if (!skipPhotos && photoStatus.failed > 0) {
      setPhotoSheet(true);
      return;
    }
    if (!skipVideo && videoNotUploaded(videoStatus)) {
      setVideoSheet(true);
      return;
    }
    const sellerPatch = sellerChanged ? { sellerPublic: seller.isPublic, sellerCompanyName: seller.companyName } : {};
    const result = await patch({
      ...edit,
      confirmWarnings: confirmWarnings || undefined,
      remainingQty: Number(remainingQty),
      images,
      videoUrl: skipVideo ? skipVideoUrl : videoUrl,
      ...sellerPatch,
    });
    if (!result.ok) {
      if (result.warnings) {
        setEditWarns(result.warnings); // 서버만 아는 경고(같은 이름 진행 중 매물)
        return;
      }
      if (result.field && EDIT_FIELDS.includes(result.field as DealEditField) && result.error) {
        setEditError({ field: result.field as DealEditField, error: result.error });
        showToast(result.error);
        return;
      }
      showToast(result.field === "video" && result.error ? result.error : "저장하지 못했어요. 다시 시도해주세요");
      return;
    }
    confirmedRef.current = false;
    setEditWarns(NO_EDIT_WARNINGS);
    setEditingPhotos(false);
    setEditingVideo(false);
    setExpanded(false);
    showToast("저장했어요");
  };

  // 2026-10-01: 마감 — 확인 후 status closed(manage PATCH 허용값). 서버가 감사 로그(deal_close) 기록
  const closeDeal = async () => {
    if (!confirm(`"${deal.title}" 매물을 지금 마감할까요? 진행 중 목록에서 빠지고 매물 상세에는 "마감됨"으로 보여요.`)) return;
    if ((await patch({ status: "closed" })).ok) onClosed(deal.title);
    else showToast("마감하지 못했어요. 다시 시도해주세요");
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

  const confirmAndSave = () => {
    confirmedRef.current = true;
    saveAll(false, null, false, true);
  };
  const [minClosesLocal] = useState(() => toLocalInput(Date.now())); // 달력에서 지난 시각 흐리게(서버도 지금 이후만 허용)
  const idp = `deal-edit-${deal.id}`;
  const expiryForLimit = form.expiryDate || null;

  return (
    <div className="bg-white border border-gray200 rounded-2xl px-4 py-4">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray500">
          <span>{categoryIcons[deal.categories?.name ?? ""] ?? "🗂️"}</span>
          {deal.categories?.name} · {deal.regions?.name}
        </div>
        {/* 2026-09-27: "관심 표시한 회원" 섹션이 전역 리스트라 어떤 매물이 뜨거운지
            한눈에 안 보였음 — deals.interest_count(이미 트리거로 실시간 유지되는
            비정규화 카운터, 별도 조회 불필요)를 매물 관리 행에도 바로 노출.
            2026-09-28: 총합만 보이면 회원/비회원 비중을 알 수 없어 quick_lead_count를
            추가로 빼서 회원(interest_count - quick_lead_count) · 비회원(quick_lead_count)
            브레이크다운을 타이틀 툴팁으로 제공. */}
        {(deal.interest_count ?? 0) > 0 && (
          <span
            className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#FFF0E8", color: "#E25100" }}
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

      {!expanded ? (
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
              onClick={deleteDeal}
              disabled={deleting}
              className="flex-1 text-xs font-bold rounded-lg py-2 disabled:opacity-50"
              style={{ color: "#C2410C", border: "2px solid #FDEEE8", background: "#FFF9F7" }}
            >
              {deleting ? "삭제 중..." : "🗑️ 삭제"}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 2026-10-03 feat/admin-deal-edit: 매물 내용 수정 — 카테고리·사진 순서·판매자 정보(아래 따로)는 여기서 안 바꿈 */}
          <div className="flex flex-col gap-2.5 mt-3">
            <EditField label="매물명" htmlFor={`${idp}-title`} error={fieldError("title")}>
              <input
                id={`${idp}-title`}
                type="text"
                className={editInputCls(!!fieldError("title"))}
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
              />
              <ConfirmWarnings warnings={editWarns.title} onConfirm={confirmAndSave} busy={saving} />
            </EditField>
            <div className="flex gap-2" role="radiogroup" aria-label="가격 방식">
              {(["fixed", "negotiable"] as const).map((m) => (
                <label
                  key={m}
                  className="flex-1 flex items-center gap-2 rounded-lg cursor-pointer"
                  style={{ border: `2px solid ${priceMode === m ? "#0B2540" : "#E4E7EB"}`, padding: "6px 10px", background: "#fff" }}
                >
                  <input type="radio" name={`${idp}-priceMode`} className="w-4 h-4 accent-navy flex-shrink-0" checked={priceMode === m} onChange={() => setPriceMode(m)} />
                  <span className="text-sm font-bold text-navy">{m === "fixed" ? "가격 입력" : "가격 협의"}</span>
                </label>
              ))}
            </div>
            {fieldError("priceMode") && <p className="text-xs font-medium" style={{ color: BLOCK_COLOR }}>{fieldError("priceMode")}</p>}
            <div className="grid grid-cols-2 gap-2">
              <EditField label="판매가(원)" htmlFor={`${idp}-dealPrice`} error={fieldError("dealPrice")}>
                <input
                  id={`${idp}-dealPrice`}
                  type="text"
                  inputMode="numeric"
                  className={editInputCls(!!fieldError("dealPrice"))}
                  disabled={priceMode === "negotiable"}
                  placeholder={priceMode === "negotiable" ? "가격 협의" : undefined}
                  value={priceMode === "negotiable" ? "" : formatPriceInput(form.dealPrice)}
                  onChange={(e) => setField("dealPrice", e.target.value)}
                />
              </EditField>
              <EditField label="정상가(원, 선택)" htmlFor={`${idp}-originalPrice`} error={fieldError("originalPrice")}>
                <input
                  id={`${idp}-originalPrice`}
                  type="text"
                  inputMode="numeric"
                  placeholder="없음"
                  className={editInputCls(!!fieldError("originalPrice"))}
                  disabled={priceMode === "negotiable"}
                  value={priceMode === "negotiable" ? "" : formatPriceInput(form.originalPrice)}
                  onChange={(e) => setField("originalPrice", e.target.value)}
                />
              </EditField>
            </div>
            <ConfirmWarnings warnings={editWarns.price} onConfirm={editWarns.title.length ? undefined : confirmAndSave} busy={saving} />
            <div className="grid grid-cols-2 gap-2">
              {/* 일괄(전체 가격) 매물은 최소주문 없음 */}
              {!lumpSum && (
                <EditField label={`최소 주문량(MOQ, ${deal.quantity_unit || "개"})`} htmlFor={`${idp}-minOrderQty`} error={fieldError("minOrderQty")}>
                  <input
                    id={`${idp}-minOrderQty`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="없음"
                    onWheel={(e) => e.currentTarget.blur()} // 휠로 값 바뀜 방지 (재고 칸과 같음)
                    className={editInputCls(!!fieldError("minOrderQty"))}
                    value={form.minOrderQty}
                    onChange={(e) => setField("minOrderQty", e.target.value)}
                  />
                </EditField>
              )}
              <EditField label={deal.stock_type === "near_expiry" ? "소비기한(필수)" : "소비기한"} htmlFor={`${idp}-expiryDate`} error={fieldError("expiryDate")}>
                <input
                  id={`${idp}-expiryDate`}
                  type="date"
                  className={editInputCls(!!fieldError("expiryDate"))}
                  value={form.expiryDate}
                  onChange={(e) => setField("expiryDate", e.target.value)}
                />
              </EditField>
            </div>
            <EditField label="추가 설명" htmlFor={`${idp}-description`} error={fieldError("description")}>
              <textarea
                id={`${idp}-description`}
                rows={3}
                className={editInputCls(!!fieldError("description"))}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
              <ConfirmWarnings
                warnings={editWarns.description}
                onConfirm={editWarns.title.length || editWarns.price.length ? undefined : confirmAndSave}
                busy={saving}
              />
            </EditField>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <label className="text-xs font-bold text-gray500">재고</label>
            <input
              type="number"
              inputMode="numeric"
              className="w-20 border-2 border-gray200 rounded-lg px-2 py-1.5 text-sm"
              // 2026-10-02 (PR-C1): 포커스된 number 칸 위에서 휠을 굴리면 값이 바뀜 → 휠 시 포커스 해제
              onWheel={(e) => e.currentTarget.blur()}
              value={remainingQty}
              onChange={(e) => setRemainingQty(e.target.value)}
            />
            <span className="text-xs text-gray500">/ {deal.total_qty}{deal.quantity_unit || "개"}</span>
          </div>

          {/* 2026-10-03 feat/admin-deal-edit: [+24시간 연장](바로 저장) → [+1일][+7일][+30일] + 날짜·시간 직접 지정, "변경사항 저장"으로 반영.
              소비기한이 있으면 그날 23:59까지만(서버도 같은 검사) */}
          <div className="mt-2.5">
            <EditField label="마감 일시" htmlFor={`${idp}-closesAt`} error={fieldError("closesAt")}>
              <div className="flex gap-1.5">
                {[1, 7, 30].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => addDays(n)}
                    className="flex-1 text-xs font-bold text-navy border-2 border-gray200 rounded-lg py-2"
                  >
                    +{n}일
                  </button>
                ))}
              </div>
              <input
                id={`${idp}-closesAt`}
                type="datetime-local"
                className={`${editInputCls(!!fieldError("closesAt"))} mt-1.5`}
                value={form.closesAt}
                min={minClosesLocal}
                max={expiryForLimit ? `${expiryForLimit}T23:59` : undefined}
                onChange={(e) => setField("closesAt", e.target.value)}
              />
            </EditField>
            <p className="text-xs text-gray500 mt-1">
              {expiryForLimit ? `소비기한(${expiryForLimit.replace(/-/g, ".")}) 23:59까지 정할 수 있어요 · ` : ""}
              &quot;변경사항 저장&quot;을 눌러야 반영돼요 · 알림은 다시 보내지 않아요
            </p>
          </div>

          <div className="flex gap-2 mt-2.5">
            <button
              onClick={closeDeal}
              disabled={saving}
              className="flex-1 text-xs font-bold text-orange border-2 border-orange rounded-lg py-2"
            >
              조기 마감
            </button>
          </div>

          <button
            type="button"
            onClick={() => setEditingPhotos((v) => !v)}
            className="w-full text-xs font-bold text-navy border-2 border-gray200 rounded-lg py-2 mt-2"
          >
            {editingPhotos ? "사진 관리 닫기" : `📷 사진 관리 (${images.length}장)`}
          </button>

          {/* 2026-10-02 PR-B: 닫아도 업로드·실패 상태가 이어지게 숨기기만(예전엔 닫으면 업로더가 사라져 올리던 사진이 조용히 빠짐) — 영상 관리와 같은 방식 */}
          <div className="mt-2.5" hidden={!editingPhotos}>
              <ImageUploader
                ref={imageUploaderRef}
                adminKey={adminKey}
                initialUrls={images}
                onChange={setImages}
                onStatusChange={setPhotoStatus}
                max={MAX_PHOTO_SLOTS}
                label="매물 사진"
                hint="탭해서 사진 추가 · × 로 삭제 후 아래 '변경사항 저장'으로 반영"
              />
          </div>

          {/* 2026-09-26: 영상은 등록 시(DealForm)에만 넣을 수 있고 이후엔 있는지
              없는지조차 알 방법이 없었음 — 사진 관리와 동일한 토글 패턴으로 추가,
              버튼 라벨 자체가 "있음/없음"을 보여줘서 펼치지 않아도 첨부 여부를
              알 수 있게 함. */}
          <button
            type="button"
            onClick={() => setEditingVideo((v) => !v)}
            className="w-full text-xs font-bold text-navy border-2 border-gray200 rounded-lg py-2 mt-2"
          >
            {editingVideo ? "영상 관리 닫기" : `🎥 영상 관리 (${videoUrl ? "있음" : "없음"})`}
          </button>

          {/* 2026-10-02 PR-A2: 닫아도 업로드 상태가 이어지게 숨기기만(예전엔 닫으면 업로더가 사라짐) */}
          <div className="mt-2.5" hidden={!editingVideo}>
            <VideoUploader
              ref={videoUploaderRef}
              adminKey={adminKey}
              initialUrl={videoUrl}
              onChange={setVideoUrl}
              onStatusChange={setVideoStatus}
              label="매물 영상"
              hint="최대 15초 · 탭해서 교체, 아래 '변경사항 저장'으로 반영"
            />
          </div>

          <div className="mt-3">
            <SellerDisplayPicker idPrefix={`deal-${deal.id}`} isPublic={seller.isPublic} companyName={seller.companyName} onChange={setSeller} />
          </div>

          {/* 2026-10-04: 실제 판매자(내부 전용) — 구매자에게 보이지 않음. 매물 내용 저장과 별개로 저장(알림 재발송 없음) */}
          <DealSellerPrivateEditor adminKey={adminKey} dealId={deal.id} onToast={showToast} onGoBizCheck={onGoBizCheck} />

          <button
            onClick={() => saveAll()}
            disabled={saving || busyLabel !== null}
            className="w-full text-sm font-bold text-white bg-navy rounded-lg py-2.5 mt-3 disabled:opacity-50"
          >
            {saving ? "저장 중..." : busyLabel ?? "변경사항 저장"}
          </button>
          <VideoNotUploadedSheet
            open={photoSheet}
            title={`새 사진 ${photoStatus.failed}장이 올라가지 않았어요`}
            description="기존 사진은 그대로 있어요. 올라가지 않은 새 사진을 다시 올려보거나, 그 사진만 빼고 저장해주세요."
            reselectLabel="다시 시도"
            skipLabel="빼고 저장"
            onClose={() => setPhotoSheet(false)}
            onReselect={() => {
              setEditingPhotos(true);
              imageUploaderRef.current?.retryFailed();
              setPhotoSheet(false);
            }}
            onSkip={() => {
              setPhotoSheet(false);
              imageUploaderRef.current?.removeFailed();
              saveAll(false, null, true);
            }}
          />
          {/* 2026-10-02 PR-A2: 기존 영상이 있는 매물에서 새 영상이 안 올라갔으면 기존 영상을 지키고 저장(예전엔 ×로 비운 뒤라 null로 지워짐).
              기존 영상을 지우는 건 ×로 비우고(새 영상 고르지 않은 채) 저장할 때만 — 그때는 이 시트가 안 뜨고 null 저장 */}
          <VideoNotUploadedSheet
            open={videoSheet}
            skipLabel={deal.video_url ? "기존 영상 유지하고 저장" : "영상 빼고 저장"}
            description={
              deal.video_url
                ? "새로 고른 영상이 저장되지 않았어요. 기존 영상을 그대로 두고 저장하거나, 영상을 다시 골라주세요."
                : undefined
            }
            onClose={() => setVideoSheet(false)}
            onReselect={() => {
              setEditingVideo(true);
              videoUploaderRef.current?.reselect();
              setVideoSheet(false);
            }}
            onSkip={() => {
              setVideoSheet(false);
              const keep = deal.video_url ?? null;
              if (keep) setVideoUrl(keep); // 다음에 펼칠 때도 기존 영상으로 시작
              else videoUploaderRef.current?.clear();
              saveAll(true, keep);
            }}
          />

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

      <Toast message={toastMessage} />
    </div>
  );
}

function DealForm({
  adminKey,
  prefill,
  requestId,
  onDone,
  wide = false,
  onDirtyChange,
  onGoBizCheck,
}: {
  adminKey: string;
  prefill?: {
    title?: string;
    category?: string;
    region?: string;
    dealPrice?: number;
    totalQty?: number;
    quantityUnit?: string;
    priceUnit?: string;
    minOrderQty?: number;
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
  const [title, setTitle] = useState(prefill?.title ?? "");
  // 재고 유형 — 판매신청 승인이면 신청서 값을 이어받음
  const [stockType, setStockType] = useState<StockType>(isStockType(prefill?.stockType) ? prefill!.stockType as StockType : "general");
  // prefill이 없으면 비워둬서 관리자가 직접 고르게 함 (예전엔 첫 항목이 미리 선택돼 있어
  // 카테고리·지역을 안 고르고 그대로 등록되는 실수가 가능했음)
  const [category, setCategory] = useState(prefill?.category ?? "");
  const [region, setRegion] = useState(prefill?.region ?? "");
  const [originalPrice, setOriginalPrice] = useState(prefill?.originalPrice ? String(prefill.originalPrice) : "");
  const [dealPrice, setDealPrice] = useState(prefill?.dealPrice ? String(prefill.dealPrice) : "");
  const [priceMode, setPriceMode] = useState<PriceMode>("fixed"); // 2026-10-04 가격 방식 — 가격 협의면 판매·정상 단가 없이 등록
  const [totalQty, setTotalQty] = useState(prefill?.totalQty ? String(prefill.totalQty) : "");
  const [quantityUnit, setQuantityUnit] = useState(prefill?.quantityUnit || quantityUnits[0]);
  // 2026-09-29: 단가 단위 — 신청서 값 이어받기, 없으면 수량 단위를 따라감(직접 고르면 유지). 정상가·판매가 공통
  const [priceUnit, setPriceUnit] = useState<string>(
    isDealPriceUnit(prefill?.priceUnit) ? prefill!.priceUnit! : prefill?.quantityUnit || quantityUnits[0]
  );
  const [priceUnitTouched, setPriceUnitTouched] = useState(isDealPriceUnit(prefill?.priceUnit));
  const lumpSum = isLumpSum(priceUnit);
  const [minOrderQty, setMinOrderQty] = useState(
    prefill?.minOrderQty ? String(prefill.minOrderQty) : ""
  );
  const [location, setLocation] = useState("");
  const [closesInHours, setClosesInHours] = useState(
    prefill?.closesInHours ? String(prefill.closesInHours) : "24"
  );
  const [images, setImages] = useState<string[]>(prefill?.images ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(prefill?.videoUrl ?? null);
  // 2026-10-02 PR-A2: 영상 올리는 중엔 등록 막고, 안 올라간 채 등록하면 시트로 확인
  const [videoStatus, setVideoStatus] = useState<VideoUploadStatus>(prefill?.videoUrl ? "done" : "idle");
  const [videoSheet, setVideoSheet] = useState<{ confirmWarnings: boolean } | null>(null);
  const videoUploaderRef = useRef<VideoUploaderHandle>(null);
  // 2026-10-02 PR-B: 사진도 같은 규칙 — 올리는 중엔 등록 막고, 실패한 사진이 있으면 시트로 확인(사진 → 영상 순서)
  const [photoStatus, setPhotoStatus] = useState<ImageUploadStatus>({ uploading: 0, failed: 0 });
  const [photoSheet, setPhotoSheet] = useState<{ confirmWarnings: boolean } | null>(null);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
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
  const [sellerPrivate, setSellerPrivate] = useState<SellerPrivateDraft>(EMPTY_SELLER_PRIVATE);
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
  const [openDeal, setOpenDeal] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openSeller, setOpenSeller] = useState(false);
  const focusField = (field: DealField | "description") => {
    if (field === "category") setOpenDeal(true); // 거래 조건
    if (field === "minOrderQty" || field === "expiryDate" || field === "description") setOpenDetail(true); // 제품 상세
    if (field === "sellerPrivateCompany" || field === "sellerPrivatePhone" || field === "sellerPrivateName" || field === "businessCheckId") setOpenSeller(true); // 판매자 정보
    setTimeout(() => {
      const el = document.getElementById(`deal-${field}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }, 30);
  };
  // 묶음 제목 "○개 입력됨" — 기본값(일반 재고·24시간)은 세지 않음
  const detailCount = [!lumpSum && minOrderQty, closesInHours !== "24", storageType, expiryDate, packageUnit, spec, origin, description].filter(Boolean).length;
  const dealCount = [category, stockType !== "general", pid, manifestItems.length > 0].filter(Boolean).length;
  // 재고 유형 "소비기한 임박"이면 소비기한(제품 상세)이 필수라 제품 상세를 펼쳐 둠
  useEffect(() => {
    if (stockType === "near_expiry") setOpenDetail(true);
  }, [stockType]);

  // 2026-10-03 PR-D: 입력 중 여부 — 첫 렌더 값과 비교(사진·영상 업로드 상태 포함)
  const snapshot = JSON.stringify([
    title, stockType, category, region, priceMode, originalPrice, dealPrice, totalQty, quantityUnit, priceUnit, minOrderQty, location,
    closesInHours, images, videoUrl, videoStatus, photoStatus, description, packageUnit, origin, spec, storageType, expiryDate,
    pid, manifestItems, seller, sellerPrivate,
  ]);
  const [initialSnapshot] = useState(snapshot);
  const dirty = snapshot !== initialSnapshot;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
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
    if (!category) errs.category = "카테고리를 선택해주세요.";
    if (!region) errs.region = "지역을 선택해주세요.";
    if (priceMode === "fixed") {
      if (!dealPrice.trim()) errs.dealPrice = "판매가를 입력해주세요.";
      else if (!deal || deal <= 0) errs.dealPrice = "판매가는 0보다 커야 해요.";
      if (originalPrice.trim() && (!orig || orig <= 0)) errs.originalPrice = "정상가는 0보다 커야 해요.";
    }
    if (!totalQty.trim()) errs.totalQty = "재고 총수량을 입력해주세요.";
    else if (!Number.isFinite(qty) || qty <= 0) errs.totalQty = "재고 총수량은 0보다 커야 해요.";
    if (!lumpSum && minOrderQty.trim() && !(Number(minOrderQty) > 0)) errs.minOrderQty = "최소 주문량은 0보다 커야 해요.";
    else if (!lumpSum && minOrderQty.trim() && qty > 0 && Number(minOrderQty) > qty) errs.minOrderQty = "최소주문량은 재고 총수량보다 클 수 없어요.";
    if (stockType === "near_expiry" && !expiryDate) errs.expiryDate = EXPIRY_REQUIRED_MESSAGE;
    if (!requestId) {
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
    setSubmitting(true);
    const closesAt = new Date(Date.now() + Number(closesInHours) * 3600 * 1000).toISOString();
    try {
      const res = await fetch("/api/admin/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
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
          images,
          videoUrl: skipVideo ? null : videoUrl,
          description,
          packageUnit: packageUnit || null,
          origin: origin || null,
          spec: spec || null,
          storageType: storageType || null,
          expiryDate: expiryDate || null,
          storageCondition: legacyStorage || null,
          pid: pid || null,
          manifestItems: manifestItems.length ? manifestItems : null,
          sellerPublic: seller.isPublic,
          sellerCompanyName: seller.companyName,
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
        setError(data.error ?? "등록에 실패했어요.");
        return;
      }
      const sent = data.push?.sentCount ?? 0;
      alert(
        data.push?.held
          ? "매물이 등록됐어요. 밤 9시~아침 8시라 알림은 아침 8시에 발송돼요."
          : `매물이 등록됐어요. 구독자 ${sent}명에게 알림을 발송했어요.`
      );
      onDone();
    } catch {
      setError("등록에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const groupCls = (field: DealField) =>
    `flex items-stretch w-full min-w-0 border-2 rounded-lg bg-white overflow-hidden focus-within:border-orange ${
      fieldErrors[field] ? "border-[#DC2626]" : "border-gray200"
    }`;
  const inputCls = (field?: DealField) =>
    `w-full min-w-0 border-2 rounded-lg px-3 py-2.5 text-[0.8889rem] outline-none focus:border-orange ${
      field && fieldErrors[field] ? "border-[#DC2626]" : "border-gray200"
    }`;

  return (
    // 2026-10-03 PR-D: PC 보기(wide)면 2단 — 왼쪽(필수 정보·접는 묶음 3개) / 오른쪽(사진·영상·안내·등록 버튼 sticky).
    // /sell(#45)과 같은 방식: 좁을 땐 두 열 틀이 display:contents라 바깥 세로 줄에 그대로 서고 order로 순서(① → 사진·영상 → 묶음 → 안내·버튼).
    // 틀 요소는 그대로 두고 클래스만 바뀌어서 "모바일 보기" ↔ PC 전환해도 업로드 중 상태가 유지됨
    <div
      className={
        wide
          ? "mt-3 bg-gray100 rounded-xl p-3.5 w-full grid grid-cols-[minmax(0,1fr)_clamp(360px,38%,420px)] gap-x-8 items-start"
          : "@container mt-3 bg-gray100 rounded-xl p-3.5 flex flex-col gap-3 w-full max-w-[720px] mx-auto"
      }
    >
      <div className={wide ? "@container flex flex-col gap-3 min-w-0" : "contents"}>
        <p className="text-[0.7778rem] text-gray500">
          <span className="text-orange font-bold">*</span> 필수 항목
        </p>
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
          <div className="flex flex-col gap-3">
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
                    }}
                  >
                    {DEAL_PRICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u === LUMP_SUM ? "일괄(전체)" : u}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>
                  목록에 &quot;{formatDealPrice(30000, quantityUnit, priceUnit)}&quot;처럼 보여요 · 창고 출고가(배송비 별도)
                </p>
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
                <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>판매 단가와 같은 단위로 적어주세요</p>
              </DealFormField>
              <div className="min-w-0 @min-[560px]:col-span-2" data-field="discount">
                <p className="font-bold mb-1" style={{ fontSize: rem(15), color: "#374151" }}>할인율</p>
                <DiscountHint original={parsePriceInput(originalPrice)} deal={parsePriceInput(dealPrice)} />
                {!(parsePriceInput(originalPrice) && parsePriceInput(dealPrice)) && (
                  <p className="text-gray500" style={{ fontSize: rem(14) }}>판매·정상 단가를 넣으면 보여요</p>
                )}
                <ConfirmWarnings warnings={priceWarns} onConfirm={titleWarnings.length ? undefined : () => submit(true)} busy={submitting} />
              </div>
            </div>
            )}

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
                <p className="mt-1 text-gray500" style={{ fontSize: rem(14) }}>
                  물건이 있는 곳(알림 매칭 기준)
                </p>
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

        <div className="order-3 flex flex-col gap-3">
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold whitespace-nowrap" style={{ fontSize: rem(15), color: "#0B2540" }}>{quantityUnit} 이상</span>
                  </div>
                </DealFormField>
                )}
                <DealFormField label="마감까지 남은 시간" htmlFor="deal-closesIn">
                  <select
                    id="deal-closesIn"
                    className={inputCls()}
                    value={closesInHours}
                    onChange={(e) => setClosesInHours(e.target.value)}
                  >
                    <option value="3">3시간</option>
                    <option value="12">12시간</option>
                    <option value="24">24시간</option>
                    <option value="72">3일</option>
                    <option value="168">7일</option>
                  </select>
                </DealFormField>
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
                  <SuggestInput id="deal-packageUnit" className={inputCls()} value={packageUnit} onChange={setPackageUnit} examples={PACKAGE_UNIT_EXAMPLES} placeholder="예: 5kg 박스" />
                </DealFormField>
                <DealFormField label="규격/사이즈" htmlFor="deal-spec">
                  <SuggestInput id="deal-spec" className={inputCls()} value={spec} onChange={setSpec} examples={SPEC_EXAMPLES} placeholder="예: 대 / 30cm" />
                </DealFormField>
                <DealFormField label="원산지" htmlFor="deal-origin">
                  <SuggestInput id="deal-origin" className={inputCls()} value={origin} onChange={setOrigin} examples={ORIGIN_EXAMPLES} placeholder="예: 국내산" />
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

          <FormAccordion id="deal-sec-seller" title="판매자 정보" count={(seller.isPublic ? 1 : 0) + (!requestId ? [sellerPrivate.company, sellerPrivate.phone, sellerPrivate.name, sellerPrivate.checkId].filter(Boolean).length : 0)} open={openSeller} onToggle={() => setOpenSeller((v) => !v)}>
            <SellerDisplayPicker idPrefix="deal-new" isPublic={seller.isPublic} companyName={seller.companyName} onChange={setSeller} />
            {!requestId && (
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
                />
              </div>
            )}
          </FormAccordion>
        </div>
      </div>

      {/* 오른쪽 — 행 높이만큼 늘어나고(self-stretch) 등록 버튼(+ 오류 문구)만 맨 아래에서 sticky. 관리자는 하단 탭바가 없어 아래 여백 12px */}
      <div className={wide ? "@container flex flex-col gap-4 min-w-0 self-stretch" : "contents"}>
        <section className="order-2">
          <FormSectionTitle hint="사진이 있으면 더 빨리 연결돼요">사진·영상</FormSectionTitle>
          <div className="flex flex-col gap-4">
            <div id="deal-photos">
            <ImageUploader
              ref={imageUploaderRef}
              adminKey={adminKey}
              onChange={setImages}
              onStatusChange={setPhotoStatus}
              label="매물 사진"
              // 2026-09-29: 판매신청은 추천 보너스로 최대 16장까지 올 수 있어 관리자 폼도 최대치로 (src/lib/photoLimit.ts)
              max={MAX_PHOTO_SLOTS}
              hint={`최대 ${MAX_PHOTO_SLOTS}장 (신청서에 첨부된 사진 포함)`}
              initialUrls={prefill?.images ?? []}
            />
            </div>
            <div id="deal-video">
              <VideoUploader
                ref={videoUploaderRef}
                adminKey={adminKey}
                onChange={setVideoUrl}
                initialUrl={prefill?.videoUrl}
                onStatusChange={setVideoStatus}
              />
            </div>
          </div>
        </section>

        <div className="order-4 flex flex-col gap-3">
          <p className="text-[0.7778rem] text-gray500">
            <span className="text-orange font-bold">*</span> 매물명·카테고리·지역·판매 단가·재고 총수량은 필수예요{stockType === "near_expiry" ? " (소비기한 임박이면 소비기한도)" : ""}.
          </p>
          <p className="text-gray500" style={{ fontSize: rem(14) }}>
            🌙 밤 9시~아침 8시 등록 매물은 아침 8시에 발송돼요.
          </p>
        </div>

        <div className={wide ? "order-5 mt-auto sticky bottom-0 z-10 bg-gray100 pt-2 pb-3 flex flex-col gap-2" : "order-5 flex flex-col gap-3"}>
          {error && <div className="text-[0.7778rem] font-medium" style={{ color: BLOCK_COLOR }}>{error}</div>}
          <button
            onClick={() => submit()}
            disabled={submitting || busyLabel !== null}
            className="text-white font-bold rounded-lg disabled:opacity-60"
            style={{ background: "#0B2540", padding: "12px 0", fontSize: rem(15) }}
          >
            {submitting ? "등록 중..." : busyLabel ?? "매물 등록 확정"}
          </button>
        </div>
      </div>
      <VideoNotUploadedSheet
        open={photoSheet !== null}
        title={`사진 ${photoStatus.failed}장이 올라가지 않았어요`}
        description={PHOTO_FAILED_DESCRIPTION}
        reselectLabel="다시 시도"
        skipLabel="빼고 등록"
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
        onSkip={() => {
          const confirmWarnings = videoSheet?.confirmWarnings ?? false;
          videoUploaderRef.current?.clear();
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
    dealPrice: r.hope_price ?? undefined,
    originalPrice: r.original_price ?? undefined,
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

type DealField = "title" | "category" | "region" | "originalPrice" | "dealPrice" | "totalQty" | "minOrderQty" | "expiryDate" | "sellerPrivateCompany" | "sellerPrivatePhone" | "sellerPrivateName" | "businessCheckId";
// 화면 위→아래 순서 (첫 누락 칸 포커스용) — 2026-10-01 2차: ① 매물명·판매/정상 단가·재고 총수량·지역 → 제품 상세(MOQ·소비기한) → 거래 조건(카테고리)
const DEAL_FIELD_ORDER: DealField[] = ["title", "dealPrice", "originalPrice", "totalQty", "region", "minOrderQty", "expiryDate", "category", "sellerPrivateCompany", "sellerPrivatePhone", "sellerPrivateName", "businessCheckId"];

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
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
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
        <FieldLabel need="optional">지역</FieldLabel>
        <select className="w-full border-2 border-gray200 rounded-xl px-3.5 outline-none focus:border-navy bg-white" style={{ height: 52, fontSize: FORM_INPUT_FONT_SIZE }} value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">전국 (지역 무관)</option>
          {mockRegions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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

      <ImageUploader ref={imageUploaderRef} adminKey={adminKey} onChange={setImages} onStatusChange={setPhotoStatus} max={MAX_PHOTO_SLOTS} label="사진" hint={`부동산·설비 현장 사진, 최대 ${MAX_PHOTO_SLOTS}장`} />

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
