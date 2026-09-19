"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { mockCategories, mockRegions, categoryIcons, quantityUnits } from "@/lib/mockData";
import ImageUploader from "@/components/ImageUploader";
import VideoUploader from "@/components/VideoUploader";
import { formatPriceInput, parsePriceInput, formatMemberNo } from "@/lib/format";

type SellerRequest = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string;
  product_name: string;
  quantity: number;
  quantity_unit: string | null;
  min_order_qty: number | null;
  hope_price: number | null;
  hope_duration_hours: number | null;
  description: string | null;
  package_unit: string | null;
  origin: string | null;
  spec: string | null;
  storage_condition: string | null;
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

type ActiveDeal = {
  id: string;
  title: string;
  deal_price: number;
  total_qty: number;
  remaining_qty: number;
  closes_at: string;
  created_at: string;
  categories: { name: string } | null;
  regions: { name: string } | null;
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
          const s = String(cell ?? "");
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

const ADMIN_SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

export default function AdminPage() {
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
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
        body: JSON.stringify({ password: input }),
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
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="text-2xl mb-4">🔒</div>
        <h1 className="font-display text-xl text-navy mb-4">관리자 로그인</h1>
        <input
          type="password"
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
  deals: { id: string; title: string; deal_price: number } | null;
  members: {
    phone: string;
    is_business: boolean;
    member_no: number | null;
    business_verified: boolean;
  } | null;
  phone?: string; // quick_leads(비회원 원클릭 리드)는 members 없이 전화번호만 가짐
  source: "member" | "quick";
};

type BuyRequest = {
  id: string;
  product_name: string;
  quantity: string | null;
  hope_price: number | null;
  contact_phone: string;
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
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [activeDeals, setActiveDeals] = useState<ActiveDeal[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFormFor, setOpenFormFor] = useState<string | "new" | null>(null);
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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [changePwSubmitting, setChangePwSubmitting] = useState(false);
  const [changePwError, setChangePwError] = useState("");
  const [changePwSuccess, setChangePwSuccess] = useState(false);

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
      fetch("/api/admin/admins", { headers: { "x-admin-key": adminKey } })
        .then((r) => r.json())
        .then((d) => setAdmins(d.items ?? [])),
    ])
      .then(([reqData, dealData, interestData, buyData, memberData]) => {
        setRequests(reqData.items ?? []);
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
    await fetch("/api/admin/partner-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ id, status }),
    });
    setPartnerRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const adminPhones = new Set(admins.map((a) => a.phone).filter(Boolean));

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
    const adminUrl = `${window.location.origin}/admin`;
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
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-orange font-bold mb-3">{authError}</p>
        <button onClick={onLogout} className="text-navy underline text-sm">
          다시 입력하기
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-6 pb-5 text-white flex items-center justify-between"
        style={{ background: "#0B2540" }}
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
            <div className="text-xs font-bold mt-1" style={{ color: "#FF9E7A" }}>
              🔔 미연락 리드 {interests.filter((i) => !i.contacted).length}건
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
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

      <div className="px-5 pt-4">
        <div className="text-xs font-bold text-gray500 mb-1.5">오늘</div>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: "오늘 신규 가입", value: members.filter((m) => isToday(m.created_at)).length },
            { label: "오늘 등록 매물", value: activeDeals.filter((d) => isToday(d.created_at)).length },
            { label: "오늘 구매희망", value: buyRequests.filter((b) => isToday(b.created_at)).length },
            { label: "미연락 리드", value: interests.filter((i) => !i.contacted).length },
            {
              label: "마감임박(6h)",
              value: activeDeals.filter((d) => {
                const remainMs = new Date(d.closes_at).getTime() - new Date().getTime();
                return remainMs > 0 && remainMs <= 6 * 60 * 60 * 1000;
              }).length,
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray200 rounded-xl px-1 py-2.5 text-center">
              <div className="text-base font-black text-navy">{stat.value}</div>
              <div className="text-[10px] text-gray500 mt-0.5 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="text-xs font-bold text-gray500 mb-1.5 mt-3">누적 현황</div>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: "전체 회원", value: members.length },
            { label: "사업자 인증", value: members.filter((m) => m.business_verified).length },
            {
              label: "누적 성사금액",
              value: `${interests
                .filter((i) => i.outcome === "completed")
                .reduce((sum, i) => sum + (i.completed_amount ?? 0), 0)
                .toLocaleString()}원`,
            },
            {
              label: "리드 성사율",
              value: `${
                interests.filter((i) => i.outcome !== "pending").length > 0
                  ? Math.round(
                      (interests.filter((i) => i.outcome === "completed").length /
                        interests.filter((i) => i.outcome !== "pending").length) *
                        100
                    )
                  : 0
              }%`,
            },
            { label: "대기중 판매신청", value: requests.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray200 rounded-xl px-1 py-2.5 text-center">
              <div className="text-base font-black text-navy">{stat.value}</div>
              <div className="text-[10px] text-gray500 mt-0.5 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <div className="text-sm font-bold text-gray500">최근 가입 회원 ({members.length}명)</div>

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

        {!loading && filteredMembers.length === 0 && (
          <div className="text-center text-gray500 py-6 text-sm">
            {members.length === 0 ? "아직 가입한 회원이 없어요." : "검색/필터 결과가 없어요."}
          </div>
        )}
        {filteredMembers.map((m) => (
          <div key={m.id} className="bg-white border border-gray200 rounded-2xl px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-bold text-gray900">
                {m.phone}
                {m.member_no != null && (
                  <span className="text-xs font-bold text-gray500 ml-1.5">{formatMemberNo(m.member_no)}</span>
                )}
                {m.nickname && <span className="text-sm font-medium text-gray500 ml-1.5">{m.nickname}</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
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
              <div className="flex items-center gap-1.5 mt-2">
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                  style={{ background: "#FFF6E5", color: "#B45309" }}
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
              {adminRole === "최고관리자" && !adminPhones.has(m.phone) && (
                <button
                  onClick={() => openAppoint(m)}
                  className="text-xs font-bold rounded-lg px-2.5 py-1 border border-gray200 text-navy"
                >
                  관리자로 임명
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <div className="text-sm font-bold text-gray500">
          관심 표시한 회원 ({interests.filter((i) => !i.contacted).length}건 미연락)
        </div>

        {interests.length > 0 && (
          <div className="bg-white border border-gray200 rounded-2xl px-4 py-3 flex justify-around text-center">
            <div>
              <div className="text-lg font-black text-navy">{interests.length}</div>
              <div className="text-xs text-gray500 mt-0.5">전체 리드</div>
            </div>
            <div>
              <div className="text-lg font-black" style={{ color: "#1D8A44" }}>
                {interests.filter((i) => i.outcome === "completed").length}
              </div>
              <div className="text-xs text-gray500 mt-0.5">거래 성사</div>
            </div>
            <div>
              <div className="text-lg font-black text-gray500">
                {interests.filter((i) => i.outcome === "pending").length}
              </div>
              <div className="text-xs text-gray500 mt-0.5">진행 중</div>
            </div>
            <div>
              <div className="text-lg font-black text-navy">
                {interests.filter((i) => i.outcome !== "pending").length > 0
                  ? Math.round(
                      (interests.filter((i) => i.outcome === "completed").length /
                        interests.filter((i) => i.outcome !== "pending").length) *
                        100
                    )
                  : 0}
                %
              </div>
              <div className="text-xs text-gray500 mt-0.5">성사율</div>
            </div>
          </div>
        )}

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

        {!loading && filteredInterests.length === 0 && (
          <div className="text-center text-gray500 py-6 text-sm">
            {interests.length === 0 ? "아직 관심 표시가 없어요." : "검색/필터 결과가 없어요."}
          </div>
        )}
        {filteredInterests.map((i) => (
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
                  : "#F2891F",
            }}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedLeads.has(i.id)}
                onChange={() => toggleLeadSelected(i.id)}
                className="w-4 h-4 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-bold text-gray900 truncate">
                    {i.deals?.title ?? "삭제된 매물"}
                  </div>
                  {i.outcome === "completed" && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "#E8F8EC", color: "#1D8A44" }}
                    >
                      성사
                    </span>
                  )}
                  {i.outcome === "no_deal" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-gray100 text-gray500">
                      불발
                    </span>
                  )}
                  {i.source === "quick" && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "#FDEEE8", color: "#C2410C" }}
                    >
                      ⚡ 원클릭
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray500 mt-0.5">
                  {i.members?.phone ?? i.phone ?? "번호 없음"}
                  {i.members?.member_no != null && (
                    <span className="ml-1.5 text-xs font-bold text-gray500">
                      {formatMemberNo(i.members.member_no)}
                    </span>
                  )}
                  {i.members?.is_business && (
                    <span className="ml-1.5 text-xs font-bold text-navy">· 사업자</span>
                  )}
                  {i.members?.business_verified && (
                    <span className="ml-1.5 text-xs font-bold inline-flex items-center gap-1" style={{ color: "#1D8A44" }}>
                      · <CheckCircle className="w-3 h-3" /> 인증된 사업자
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray500 mt-0.5">
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
              <button
                onClick={async () => {
                  await fetch("/api/admin/interests", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                    body: JSON.stringify({ id: i.id, source: i.source, contacted: !i.contacted }),
                  });
                  load();
                }}
                className="text-xs font-bold rounded-lg px-3 py-2 flex-shrink-0"
                style={
                  i.contacted
                    ? { background: "#F5F6F8", color: "#6B7480" }
                    : { background: "#0B2540", color: "#fff" }
                }
              >
                {i.contacted ? "연락완료" : "연락하기"}
              </button>
            </div>

            {i.outcome === "pending" && (
              <div className="flex gap-2 mt-3">
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
                  className="flex-1 text-xs font-bold rounded-lg py-2 inline-flex items-center justify-center gap-1"
                  style={{ background: "#E8F8EC", color: "#1D8A44" }}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> 거래 성사
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
                  className="flex-1 text-xs font-bold rounded-lg py-2 bg-gray100 text-gray500"
                >
                  거래 불발
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-5 py-4">
        <button
          onClick={() => setOpenFormFor(openFormFor === "new" ? null : "new")}
          className="w-full text-white font-bold rounded-xl text-base"
          style={{ background: "linear-gradient(135deg, #D9531E, #F2891F)", padding: "14px 0" }}
        >
          {openFormFor === "new" ? "닫기" : "+ 새 매물 직접 등록"}
        </button>
        {openFormFor === "new" && (
          <DealForm adminKey={adminKey} onDone={() => { setOpenFormFor(null); load(); }} />
        )}
      </div>

      <div className="px-5 pb-6 flex flex-col gap-3">
        <div className="text-sm font-bold text-gray500">
          진행 중인 매물 ({activeDeals.length})
        </div>
        {!loading && activeDeals.length === 0 && (
          <div className="text-center text-gray500 py-6 text-sm">진행 중인 매물이 없어요.</div>
        )}
        {activeDeals.map((d) => (
          <ActiveDealCard key={d.id} deal={d} adminKey={adminKey} onChanged={load} />
        ))}
      </div>

      <div className="px-5 pb-8 flex flex-col gap-3">
        <div className="text-sm font-bold text-gray500">
          대기 중인 판매자 신청 ({requests.length})
        </div>

        {loading && <div className="text-center text-gray500 py-8">불러오는 중...</div>}
        {!loading && requests.length === 0 && (
          <div className="text-center text-gray500 py-8 text-sm">대기 중인 신청이 없어요.</div>
        )}

        {requests.map((r) => (
          <div key={r.id} className="bg-white border border-gray200 rounded-2xl px-4 py-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray500">
              <span>{categoryIcons[r.categories?.name ?? ""] ?? "🗂️"}</span>
              {[r.categories?.name, r.regions?.name].filter(Boolean).join(" · ") || "카테고리/지역 미입력"}
            </div>
            <div className="text-base font-bold text-gray900 mt-1.5">{r.product_name}</div>
            <div className="text-sm text-gray500 mt-1">
              {[r.company_name, r.contact_name, r.contact_phone].filter(Boolean).join(" · ")}
            </div>
            <div className="text-sm text-gray500 mt-1">
              수량 {r.quantity}{r.quantity_unit || "개"}
              {r.min_order_qty ? ` (MOQ ${r.min_order_qty}${r.quantity_unit || "개"})` : ""}
              {r.hope_price ? ` · 희망단가 ${r.hope_price.toLocaleString()}원` : ""}
              {r.hope_duration_hours
                ? ` · 희망 마감 ${
                    r.hope_duration_hours >= 24
                      ? `${Math.round(r.hope_duration_hours / 24)}일`
                      : `${r.hope_duration_hours}시간`
                  } 후`
                : " · 마감시점 협의 필요"}
            </div>
            {(r.package_unit || r.spec || r.origin || r.storage_condition) && (
              <div className="text-sm text-gray500 mt-1">
                {[r.package_unit, r.spec, r.origin, r.storage_condition].filter(Boolean).join(" · ")}
              </div>
            )}
            {r.description && (
              <div className="text-sm text-gray500 mt-1 bg-gray100 rounded-lg px-3 py-2">
                {r.description}
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
                className="w-full rounded-lg mt-2 bg-black"
                style={{ maxHeight: "180px" }}
              />
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setOpenFormFor(openFormFor === r.id ? null : r.id)}
                className="flex-1 text-navy font-bold border-2 border-navy rounded-xl text-sm"
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
            {openFormFor === r.id && (
              <DealForm
                adminKey={adminKey}
                prefill={{
                  title: r.product_name,
                  category: r.categories?.name ?? mockCategories[0],
                  region: r.regions?.name ?? mockRegions[0],
                  dealPrice: r.hope_price ?? undefined,
                  totalQty: r.quantity,
                  quantityUnit: r.quantity_unit ?? undefined,
                  minOrderQty: r.min_order_qty ?? undefined,
                  images: r.images ?? [],
                  videoUrl: r.video_url ?? undefined,
                  description: r.description ?? "",
                  packageUnit: r.package_unit ?? "",
                  origin: r.origin ?? "",
                  spec: r.spec ?? "",
                  storageCondition: r.storage_condition ?? "",
                  closesInHours: r.hope_duration_hours ?? undefined,
                }}
                requestId={r.id}
                onDone={() => { setOpenFormFor(null); load(); }}
              />
            )}
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold">
          🏅 공식 점핑파트너 신청 ({partnerRequests.filter((r) => r.status === "pending").length}건 대기)
        </h2>
        <div className="mt-3 space-y-2">
          {partnerRequests.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">{r.members?.company_name ?? r.members?.phone ?? r.member_id}</span>
                <span
                  className={
                    r.status === "pending" ? "text-amber-600" : r.status === "approved" ? "text-green-600" : "text-gray-400"
                  }
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-1 text-gray-600">업종: {r.business_type}</p>
              <p className="text-gray-600">채널: {r.channel_info}</p>
              {r.message && <p className="text-gray-500">메모: {r.message}</p>}
              {r.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => reviewPartnerRequest(r.id, "approved")} className="rounded bg-green-600 px-3 py-1 text-xs text-white">
                    승인
                  </button>
                  <button onClick={() => reviewPartnerRequest(r.id, "rejected")} className="rounded bg-gray-400 px-3 py-1 text-xs text-white">
                    거절
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="px-5 pb-8 flex flex-col gap-3">
        <div className="text-sm font-bold text-gray500">
          🔍 이런 재고 찾습니다 ({buyRequests.filter((b) => !b.contacted).length}건 미연락)
        </div>

        {!loading && buyRequests.length === 0 && (
          <div className="text-center text-gray500 py-6 text-sm">등록된 구매 희망이 없어요.</div>
        )}

        {buyRequests.map((b) => (
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
              {b.contact_phone}
              {b.quantity ? ` · 희망수량 ${b.quantity}` : ""}
              {b.hope_price ? ` · 희망가 ${b.hope_price.toLocaleString()}원 이하` : ""}
            </div>
            {b.description && (
              <div className="text-sm text-gray500 mt-1 bg-gray100 rounded-lg px-3 py-2">
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
                {b.contacted ? "연락 완료" : "아직 연락 전"}
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
        ))}
      </div>

      {adminRole === "최고관리자" && (
        <div className="px-5 pt-4 pb-8 flex flex-col gap-3">
          <div className="text-sm font-bold text-gray500">관리자 목록 ({admins.length}명)</div>
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
                <div className="text-xs text-gray500 mt-1">{a.phone ?? "번호 미연결"}</div>
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
              <button
                onClick={() => removeAdmin(a)}
                disabled={removingAdminId === a.id}
                className="flex-shrink-0 text-xs font-bold rounded-lg px-3 py-1.5 border border-gray200 text-orange disabled:opacity-60"
              >
                {removingAdminId === a.id ? "처리 중..." : "해제"}
              </button>
            </div>
          ))}
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
            <div className="text-sm text-gray500 mb-5">{appointFor.phone}</div>

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
    </main>
  );
}

function ActiveDealCard({
  deal,
  adminKey,
  onChanged,
}: {
  deal: ActiveDeal;
  adminKey: string;
  onChanged: () => void;
}) {
  const [remainingQty, setRemainingQty] = useState(String(deal.remaining_qty));
  const [saving, setSaving] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch("/api/admin/deals/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ id: deal.id, ...body }),
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const extendHours = (hours: number) => {
    const newClosesAt = new Date(new Date(deal.closes_at).getTime() + hours * 3600 * 1000).toISOString();
    patch({ closesAt: newClosesAt });
  };

  return (
    <div className="bg-white border border-gray200 rounded-2xl px-4 py-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-gray500">
        <span>{categoryIcons[deal.categories?.name ?? ""] ?? "🗂️"}</span>
        {deal.categories?.name} · {deal.regions?.name}
      </div>
      <div className="text-base font-bold text-gray900 mt-1.5">{deal.title}</div>
      <div className="text-sm text-gray500 mt-1">
        {deal.deal_price.toLocaleString()}원 · 마감{" "}
        {new Date(deal.closes_at).toLocaleString("ko-KR", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <label className="text-xs font-bold text-gray500">재고</label>
        <input
          type="number"
          className="w-20 border-2 border-gray200 rounded-lg px-2 py-1.5 text-sm"
          value={remainingQty}
          onChange={(e) => setRemainingQty(e.target.value)}
        />
        <span className="text-xs text-gray500">/ {deal.total_qty}개</span>
        <button
          onClick={() => patch({ remainingQty: Number(remainingQty) })}
          disabled={saving}
          className="ml-auto text-xs font-bold text-white bg-navy rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          저장
        </button>
      </div>

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={() => extendHours(24)}
          disabled={saving}
          className="flex-1 text-xs font-bold text-navy border-2 border-gray200 rounded-lg py-2"
        >
          +24시간 연장
        </button>
        <button
          onClick={() => confirm("이 매물을 지금 조기 마감할까요?") && patch({ status: "closed" })}
          disabled={saving}
          className="flex-1 text-xs font-bold text-orange border-2 border-orange rounded-lg py-2"
        >
          조기 마감
        </button>
      </div>
    </div>
  );
}

function DealForm({
  adminKey,
  prefill,
  requestId,
  onDone,
}: {
  adminKey: string;
  prefill?: {
    title?: string;
    category?: string;
    region?: string;
    dealPrice?: number;
    totalQty?: number;
    quantityUnit?: string;
    minOrderQty?: number;
    images?: string[];
    videoUrl?: string;
    description?: string;
    packageUnit?: string;
    origin?: string;
    spec?: string;
    storageCondition?: string;
    closesInHours?: number;
  };
  requestId?: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [category, setCategory] = useState(prefill?.category ?? mockCategories[0]);
  const [region, setRegion] = useState(prefill?.region ?? mockRegions[0]);
  const [originalPrice, setOriginalPrice] = useState("");
  const [dealPrice, setDealPrice] = useState(prefill?.dealPrice ? String(prefill.dealPrice) : "");
  const [totalQty, setTotalQty] = useState(prefill?.totalQty ? String(prefill.totalQty) : "");
  const [quantityUnit, setQuantityUnit] = useState(prefill?.quantityUnit || quantityUnits[0]);
  const [minOrderQty, setMinOrderQty] = useState(
    prefill?.minOrderQty ? String(prefill.minOrderQty) : ""
  );
  const [location, setLocation] = useState("");
  const [closesInHours, setClosesInHours] = useState(
    prefill?.closesInHours ? String(prefill.closesInHours) : "24"
  );
  const [images, setImages] = useState<string[]>(prefill?.images ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(prefill?.videoUrl ?? null);
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [packageUnit, setPackageUnit] = useState(prefill?.packageUnit ?? "");
  const [origin, setOrigin] = useState(prefill?.origin ?? "");
  const [spec, setSpec] = useState(prefill?.spec ?? "");
  const [storageCondition, setStorageCondition] = useState(prefill?.storageCondition ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title || !dealPrice || !totalQty) {
      setError("매물명·판매가·수량은 필수예요.");
      return;
    }
    setSubmitting(true);
    const closesAt = new Date(Date.now() + Number(closesInHours) * 3600 * 1000).toISOString();
    try {
      const res = await fetch("/api/admin/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          title,
          category,
          region,
          originalPrice: parsePriceInput(originalPrice),
          dealPrice: parsePriceInput(dealPrice) ?? 0,
          totalQty: Number(totalQty),
          quantityUnit,
          minOrderQty: minOrderQty ? Number(minOrderQty) : null,
          location,
          closesAt,
          requestId,
          images,
          videoUrl,
          description,
          packageUnit: packageUnit || null,
          origin: origin || null,
          spec: spec || null,
          storageCondition: storageCondition || null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const sent = data.push?.sentCount ?? 0;
      alert(`매물이 등록됐어요. 구독자 ${sent}명에게 알림을 발송했어요.`);
      onDone();
    } catch {
      setError("등록에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 bg-gray100 rounded-xl p-3.5 flex flex-col gap-3">
      <input
        className="border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
        placeholder="매물명 *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex gap-2">
        <select
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {mockCategories.map((c) => (
            <option key={c} value={c}>
              {categoryIcons[c]} {c}
            </option>
          ))}
        </select>
        <select
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          {mockRegions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-gray500 -mt-1.5">
        지역 = 물건이 있는 곳(알림 매칭 기준), 상세 주소는 아래 입력칸에 따로 적어주세요.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            className="w-full border-2 border-gray200 rounded-lg pl-3 pr-8 py-2.5 text-sm outline-none focus:border-orange"
            placeholder="정상가 (선택)"
            value={formatPriceInput(originalPrice)}
            onChange={(e) => setOriginalPrice(e.target.value)}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray500">원</span>
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            className="w-full border-2 border-gray200 rounded-lg pl-3 pr-8 py-2.5 text-sm outline-none focus:border-orange"
            placeholder="판매가 *"
            value={formatPriceInput(dealPrice)}
            onChange={(e) => setDealPrice(e.target.value)}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray500">원</span>
        </div>
      </div>
      <p className="text-xs text-gray500 -mt-1.5">창고 출고가 기준이에요 (배송비 별도).</p>
      <div className="flex gap-2">
        <input
          type="number"
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
          placeholder="총 수량 *"
          value={totalQty}
          onChange={(e) => setTotalQty(e.target.value)}
        />
        <select
          className="border-2 border-gray200 rounded-lg px-2 py-2.5 text-sm"
          style={{ width: "90px" }}
          value={quantityUnit}
          onChange={(e) => setQuantityUnit(e.target.value)}
        >
          {quantityUnits.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
          placeholder="MOQ"
          value={minOrderQty}
          onChange={(e) => setMinOrderQty(e.target.value)}
        />
      </div>
      <input
        className="w-full border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
        placeholder="지역 상세 (예: 서울 가락동)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
          placeholder="포장 단위"
          value={packageUnit}
          onChange={(e) => setPackageUnit(e.target.value)}
        />
        <input
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
          placeholder="규격/사이즈"
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
          placeholder="원산지"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        />
        <input
          className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
          placeholder="보관조건·유통기한"
          value={storageCondition}
          onChange={(e) => setStorageCondition(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs font-bold text-gray500 mb-1 block">마감까지 남은 시간</label>
        <select
          className="w-full border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm"
          value={closesInHours}
          onChange={(e) => setClosesInHours(e.target.value)}
        >
          <option value="3">3시간</option>
          <option value="12">12시간</option>
          <option value="24">24시간</option>
          <option value="72">3일</option>
          <option value="168">7일</option>
        </select>
      </div>

      <textarea
        className="border-2 border-gray200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-navy"
        rows={2}
        placeholder="소비기한, 보관상태 등 상세 설명 (선택)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error && <div className="text-xs text-orange font-medium">{error}</div>}

      <ImageUploader
        onChange={setImages}
        label="매물 사진"
        hint="최대 4장 (신청서에 첨부된 사진 포함)"
        initialUrls={prefill?.images ?? []}
      />

      <VideoUploader onChange={setVideoUrl} initialUrl={prefill?.videoUrl} />

      <button
        onClick={submit}
        disabled={submitting}
        className="text-white font-bold rounded-lg text-sm disabled:opacity-60"
        style={{ background: "#0B2540", padding: "12px 0" }}
      >
        {submitting ? "등록 중..." : "매물 등록 확정"}
      </button>
    </div>
  );
}
