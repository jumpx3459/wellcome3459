"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockDeals, categoryIcons, categoryColors, type Deal } from "@/lib/mockData";
import CountdownBadge from "@/components/CountdownBadge";
import { formatPrice, percentOff } from "@/lib/format";

export default function DealDetailPage() {
  return (
    <Suspense fallback={null}>
      <DealDetailPageInner />
    </Suspense>
  );
}

function DealDetailPageInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref"); // 공유 링크로 들어온 추천인 코드 — 정식가입까지 이어줌
  const isExampleId = params.id?.startsWith("example-") ?? false;
  const [deal, setDeal] = useState<Deal>(
    mockDeals.find((d) => d.id === (isExampleId ? params.id.slice(8) : params.id)) ?? mockDeals[0]
  );
  const [interested, setInterested] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickPhone, setQuickPhone] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [interestNeedsReauth, setInterestNeedsReauth] = useState(false);
  const [manifestOpen, setManifestOpen] = useState(false);

  // JUMP X 브릿지("JUMP X에서 입찰 참여하기") — 거래 플랫폼이 준비될 때까지는
  // "준비중" 안내만 하고, 클릭은 수요 신호로만 가볍게 기록합니다.
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [ownRefCode, setOwnRefCode] = useState<string | null>(null);
  const [bridgeComingSoon, setBridgeComingSoon] = useState(false);

  const handleShare = async () => {
    const url =
      typeof window !== "undefined"
        ? ownRefCode
          ? `${window.location.origin}${window.location.pathname}?ref=${ownRefCode}`
          : window.location.href
        : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: deal.title, text: `${deal.title} · ${formatPrice(deal.deal_price)}`, url });
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
      const { data } = await supabase
        .from("deals")
        .select(
          "id, title, deal_price, original_price, total_qty, remaining_qty, closes_at, location, images, video_url, description, status, package_unit, origin, spec, storage_condition, quantity_unit, min_order_qty, interest_count, pid, manifest_items, seller_member_id, seller_display_name, categories(name), regions(name)"
        )
        .eq("id", params.id)
        .single();

      if (data) {
        setDeal({
          id: data.id,
          title: data.title,
          category: (data.categories as unknown as { name: string } | null)?.name ?? "기타",
          region: (data.regions as unknown as { name: string } | null)?.name ?? "",
          location: data.location ?? "",
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
          quantity_unit: data.quantity_unit ?? "개",
          min_order_qty: data.min_order_qty ?? null,
          interest_count: data.interest_count ?? 0,
          pid: data.pid ?? null,
          manifest_items: data.manifest_items ?? null,
          seller_member_id: data.seller_member_id ?? null,
          seller_display_name: data.seller_display_name ?? null,
        });
      }
    })();
  }, [params.id, isExampleId]);

  const images = deal.images ?? [];
  const heroImage = activeImage ?? images[0];

  const remainPct = Math.round((deal.remaining_qty / deal.total_qty) * 100);
  const color = categoryColors[deal.category] ?? categoryColors["기타"];

  const handleInterest = async () => {
    setInterestError(null);
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
      fetch("/api/admin/notify-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal.id }),
      }).catch(() => {});
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
    if (digits.length < 9) {
      setQuickError("휴대폰 번호를 정확히 입력해주세요.");
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
          body: JSON.stringify({ dealId: deal.id, phone: digits }),
        });
        if (!res.ok) throw new Error();
      }
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
  const handleBridgeClick = () => {
    setBridgeComingSoon(true);
    fetch("/api/bridge-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: deal.id, memberId }),
    }).catch(() => {});
  };

  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid #EEF0F2" }}>
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto flex-shrink-0" />
          <span className="text-gray500 text-xs tracking-wide truncate">Powered by JumpX</span>
        </Link>
        {remainPct <= 30 && (
          <div className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: "#FF6F0F", color: "#fff" }}>
            🔥 소진임박 · {deal.remaining_qty}{deal.quantity_unit || "개"} 남음
          </div>
        )}
      </div>

      <div className="px-5 pt-4">
        <div
          className="h-[220px] relative rounded-2xl overflow-hidden"
          style={heroImage ? {} : { background: `linear-gradient(135deg, ${color.solid}, #0B2540)` }}
        >
          {heroImage && (
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 w-full h-full"
              aria-label="사진 크게 보기"
            >
              <img src={heroImage} alt={deal.title} className="absolute inset-0 w-full h-full object-cover" />
            </button>
          )}
          <div className="absolute top-2.5 right-2.5">
            {deal.status === "closed" ? (
              <span className="text-xs font-bold text-white bg-gray500 px-2.5 py-1.5 rounded-full shadow">마감됨</span>
            ) : (
              <div className="rounded-full shadow" style={{ background: "rgba(255,255,255,0.94)" }}>
                <CountdownBadge closesAt={deal.closes_at} />
              </div>
            )}
          </div>
          {heroImage && (
            <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-xs font-bold text-white bg-black/45 px-2.5 py-1 rounded-full pointer-events-none">
              🔍 확대
            </div>
          )}
        </div>
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(url)}
              className="rounded-lg overflow-hidden flex-shrink-0"
              style={{
                width: "56px",
                height: "56px",
                border: (activeImage ?? images[0]) === url ? `2px solid ${color.solid}` : "2px solid transparent",
              }}
            >
              <img src={url} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
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
          {isExampleId && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ background: "rgba(226,81,0,.85)" }}>
              예시 미리보기
            </span>
          )}
        </div>
        <h1 className="font-display text-navy text-2xl leading-snug">{deal.title}</h1>
      </div>

      <div className="flex-1 p-5 flex flex-col gap-4" style={{ paddingBottom: "24px" }}>
        {deal.video_url && (
          <video
            src={deal.video_url}
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
              {formatPrice(deal.deal_price)}
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
              <span className="line-through">{formatPrice(deal.original_price)}</span>
              {deal.min_order_qty && ` · 최소주문 ${deal.min_order_qty}${deal.quantity_unit || "개"}`}
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
              deal.package_unit ? { k: "포장 단위", v: deal.package_unit } : null,
              deal.spec ? { k: "규격", v: deal.spec } : null,
              deal.origin ? { k: "원산지", v: deal.origin } : null,
              deal.storage_condition ? { k: "보관조건", v: deal.storage_condition } : null,
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

        {deal.seller_display_name && (
          <div className="border border-gray200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray500 font-bold mb-0.5">판매자</div>
              <div className="text-sm font-bold text-navy">{deal.seller_display_name}</div>
            </div>
            {deal.seller_member_id && isMember && memberId !== deal.seller_member_id && (
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

        {showMessageForm && deal.seller_member_id && (
          <div className="border-2 border-gray200 rounded-2xl p-4">
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="가격·수량 등 궁금한 점을 남겨주세요."
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

        {deal.description && (
          <div className="border-t border-gray200 pt-4">
            <div className="text-sm font-bold text-navy mb-2">상세 설명</div>
            <p className="text-sm text-gray500 leading-relaxed whitespace-pre-line">
              {deal.description}
            </p>
          </div>
        )}

        {/* 2026-09-26: 혼합매물(리퀴데이션 팔레트) — 개별 사진 대신 PID#/구성품 목록으로
            신뢰도를 보완. 목록은 품목이 많을 수 있어 기본은 접어두고 펼쳐보게 함. */}
        {(deal.pid || (deal.manifest_items && deal.manifest_items.length > 0)) && (
          <div className="border-t border-gray200 pt-4">
            {deal.pid && (
              <div className="text-xs text-gray500 mb-2">
                🧾 매니페스트 번호(PID#): <span className="font-mono font-bold text-navy">{deal.pid}</span>
              </div>
            )}
            {deal.manifest_items && deal.manifest_items.length > 0 && (
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
              className="inline-block text-white text-center font-bold rounded-xl text-sm px-6"
              style={{ background: "linear-gradient(135deg, #E25100, #FF6F0F)", padding: "12px 24px" }}
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
              실제 매물이 등록되면 이런 화면으로
              <br />
              바로 알림이 가요.
            </div>
            <Link
              href="/signup"
              className="inline-block mt-4 text-white text-center font-bold rounded-xl text-sm px-6 py-3"
              style={{ background: "linear-gradient(135deg, #E25100, #FF6F0F)" }}
            >
              무료 알림받기 →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="px-5 pt-1" style={{ paddingBottom: "116px" }}>
            <div className="bg-gray100 rounded-2xl p-3 flex items-center gap-3.5">
              <img
                src="/images/manager.png"
                alt="점핑매니저"
                className="w-20 h-20 rounded-xl object-contain bg-white flex-shrink-0"
              />
              <div>
                <p className="text-base font-bold text-navy leading-snug">
                  점핑매니저가 바로 연락드립니다.
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span
                    className="text-[11px] font-bold px-2 py-1 rounded-full"
                    style={{ background: "#E8F8EC", color: "#1D8A44" }}
                  >
                    ✓ 검증된 매니저
                  </span>
                  <span className="text-[11px] font-bold text-gray500 px-2 py-1 rounded-full bg-white">
                    당일 연락 원칙
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray100 rounded-2xl p-4 mt-3">
              <div className="text-sm font-bold text-navy mb-1">지금 바로 입찰하고 싶다면</div>
              <p className="text-xs text-gray500 mb-3">
                JUMP X 경매에서 실시간으로 입찰할 수 있어요. 휴대폰 인증번호 한 번이면 바로 참여
                가능해요.
              </p>

              {bridgeComingSoon ? (
                <div className="text-xs font-bold text-gray500 text-center" style={{ padding: "12px 0" }}>
                  거래 플랫폼(JUMP X) 준비 중이에요 · 오픈하면 가장 먼저 알려드릴게요
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

            <Link
              href="/logistics"
              className="flex items-center justify-between rounded-2xl mt-3"
              style={{ background: "rgba(11,37,64,.06)", border: "1px solid #1B3A5C", padding: "14px 16px" }}
            >
              <span>
                <span className="block text-sm font-black text-navy">🚚 화물이 필요하세요?</span>
                <span className="block text-xs mt-0.5" style={{ color: "#1B3A5C" }}>
                  운임·팔레트·통관 계산기 보기
                </span>
              </span>
              <span style={{ color: "#1B3A5C" }}>→</span>
            </Link>
          </div>

          <div
            className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-6 pt-3 bg-white"
            style={{ boxShadow: "0 -8px 20px rgba(11,37,64,0.08)", bottom: "64px" }}
          >
            {showQuickForm && !interested ? (
              <div className="border-2 border-gray200 rounded-2xl p-4">
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
                  className="w-full text-white text-center font-bold rounded-2xl text-base disabled:opacity-60"
                  style={{
                    background: interested ? "#8A8A82" : "linear-gradient(135deg, #E25100, #FF6F0F)",
                    padding: "14px 0",
                  }}
                >
                  {interested ? "점핑매니저에게 전달됐어요" : "관심있어요 · 점핑매니저 연결"}
                </button>
                {interestError && (
                  <div className="text-xs text-orange text-center mt-2">
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
          </div>
        </>
      )}

      {lightboxOpen && heroImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 text-white text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
          <img
            src={heroImage}
            alt={deal.title}
            className="max-w-full max-h-[70vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <div className="flex gap-2 mt-5 overflow-x-auto px-5" onClick={(e) => e.stopPropagation()}>
              {images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(url)}
                  className="rounded-lg overflow-hidden flex-shrink-0"
                  style={{
                    width: "48px",
                    height: "48px",
                    border: (activeImage ?? images[0]) === url ? "2px solid #FF6F0F" : "2px solid transparent",
                    opacity: (activeImage ?? images[0]) === url ? 1 : 0.5,
                  }}
                >
                  <img src={url} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
