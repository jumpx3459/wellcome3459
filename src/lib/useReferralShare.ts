"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { generateRefCode } from "@/lib/refCode";
import { authFetch } from "@/lib/authFetch";
import { isTestTitle } from "@/lib/categoryAvg";
import { dealPriceLabel, isNegotiable } from "@/lib/priceMode";
import { SITE_URL } from "@/lib/siteUrl";

// 점핑파트너(추천 공유) 데이터 — 2026-10-12 feat/my-menu-share: MY 점핑파트너 구역에 있던 로직을 /share로 옮기며 훅으로 분리.
// 추천 코드(없으면 발급) · 공유할 매물 · 추천 회원 · 공식 파트너 상태/신청.

export type ReferralItem = {
  member_no: number | null;
  is_business: boolean;
  created_at: string;
  phone: string;
  company_name: string | null;
  business_verified: boolean;
};

export type PartnerStatus = "none" | "pending" | "approved" | "rejected";

export type ShareDeal = {
  id: string;
  title: string;
  deal_price: number | null;
  price_mode?: string | null;
  quantity_unit: string | null;
  price_unit: string | null;
};

export function useReferralShare(memberId: string | null) {
  const [refCode, setRefCode] = useState("");
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [referralsLoaded, setReferralsLoaded] = useState(false);
  const [shareDeals, setShareDeals] = useState<ShareDeal[]>([]);
  const [selectedShareDealId, setSelectedShareDealId] = useState<string>("");
  const [isOfficialPartner, setIsOfficialPartner] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>("none");
  const [partnerForm, setPartnerForm] = useState({ businessType: "", channelInfo: "", message: "" });
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);
  const [partnerError, setPartnerError] = useState("");

  // 추천 코드 + 공식 파트너 여부 + 신청 상태
  useEffect(() => {
    if (!memberId || !supabase) return;
    (async () => {
      const { data: member } = await supabase
        .from("members")
        .select("ref_code, is_official_partner")
        .eq("id", memberId)
        .maybeSingle();
      if (member?.ref_code) {
        setRefCode(member.ref_code);
      } else {
        // 이 기능이 생기기 전에 가입한 회원 — 지금 처음 코드를 발급해줌(링크가 비면 안 됨)
        const newCode = generateRefCode();
        const { error: codeError } = await supabase.from("members").update({ ref_code: newCode }).eq("id", memberId);
        if (!codeError) setRefCode(newCode);
      }
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

  // 추천 회원 — 토큰은 authFetch가 호출할 때마다 최신으로(만료 시 갱신)
  useEffect(() => {
    if (!memberId) return;
    authFetch("/api/my-referrals")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setReferrals(data.items ?? []))
      .catch(() => {})
      .finally(() => setReferralsLoaded(true));
  }, [memberId]);

  // 공유할 매물 — 공유 시 앱 홍보 문구 대신 실제 특가를 보여주는 게 더 잘 클릭됨
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("deals")
      .select("id, title, deal_price, price_mode, quantity_unit, price_unit")
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

  const shareDeal = shareDeals.find((d) => d.id === selectedShareDealId) ?? null;

  // 공유·QR 링크는 항상 정식 주소 — 비정식 주소(xxx.vercel.app)로 들어온 사람이 공유해도
  // 그 주소가 퍼지지 않게 (src/lib/siteUrl.ts)
  const refUrl = refCode
    ? shareDeal
      ? `${SITE_URL}/deals/${shareDeal.id}?ref=${refCode}`
      : `${SITE_URL}/signup?ref=${refCode}`
    : "";

  // 추천 링크 공유 문구 (ReferralShareButtons가 공유창에 넣음)
  const shareText = shareDeal
    ? isNegotiable(shareDeal)
      ? `[덤핑점핑] ${shareDeal.title} 가격 협의 매물! 이런 재고 알림 매일 받아보세요 → ${refUrl}`
      : `[덤핑점핑] ${shareDeal.title} ${dealPriceLabel(shareDeal)} 특가! 이런 재고특가 알림 매일 받아보세요 → ${refUrl}`
    : `점프엑스 덤핑점핑 - 재고 특가 알림 받아보세요! ${refUrl}`;

  return {
    refCode,
    refUrl,
    shareText,
    referrals,
    referralsLoaded,
    shareDeals,
    selectedShareDealId,
    setSelectedShareDealId,
    isOfficialPartner,
    partnerStatus,
    partnerForm,
    setPartnerForm,
    partnerSubmitting,
    partnerError,
    submitPartnerRequest,
  };
}

export type ReferralShareState = ReturnType<typeof useReferralShare>;
