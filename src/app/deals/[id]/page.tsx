"use client";

import { DEAL_NEW_COLS, isMissingNewColumn, type DealRowLoose, isStorageType, STORAGE_ICONS, formatExpiry } from "@/lib/dealFields";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TabLink from "@/components/TabLink";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { hasAppHistory, goHome } from "@/lib/appNav";
import { mockDeals, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import CountdownBadge from "@/components/CountdownBadge";
import { formatPrice, percentOff, formatDealPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/siteUrl";
import { MESSAGES_ENABLED, JUMPX_BRIDGE_ENABLED, JUMPX_PREVIEW_ENABLED } from "@/lib/features";
import JumpxPreviewSheet from "@/components/JumpxPreviewSheet";
import { formatDealLocation } from "@/lib/formatDealLocation";
import NoPhotoPlaceholder from "@/components/NoPhotoPlaceholder";
import { rem } from "@/lib/rem";
import { getFreshAccessToken } from "@/lib/authFetch";
import { SECTION_TITLE_STYLE, SERVICES_ANCHOR_ID, ServiceTilesCompact } from "@/components/EcosystemGrid";
import StockTypeBadge from "@/components/StockTypeBadge";
import GuestPrivacyConsent from "@/components/GuestPrivacyConsent";
import { isLumpSum } from "@/lib/priceUnit";
import { isValidKoreanPhone } from "@/lib/auth";
import { TERMS_VERSION } from "@/lib/consent";
import PhotoCarousel, { type PhotoCarouselHandle } from "@/components/PhotoCarousel";
import PhotoViewer from "@/components/PhotoViewer";
import ZoomTip from "@/components/ZoomTip";
import { PRIVATE_SELLER_NAME, PRIVATE_SELLER_NOTE, publicSellerName } from "@/lib/sellerDisplay";
import FloatingCTA, { FLOATING_CTA_BUTTON_CLASS, FLOATING_CTA_SPACE, floatingCtaButtonStyle } from "@/components/FloatingCTA";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 값이 없거나 공백뿐이면 섹션/행 자체를 그리지 않는다 (빈 공간 방지)
function hasText(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim() !== "";
}

export default function DealDetailPage() {
  return (
    <Suspense fallback={null}>
      <DealDetailPageInner />
    </Suspense>
  );
}

function DealDetailPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref"); // 공유 링크로 들어온 추천인 코드 — 정식가입까지 이어줌
  const isExampleId = params.id?.startsWith("example-") ?? false;
  const [deal, setDeal] = useState<Deal>(
    mockDeals.find((d) => d.id === (isExampleId ? params.id.slice(8) : params.id)) ?? mockDeals[0]
  );
  const [interested, setInterested] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickPhone, setQuickPhone] = useState("");
  // 2026-09-30: 비회원 [필수] 개인정보 수집·이용 동의 (GuestPrivacyConsent)
  const [quickConsent, setQuickConsent] = useState(false);
  const [quickConsentError, setQuickConsentError] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  // 2026-09-29: 히어로 사진 넘기기(PhotoCarousel) + 전체 화면(PhotoViewer)
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const carouselRef = useRef<PhotoCarouselHandle>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [interestNeedsReauth, setInterestNeedsReauth] = useState(false);
  // 2026-10-01 F-1: 이미 접수된 리드(비회원 같은 번호 재접수) 안내
  const [interestNotice, setInterestNotice] = useState<string | null>(null);
  const [manifestOpen, setManifestOpen] = useState(false);
  const sellerName = publicSellerName(deal);

  // JUMP X 브릿지("JUMP X에서 입찰 참여하기") — 거래 플랫폼이 준비될 때까지는
  // "준비중" 안내만 하고, 클릭은 수요 신호로만 가볍게 기록합니다.
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [jumpxSheetOpen, setJumpxSheetOpen] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [ownRefCode, setOwnRefCode] = useState<string | null>(null);
  const [bridgeComingSoon, setBridgeComingSoon] = useState(false);

  // 목록(홈/딜스/마이페이지 등 어디서 들어왔든)으로 돌아가는 버튼 — 공유 링크로
  // 바로 들어와 히스토리가 없는 경우에만 홈으로 폴백합니다.
  // 2026-09-28: window.history.length는 카카오톡 인앱 브라우저 등에서 공유 링크로
  // 직접 들어와도 1보다 큰 경우가 있어서(웹뷰 자체 히스토리), router.back()이
  // 앱 밖(카카오톡)으로 튕겨나가는 문제가 있었음 — 이 세션에서 실제 앱 내 이동이
  // 있었는지(hasAppHistory)로 판단하도록 교체 (buy/sell과 동일 로직, src/lib/appNav.ts).
  const goBack = () => {
    if (hasAppHistory()) {
      router.back();
    } else {
      goHome(router); // 2026-10-01 PR-C: 홈을 위에 쌓지 않음(replace) — 홈에서 뒤로가기 = 앱 종료
    }
  };

  const handleShare = async () => {
    // 정식 주소 기준으로 공유 (src/lib/siteUrl.ts)
    const url =
      typeof window !== "undefined"
        ? ownRefCode
          ? `${SITE_URL}${window.location.pathname}?ref=${ownRefCode}`
          : `${SITE_URL}${window.location.pathname}${window.location.search}`
        : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: deal.title, text: `${deal.title} · ${formatDealPrice(deal.deal_price, deal.quantity_unit, deal.price_unit)}`, url });
      } catch {
        // 사용자가 공유를 취소한 경우 — 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // 클립보드 접근 실패 — 무시
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setIsMember(true);
      setMemberId(userData.user.id);
      const { data: member } = await supabase
        .from("members")
        .select("ref_code")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (member?.ref_code) setOwnRefCode(member.ref_code);
    })();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    if (isExampleId) return;

    (async () => {
      // 2026-10-01 PR-B: 보관 조건·소비기한(expiry_date·storage_type) — SQL 전이면 빼고 다시 조회
      const run = (extra: string) =>
        supabase!
          .from("deals")
          .select<string, DealRowLoose>(
            `id, title, deal_price, original_price, total_qty, remaining_qty, closes_at, location, images, video_url, description, status, package_unit, origin, spec, storage_condition, quantity_unit, price_unit, min_order_qty, interest_count, pid, manifest_items, is_anonymous, seller_display_name, stock_type, categories(name), regions(name)${extra}`
          )
          .eq("id", params.id)
          .single();
      let { data, error } = await run(DEAL_NEW_COLS);
      if (isMissingNewColumn(error)) ({ data, error } = await run(""));

      if (data) {
        setDeal({
          id: data.id,
          title: data.title,
          category: (data.categories as unknown as { name: string } | null)?.name ?? "기타",
          region: (data.regions as unknown as { name: string } | null)?.name ?? "",
          location: formatDealLocation(((data.regions as unknown) as { name: string } | null)?.name, data.location),
          stock_type: data.stock_type ?? "general",
          original_price: data.original_price,
          deal_price: data.deal_price,
          total_qty: data.total_qty,
          remaining_qty: data.remaining_qty,
          closes_at: data.closes_at,
          images: data.images ?? [],
          video_url: data.video_url ?? null,
          description: data.description ?? "",
          status: data.status ?? "active",
          package_unit: data.package_unit ?? null,
          origin: data.origin ?? null,
          spec: data.spec ?? null,
          storage_condition: data.storage_condition ?? null,
          storage_type: data.storage_type ?? null,
          expiry_date: data.expiry_date ?? null,
          quantity_unit: data.quantity_unit ?? "개",
          price_unit: data.price_unit ?? null,
          min_order_qty: data.min_order_qty ?? null,
          interest_count: data.interest_count ?? 0,
          pid: data.pid ?? null,
          manifest_items: data.manifest_items ?? null,
          // 2026-09-30: seller_member_id는 공개 조회 대상에서 뺌(컬럼 권한 SQL) — 쪽지(꺼져 있음)를 다시 켤 땐 서버 API로
          is_anonymous: data.is_anonymous ?? null,
          seller_display_name: data.seller_display_name ?? null,
        });
      }
    })();
  }, [params.id, isExampleId]);

  const images = deal.images ?? [];
  const hasPhotos = images.length > 0;
  const hasManifest = Boolean(deal.manifest_items?.length && Object.keys(deal.manifest_items[0] ?? {}).length > 0);

  const remainPct = Math.round((deal.remaining_qty / deal.total_qty) * 100);
  const color = categoryColors[deal.category] ?? categoryColors["기타"];

  // 2026-10-01 F-1: 이미 관심 표시한 매물이면 처음부터 "관심 표시 완료" — 회원은 interests(본인 행만 읽힘), 비회원은 이 기기 기록
  useEffect(() => {
    if (isExampleId || !params.id) return;
    if (readQuickInterestIds().includes(params.id)) setInterested(true);
    if (!isSupabaseConfigured || !supabase) return;
    (async () => {
      const { data: userData } = await supabase!.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase!.from("interests").select("id").eq("deal_id", params.id).eq("member_id", userData.user.id).limit(1);
      if (data?.length) setInterested(true);
    })();
  }, [params.id, isExampleId]);

  // 마감 시각이 지난 매물(아직 status는 active일 수 있음) — 관심 접수 막음. 회원 직접 저장은 RLS가 마감을 안 보므로 화면에서 막음(DB 정책은 F-2 SQL)
  const isPastClose = () => !!deal.closes_at && new Date(deal.closes_at).getTime() <= Date.now();

  const handleInterest = async () => {
    setInterestError(null);
    if (deal.status === "closed" || isPastClose()) {
      setInterestError("이미 마감된 매물이에요.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      // 데모 모드에서도 실제와 동일한 원클릭 흐름을 보여줍니다.
      setShowQuickForm(true);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      // 회원가입 화면으로 보내는 대신, 전화번호 한 줄만 받는 인라인 폼을 엽니다.
      // (회원가입·인증 없이도 리드가 즉시 점핑매니저에게 전달됩니다.)
      setShowQuickForm(true);
      return;
    }

    const { error } = await supabase.from("interests").upsert(
      { deal_id: deal.id, member_id: userData.user.id },
      { onConflict: "deal_id,member_id", ignoreDuplicates: true }
    );
    if (!error) {
      setInterested(true);
      // 2026-10-01: 토큰을 같이 보내 서버가 회원 기준 호출 제한·관심 표시 확인 (notify-lead)
      getFreshAccessToken()
        .catch(() => null)
        .then((accessToken) =>
          fetch("/api/admin/notify-lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dealId: deal.id, accessToken }),
          })
        )
        .catch(() => {});
    } else {
      console.error("interest upsert failed:", error);
      if (error.code === "23503") {
        setInterestNeedsReauth(true);
        setInterestError("계정 정보가 완전하지 않아요. 알림받기를 다시 진행해주세요.");
      } else {
        setInterestError("처리 중 문제가 발생했어요. 새로고침 후 다시 시도해주세요.");
      }
    }
  };

  const sendMessage = async () => {
    setMessageError(null);
    if (!supabase || !memberId || !deal.seller_member_id) return;
    if (!messageBody.trim()) {
      setMessageError("내용을 입력해주세요.");
      return;
    }
    // DB 정책(messages_insert_valid)과 같은 규칙 — 1~1000자
    if (messageBody.trim().length > 1000) {
      setMessageError("쪽지는 1000자까지 보낼 수 있어요.");
      return;
    }
    setMessageSending(true);
    const { error } = await supabase.from("messages").insert({
      deal_id: deal.id,
      sender_id: memberId,
      receiver_id: deal.seller_member_id,
      body: messageBody.trim(),
    });
    if (error) {
      setMessageError("전송에 실패했어요. 잠시 후 다시 시도해주세요.");
    } else {
      setMessageSent(true);
    }
    setMessageSending(false);
  };

  const submitQuickInterest = async () => {
    setQuickError(null);
    const digits = quickPhone.replace(/[^0-9]/g, "");
    // 2026-10-01 F-1: 서버(/api/quick-interest)와 같은 규칙 — 01[016789] 10~11자리
    if (!isValidKoreanPhone(quickPhone)) {
      setQuickError("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    if (deal.status === "closed" || isPastClose()) {
      setQuickError("이미 마감된 매물이에요.");
      return;
    }
    if (!quickConsent) {
      setQuickConsentError(true);
      setQuickError("개인정보 수집·이용에 동의해주세요.");
      return;
    }
    setQuickSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        await new Promise((r) => setTimeout(r, 400));
      } else {
        const res = await fetch("/api/quick-interest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId: deal.id, phone: digits, privacyConsent: quickConsent, consentVersion: TERMS_VERSION }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQuickError(
            res.status === 409 ? "이미 마감된 매물이에요." : res.status === 429 ? "잠시 후 다시 시도해주세요." : data.error ?? "전송에 실패했어요. 잠시 후 다시 시도해주세요."
          );
          return;
        }
        if (data.duplicate) setInterestNotice("이미 접수됐어요, 빠르게 연락드려요");
      }
      rememberQuickInterest(deal.id);
      setInterested(true);
      setShowQuickForm(false);
    } catch {
      setQuickError("전송에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setQuickSubmitting(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("autoInterest") === "1") {
      handleInterest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  // JUMP X 브릿지 — 거래 플랫폼(실시간 입찰)이 준비될 때까지는 /api/jumpx-bridge
  // 호출 없이 "준비중" 안내만 하고, 클릭 자체는 수요 신호로 기록해둡니다.
  // 준비되면 이 핸들러만 원래 로직(전화번호 수집 → /api/jumpx-bridge)으로
  // 되돌리면 됩니다.
  const handleBridgeClick = async () => {
    setBridgeComingSoon(true);
    // 회원 연결은 서버가 accessToken으로 결정 (memberId는 보내지 않음, 비회원은 토큰 없이)
    const accessToken = await getFreshAccessToken().catch(() => null);
    fetch("/api/bridge-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: deal.id, accessToken }),
    }).catch(() => {});
  };

  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid #EEF0F2" }}>
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={goBack}
            aria-label="뒤로 가기"
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 -ml-1.5 rounded-full text-gray500 active:bg-gray100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <TabLink href="/" className="flex items-center gap-2 min-w-0">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto flex-shrink-0" />
            <span className="text-gray500 text-xs tracking-wide truncate">Powered by JumpX</span>
          </TabLink>
        </div>
        {remainPct <= 30 && (
          <div className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: "#FF6F0F", color: "#fff" }}>
            🔥 소진임박 · {deal.remaining_qty}{deal.quantity_unit || "개"} 남음
          </div>
        )}
      </div>

      <ZoomTip />

      {/* 2026-09-29: 사진이 있으면 화면 폭 전체 1:1 + 옆으로 넘기기 + "1/N", 누르면 전체 화면(핀치 확대).
          사진이 없으면 예전처럼 3:1 자리표시 */}
      {hasPhotos ? (
        <div className="pt-3">
          <PhotoCarousel
            ref={carouselRef}
            images={images}
            alt={deal.title}
            index={photoIndex}
            onIndexChange={setPhotoIndex}
            onOpen={(i) => setViewerIndex(i)}
            overlay={
              <div className="absolute top-2.5 right-2.5 pointer-events-none">
                {deal.status === "closed" ? (
                  <span className="font-bold text-white bg-gray500 rounded-full shadow" style={{ fontSize: rem(16), padding: "2px 10px" }}>마감됨</span>
                ) : (
                  <div className="rounded-full shadow" style={{ background: "rgba(255,255,255,0.94)" }}>
                    <CountdownBadge closesAt={deal.closes_at} tone={isExampleId ? "muted" : "urgent"} />
                  </div>
                )}
              </div>
            }
          />
        </div>
      ) : (
        <div className="px-5 pt-4">
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "3/1" }}>
            <NoPhotoPlaceholder category={deal.category} muted={deal.status === "closed"} />
            <div className="absolute top-2.5 right-2.5">
              {deal.status === "closed" ? (
                <span className="font-bold text-white bg-gray500 rounded-full shadow" style={{ fontSize: rem(16), padding: "2px 10px" }}>마감됨</span>
              ) : (
                <div className="rounded-full shadow" style={{ background: "rgba(255,255,255,0.94)" }}>
                  <CountdownBadge closesAt={deal.closes_at} tone={isExampleId ? "muted" : "urgent"} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {images.length > 1 && (
        <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => {
                setPhotoIndex(i);
                carouselRef.current?.scrollToIndex(i);
              }}
              aria-label={`사진 ${i + 1} 보기`}
              className="rounded-lg overflow-hidden flex-shrink-0"
              style={{
                width: "56px",
                height: "56px",
                border: photoIndex === i ? `2px solid ${color.solid}` : "2px solid transparent",
              }}
            >
              <img src={url} alt={`사진 ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-5 pt-3">
        <div className="flex items-center flex-wrap gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: color.bg, color: color.text }}>
            <span className="text-sm">{categoryIcons[deal.category] ?? "🗂️"}</span>
            {deal.category}
          </span>
          <StockTypeBadge value={deal.stock_type} />
          {isExampleId && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ background: "rgba(226,81,0,.85)" }}>
              예시 미리보기
            </span>
          )}
        </div>
        <h1 className="font-display text-navy text-2xl leading-snug">{deal.title}</h1>
      </div>

      <div className="flex-1 p-5 flex flex-col gap-4" style={{ paddingBottom: "24px" }}>
        {hasText(deal.video_url) && (
          <video
            src={deal.video_url!}
            controls
            playsInline
            className="w-full rounded-2xl bg-black"
            style={{ maxHeight: "320px" }}
          />
        )}

        <div>
          <div className="flex items-baseline gap-2">
            {percentOff(deal.original_price, deal.deal_price) > 0 && (
              <span className="text-xl font-black" style={{ color: "#E25100" }}>
                -{percentOff(deal.original_price, deal.deal_price)}%
              </span>
            )}
            <span className="text-3xl font-black" style={{ color: "#0B2540" }}>
              {formatDealPrice(deal.deal_price, deal.quantity_unit, deal.price_unit)}
            </span>
            {/* 2026-09-26: 카드 리스트와 동일한 threshold-gating(3건 미만 숨김) */}
            {(deal.interest_count ?? 0) >= 3 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                style={{ background: "#FDEEE8", color: "#C2410C" }}
              >
                ❤️ {deal.interest_count}명 관심
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-sm text-gray500">
              {deal.original_price > deal.deal_price && (
                <span className="line-through">{formatDealPrice(deal.original_price, deal.quantity_unit, deal.price_unit)}</span>
              )}
              {isLumpSum(deal.price_unit)
                ? `${deal.original_price > deal.deal_price ? " · " : ""}전체 일괄 판매`
                : deal.min_order_qty
                  ? `${deal.original_price > deal.deal_price ? " · " : ""}최소주문 ${deal.min_order_qty}${deal.quantity_unit || "개"}`
                  : null}
            </span>
            <button
              type="button"
              onClick={handleShare}
              className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-gray500 border border-gray200 rounded-full px-3 py-1.5"
            >
              {shareCopied ? "링크 복사됨 ✓" : "공유 ↗"}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray500 -mt-1">창고 출고가 기준이에요 (배송비 별도).</p>

        <div>
          <div className="h-2.5 bg-gray200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${remainPct}%`, background: color.solid }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-sm font-bold" style={{ color: color.text }}>
              재고 {remainPct}% 남음{remainPct < 30 ? " · 서두르세요" : ""}
            </span>
            <span className="text-sm text-gray500">
              {deal.remaining_qty}/{deal.total_qty}
              {deal.quantity_unit || "개"}
            </span>
          </div>
        </div>

        <div className="border border-gray200 rounded-2xl overflow-hidden mt-1">
          {(
            [
              { k: "지역", v: deal.location },
              { k: "카테고리", v: deal.category },
              hasText(deal.package_unit) ? { k: "포장 단위", v: deal.package_unit! } : null,
              hasText(deal.spec) ? { k: "규격", v: deal.spec! } : null,
              hasText(deal.origin) ? { k: "원산지", v: deal.origin! } : null,
              // 2026-10-01 PR-B: 새 칸(보관·소비기한) 우선, 둘 다 비면 예전 자유 입력
              isStorageType(deal.storage_type) ? { k: "보관", v: `${STORAGE_ICONS[deal.storage_type]} ${deal.storage_type}` } : null,
              formatExpiry(deal.expiry_date) ? { k: "소비기한", v: formatExpiry(deal.expiry_date)! } : null,
              !isStorageType(deal.storage_type) && !formatExpiry(deal.expiry_date) && hasText(deal.storage_condition)
                ? { k: "보관조건", v: deal.storage_condition! }
                : null,
              {
                k: "수량",
                v: `${deal.total_qty}${deal.quantity_unit || "개"} 중 ${deal.remaining_qty}${deal.quantity_unit || "개"} 남음`,
              },
            ].filter((row): row is { k: string; v: string } => row !== null)
          ).map((row, i, arr) => (
            <div key={row.k} className={i < arr.length - 1 ? "flex border-b border-gray200" : "flex"}>
              <div className="w-24 flex-shrink-0 px-3.5 py-3 text-xs font-bold text-gray500 bg-gray100">
                {row.k}
              </div>
              <div className="flex-1 px-3.5 py-3 text-sm text-gray900">{row.v}</div>
            </div>
          ))}
        </div>

        {/* 2026-09-30: 판매자 칸은 항상 표시 (약관 제10조 3항) — 상호 공개면 상호, 그 외는 "비공개 판매자" */}
        {(
          <div className="border border-gray200 rounded-2xl p-4 flex items-center justify-between gap-3" data-seller-box>
            <div className="min-w-0">
              <div className="text-gray500 font-bold mb-0.5" style={{ fontSize: rem(13) }}>판매자</div>
              {sellerName ? (
                <div className="font-bold text-navy break-words" style={{ fontSize: rem(16) }}>{sellerName}</div>
              ) : (
                <div className="font-bold text-navy" style={{ fontSize: rem(16) }}>
                  {PRIVATE_SELLER_NAME}
                  <span className="font-medium text-gray500" style={{ fontSize: rem(14) }}> · {PRIVATE_SELLER_NOTE}</span>
                </div>
              )}
            </div>
            {MESSAGES_ENABLED && deal.seller_member_id && isMember && memberId !== deal.seller_member_id && (
              <button
                type="button"
                onClick={() => setShowMessageForm((v) => !v)}
                className="flex-shrink-0 text-sm font-bold text-white rounded-xl"
                style={{ background: "#0B2540", padding: "10px 16px" }}
              >
                💬 쪽지 보내기
              </button>
            )}
          </div>
        )}

        {MESSAGES_ENABLED && showMessageForm && deal.seller_member_id && (
          <div className="border-2 border-gray200 rounded-2xl p-4">
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="가격·수량 등 궁금한 점을 남겨주세요."
              maxLength={1000}
              className="w-full border-2 border-gray200 rounded-xl p-3 text-sm outline-none focus:border-navy"
              rows={3}
            />
            {messageError && <div className="text-xs text-orange font-medium mt-1.5">{messageError}</div>}
            {messageSent ? (
              <div className="text-sm font-bold text-verified mt-2">쪽지를 보냈어요 · 마이페이지에서 답장을 확인하세요.</div>
            ) : (
              <button
                type="button"
                onClick={sendMessage}
                disabled={messageSending}
                className="w-full mt-2 text-white font-bold rounded-xl disabled:opacity-60"
                style={{ background: "#0B2540", padding: "12px 0" }}
              >
                {messageSending ? "보내는 중..." : "쪽지 보내기"}
              </button>
            )}
          </div>
        )}

        {hasText(deal.description) && (
          <div className="border-t border-gray200 pt-4">
            <div className="text-sm font-bold text-navy mb-2">상세 설명</div>
            <p className="text-sm text-gray500 leading-relaxed whitespace-pre-line">
              {deal.description}
            </p>
          </div>
        )}

        {/* 2026-09-26: 혼합매물(리퀴데이션 파렛트) — 개별 사진 대신 PID#/구성품 목록으로
            신뢰도를 보완. 목록은 품목이 많을 수 있어 기본은 접어두고 펼쳐보게 함. */}
        {(hasText(deal.pid) || hasManifest) && (
          <div className="border-t border-gray200 pt-4">
            {hasText(deal.pid) && (
              <div className="text-xs text-gray500 mb-2">
                🧾 매니페스트 번호(PID#): <span className="font-mono font-bold text-navy">{deal.pid}</span>
              </div>
            )}
            {hasManifest && deal.manifest_items && (
              <>
                <button
                  type="button"
                  onClick={() => setManifestOpen((v) => !v)}
                  className="flex items-center justify-between w-full"
                >
                  <span className="text-sm font-bold text-navy">
                    구성품 목록 ({deal.manifest_items.length}개)
                  </span>
                  <span className="text-xs text-gray500">{manifestOpen ? "접기 ▲" : "펼치기 ▼"}</span>
                </button>
                {manifestOpen && (
                  <div className="mt-2 border border-gray200 rounded-lg overflow-x-auto">
                    <table className="text-xs w-full" style={{ minWidth: Object.keys(deal.manifest_items[0]).length * 90 }}>
                      <thead>
                        <tr>
                          {Object.keys(deal.manifest_items[0]).map((h) => (
                            <th key={h} className="text-left px-2 py-1.5 bg-gray100 whitespace-nowrap text-gray500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deal.manifest_items.map((row, i) => (
                          <tr key={i}>
                            {Object.keys(deal.manifest_items![0]).map((h) => (
                              <td key={h} className="px-2 py-1.5 border-t border-gray200 whitespace-nowrap">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {deal.status === "closed" ? (
        <div className="p-5 pt-1">
          <div className="bg-gray100 rounded-2xl px-4 py-4 text-center">
            <div className="text-sm font-bold text-gray900 mb-1">이미 마감된 매물이에요</div>
            <p className="text-sm text-gray500 mb-3">
              비슷한 매물이 또 나올 때 가장 먼저 알려드릴게요.
            </p>
            <Link
              href={ref ? `/signup?ref=${ref}` : "/signup"}
              className={`w-full ${BTN_CLASS}`}
              style={btnStyle("primary")}
            >
              덤핑정보 알림 받기
            </Link>
          </div>
        </div>
      ) : isExampleId ? (
        <div className="p-5 pt-1" style={{ paddingBottom: "40px" }}>
          <div className="rounded-2xl text-center" style={{ background: "#F5F6F8", padding: "24px 20px" }}>
            <div className="text-sm font-bold text-gray500 mb-1">이건 미리보기예요</div>
            <div className="text-base font-bold text-navy leading-relaxed">
              실제 매물이 등록되면 이런 화면으로{" "}
              <br className="hidden sm:inline" />
              빠르게 알림이 가요.
            </div>
            <Link
              href="/signup"
              className={`w-full mt-4 ${BTN_CLASS}`}
              style={btnStyle("primary")}
            >
              무료 알림받기 →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="px-5 pt-1" style={{ paddingBottom: FLOATING_CTA_SPACE }} /* 고정 CTA(약 101px) + 위 페이드 28px + 여유 16px — 하단 탭·안전영역은 AppShell이 더함 */>
            <div className="bg-gray100 rounded-2xl p-3 flex items-center gap-3.5">
              <img
                src="/images/manager.png"
                alt="점핑매니저"
                className="w-20 h-20 rounded-xl object-contain bg-white flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-base font-bold text-navy leading-snug">
                  점핑매니저가 바로 연락드립니다.
                </p>
                {/* 2026-09-29: "당일 연락 원칙" → "빠르게 연락드려요" (지킬 수 있는 표현으로). 390px에서 배지 2개 한 줄 유지
                    2026-10-01: 360px에선 카드 밖으로 22px 넘쳐서 줄바꿈 허용(390px 이상은 그대로 한 줄) */}
                <div className="flex items-center gap-1 gap-y-1.5 mt-1.5 flex-wrap">
                  <span
                    className="font-bold px-2 py-1 rounded-full whitespace-nowrap"
                    style={{ fontSize: rem(13), background: "#E8F8EC", color: "#1D8A44" }}
                  >
                    ✓ 검증된 매니저
                  </span>
                  <span className="font-bold text-gray500 px-2 py-1 rounded-full bg-white whitespace-nowrap" style={{ fontSize: rem(13) }}>
                    빠르게 연락드려요
                  </span>
                </div>
              </div>
            </div>

            {JUMPX_BRIDGE_ENABLED && (
            <div className="bg-gray100 rounded-2xl p-4 mt-3">
              <div className="text-sm font-bold text-navy mb-1">지금 바로 입찰하고 싶다면</div>
              <p className="text-xs text-gray500 mb-3">
                JUMP X 경매에서 실시간으로 입찰할 수 있어요. 휴대폰 인증번호 한 번이면 바로 참여
                가능해요.
              </p>

              {bridgeComingSoon ? (
                // 2026-09-27: 회색 텍스트 한 줄이라 "비활성화된 기능"처럼 죽어 보였음 —
                // 아래 "화물이 필요하세요?" 카드와 같은 무게(아이콘+굵은 타이틀+서브텍스트)로
                // 올리되, 화살표는 빼서 클릭 가능한 링크가 아님을 구분(순수 시각 개선,
                // 클릭 액션 없음).
                <div
                  className="flex items-center gap-3 rounded-xl"
                  style={{ background: "#fff", border: "1px solid #E2E5E9", padding: "14px 16px" }}
                >
                  <span className="text-xl flex-shrink-0">🚀</span>
                  <div>
                    <div className="text-sm font-black text-navy">거래 플랫폼(JUMP X) 준비 중이에요</div>
                    <div className="text-xs mt-0.5 text-gray500">오픈하면 가장 먼저 알려드릴게요</div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleBridgeClick}
                  className="w-full text-navy text-center font-bold rounded-xl text-sm border-2 border-navy"
                  style={{ padding: "12px 0" }}
                >
                  JUMP X에서 입찰 참여하기 →
                </button>
              )}
            </div>
            )}

            {/* 2026-09-29: 점프엑스 둘러보기 — 실제 입찰 브릿지(JUMPX_BRIDGE_ENABLED)가 꺼져 있는 동안의 보조 버튼.
                둘러보기 클릭은 bridge_interests에 source = "preview"로 기록 (브릿지 클릭은 source null). */}
            {JUMPX_PREVIEW_ENABLED && !JUMPX_BRIDGE_ENABLED && (
              <button
                type="button"
                onClick={() => setJumpxSheetOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl mt-3 bg-white"
                style={{ minHeight: 52, border: "1.5px solid #0B2540", color: "#0B2540", padding: "0 16px" }}
              >
                <span className="font-bold" style={{ fontSize: rem(16) }}>점프엑스에서 거래하기</span>
                <span
                  className="font-bold rounded-full whitespace-nowrap"
                  style={{ fontSize: rem(13), padding: "2px 8px", background: "#EEF1F5", color: "#4B5563" }}
                >
                  오픈 준비 중
                </span>
              </button>
            )}
            {jumpxSheetOpen && (
              <JumpxPreviewSheet dealId={deal.id} memberId={memberId} returnTo={`/deals/${deal.id}`} onClose={() => setJumpxSheetOpen(false)} />
            )}

            {/* 2026-09-29: "🚚 화물이 필요하세요?" 카드 → "점핑 서비스" 컴팩트 섹션 (화물배차·계산기 2칸).
                순서: 가격·정보 → 점핑매니저 카드 → (관심있어요 CTA는 하단 고정) → JUMP X(꺼짐) → 점핑 서비스.
                "전체 보기"는 회원이면 MY, 비회원이면 홈의 같은 섹션 (MY는 비회원에게 로그인 화면만 보여서). */}
            <div className="mt-6" data-section="detail-services">
              <div className="flex items-center justify-between mb-2.5">
                <div style={SECTION_TITLE_STYLE}>점핑 서비스</div>
                <Link
                  href={isMember ? `/mypage#${SERVICES_ANCHOR_ID}` : `/#${SERVICES_ANCHOR_ID}`}
                  className="font-bold flex items-center"
                  style={{ fontSize: rem(14), color: "#4B5563", minHeight: 44 }}
                >
                  전체 보기 →
                </Link>
              </div>
              <ServiceTilesCompact />
            </div>
          </div>

          {/* 2026-09-27: 홈 하단 CTA와 동일한 톤으로 통일 — 불투명 흰 배경 대신
              반투명+블러 카드 + 상단 페이드로, 스크롤 중인 상세 콘텐츠가 자연스럽게
              이어지도록 함. */}
          {/* 2026-09-29: 공용 하단 고정 버튼 — 판·블러 없이 버튼만 띄움 */}
          <FloatingCTA>
            {showQuickForm && !interested ? (
              <div className="border border-gray200 rounded-2xl p-4 bg-white" style={{ boxShadow: "0 10px 28px rgba(11,37,64,.18)" }}>
                <div className="text-sm font-bold text-navy mb-1">번호만 남기면 바로 연락드려요</div>
                <p className="text-xs text-gray500 mb-3">
                  회원가입 없이도 점핑매니저가 확인 후 연락드립니다. 알림을 계속 받고 싶으시면 나중에
                  가입하셔도 돼요.
                </p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="flex-1 min-w-0 border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                    style={{ height: "48px" }}
                  />
                  <button
                    onClick={submitQuickInterest}
                    disabled={quickSubmitting}
                    className="text-white font-bold rounded-xl px-5 whitespace-nowrap flex-shrink-0 disabled:opacity-60"
                    style={{ background: "#FF6F0F" }}
                  >
                    {quickSubmitting ? "전송 중..." : "전달하기"}
                  </button>
                </div>
                <div className="mt-2.5">
                  <GuestPrivacyConsent
                    checked={quickConsent}
                    onChange={(v) => {
                      setQuickConsent(v);
                      setQuickConsentError(false);
                    }}
                    error={quickConsentError}
                  />
                </div>
                {quickError && <div className="text-xs text-orange font-medium mt-2">{quickError}</div>}
                <Link
                  href={`/signup?returnTo=${encodeURIComponent(`/deals/${deal.id}?autoInterest=1`)}${ref ? `&ref=${ref}` : ""}`}
                  className="block text-center text-xs text-gray500 underline mt-3"
                >
                  정식으로 가입하고 알림도 계속 받을래요 →
                </Link>
              </div>
            ) : (
              <>
                <button
                  onClick={handleInterest}
                  disabled={interested}
                  // 2026-10-01 F-1: 완료 상태는 안내라 흐리게(opacity) 두지 않고 불투명 흰 바탕 — 뒤 내용과 섞여 안 읽히던 문제
                  className={`${FLOATING_CTA_BUTTON_CLASS}${interested ? " disabled:opacity-100" : ""}`}
                  style={interested ? { ...floatingCtaButtonStyle(true), background: "#fff", color: "#0B2540", border: "1.5px solid #C9CFD6", fontSize: rem(16) } : floatingCtaButtonStyle()}
                >
                  {interested ? "관심 표시 완료 · 점핑매니저가 빠르게 연락드려요" : "관심있어요 · 점핑매니저 연결"}
                </button>
                {interestNotice && (
                  <div className="mx-auto mt-2 w-fit max-w-full rounded-full bg-white text-center font-bold" style={{ fontSize: rem(14), padding: "6px 12px", color: "#0B2540", boxShadow: "0 4px 12px rgba(11,37,64,.15)" }}>
                    {interestNotice}
                  </div>
                )}
                {interestError && (
                  <div className="mx-auto mt-2 w-fit max-w-full rounded-full bg-white text-center text-orange" style={{ fontSize: rem(14), padding: "6px 12px", boxShadow: "0 4px 12px rgba(11,37,64,.15)" }}>
                    {interestError}
                    {interestNeedsReauth && (
                      <>
                        {" "}
                        <Link
                          href={`/signup?returnTo=${encodeURIComponent(`/deals/${deal.id}`)}`}
                          className="underline font-bold"
                        >
                          인증하기 →
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
                      </FloatingCTA>
        </>
      )}

      {viewerIndex !== null && hasPhotos && (
        <PhotoViewer
          images={images}
          alt={deal.title}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={(i) => {
            setPhotoIndex(i);
            carouselRef.current?.scrollToIndex(i);
          }}
        />
      )}
    </main>
  );
}

// 2026-10-01 F-1: 비회원이 이 기기에서 관심 접수한 매물 id — 다시 와도 "관심 표시 완료"로 (저장소가 막혀 있으면 조용히 넘어감)
const QUICK_INTEREST_KEY = "dj_quick_interest_deals";
function readQuickInterestIds(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(QUICK_INTEREST_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function rememberQuickInterest(dealId: string) {
  try {
    const ids = readQuickInterestIds().filter((x) => x !== dealId);
    window.localStorage.setItem(QUICK_INTEREST_KEY, JSON.stringify([dealId, ...ids].slice(0, 100)));
  } catch {}
}
