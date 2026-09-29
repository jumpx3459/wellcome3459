"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasAppHistory } from "@/lib/appNav";
import { CheckCircle } from "lucide-react";
import { mockCategories, mockRegions, categoryIcons, quantityUnits, guessCategory } from "@/lib/mockData";
import { formatPriceInput, parsePriceInput, PRICE_UNITS, formatPriceWithUnit } from "@/lib/format";
import { isValidContactPhone, formatContactPhone } from "@/lib/auth";
import ContactPhoneInput from "@/components/ContactPhoneInput";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { NAV_BOTTOM } from "@/components/BottomNav";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import { rem } from "@/lib/rem";
import { getFreshAccessToken } from "@/lib/authFetch";

export default function BuyPage() {
  const router = useRouter();
  // 2026-09-28: ← 버튼이 무조건 홈으로 가서, deals/[id]처럼 딥링크(공유/카톡)로
  // 바로 들어온 경우가 아니라 앱 내 다른 화면에서 들어온 경우엔 그 화면으로
  // 돌아가도록 통일 — window.history.length는 카카오톡 인앱 브라우저 등에서
  // 직접 진입해도 1보다 큰 경우가 있어(앱 밖으로 튕겨나감) 대신 이 세션에서
  // 실제 앱 내 이동이 있었는지(hasAppHistory)로 판단.
  const goBack = () => {
    if (hasAppHistory()) {
      router.back();
    } else {
      router.push("/");
    }
  };
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  // 2026-09-27: 상품명 입력 시 카테고리가 자동 추천되지만 가로 스크롤 목록 중간에
  // 묻혀 있어 "선택은 됐는데 안 보임" 문제 — 추천되면 칩 목록 대신 요약 한 줄
  // ("추천됨" 배지 포함)로 접고, "수정"을 눌러야 다시 전체 목록을 펼치도록 변경.
  // 상품명이 비었거나 추천 결과가 없으면(guessCategory가 null) 기본값 true라
  // 처음부터 펼쳐진 상태로 보임.
  const [categoryEditing, setCategoryEditing] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState(quantityUnits[0]);
  const [hopePrice, setHopePrice] = useState("");
  // 희망 단가 기준 단위 — 기본은 희망 수량 단위를 따라가고, 직접 고르면 그때부터 따로
  const [priceUnit, setPriceUnit] = useState<string>(quantityUnits[0]);
  const [priceUnitTouched, setPriceUnitTouched] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [autofilledPhone, setAutofilledPhone] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인한 회원이면 인증된 번호를 미리 채워준다 — 다른 담당자 연락처로 접수하는
  // 대리 등록 케이스가 있어서 수정은 그대로 허용한다. (sell/page.tsx와 동일 패턴)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: member } = await supabase
        .from("members")
        .select("phone")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (member?.phone) {
        const filled = formatContactPhone(member.phone);
        setContactPhone(filled);
        setAutofilledPhone(filled);
      }
    })();
  }, []);

  // 카테고리 자동 추천 (2026-09-29 규칙 정리):
  //   - 직접 고르기 전(categoryTouched=false)엔 상품명이 바뀔 때마다 다시 계산
  //   - 상품명을 지우거나 매칭이 없으면 비움 (기본값 없음 — 예전엔 이전 추천이 그대로 남았음)
  //   - 직접 고른 뒤엔 상품명이 바뀌어도 덮어쓰지 않음
  useEffect(() => {
    if (categoryTouched) return;
    const guessed = guessCategory(productName);
    setCategory(guessed ?? "");
    if (!guessed) {
      setCategoryEditing(true);
      return;
    }
    // 2026-09-27: "수정"으로 직접 펼친 상태에서 상품명을 계속 입력하면 이
    // effect가 매번 다시 실행돼 추천 카테고리로 도로 접혀버리는 문제 —
    // 카테고리가 비어있을 때(=아직 한 번도 추천된 적 없을 때)만 자동으로
    // 접고, 이미 펼쳐서 보고 있는 중이면 그대로 유지한다.
    if (!category) setCategoryEditing(false);
  }, [productName, categoryTouched]);

  const allRegionsOn = regions.length === mockRegions.length;
  const toggleRegion = (r: string) => setRegions((prev) => (prev.includes(r) ? prev.filter((v) => v !== r) : [...prev, r]));

  const submit = async () => {
    setError(null);
    if (!productName || !contactPhone) {
      setError("찾는 품목과 연락처는 꼭 입력해주세요.");
      return;
    }
    // 2026-09-29: 사무실 번호(02-, 031-…, 대표번호 15xx 등)도 허용 — 서버도 같은 isValidContactPhone
    if (!isValidContactPhone(contactPhone)) {
      setContactError("휴대폰 또는 사무실 번호를 정확히 입력해주세요");
      document.getElementById("contact-phone")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      // 로그인 회원이면 토큰을 함께 보내 서버가 회원 연결(member_id) — 연락처를 바꿔도 연결 유지
      const accessToken = await getFreshAccessToken(); // 비회원이면 null (buy API는 비회원도 허용)
      const res = await fetch("/api/buy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          category: category || null,
          region: regions.length > 0 && !allRegionsOn ? regions.join(", ") : null,
          quantity: quantity ? `${quantity}${quantityUnit}` : null,
          hopePrice: parsePriceInput(hopePrice) ?? null,
          hopePriceUnit: parsePriceInput(hopePrice) ? priceUnit : null,
          accessToken,
          contactPhone: formatContactPhone(contactPhone),
          description,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.field === "contactPhone") {
          setContactError(data.error ?? "연락처를 확인해주세요.");
          document.getElementById("contact-phone")?.focus();
          return;
        }
        throw new Error();
      }
      setDone(true);
    } catch {
      setError("등록 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const summary = [
      category || "전체 카테고리",
      productName || "찾는 재고",
      quantity ? `${quantity}${quantityUnit} 이상` : null,
      hopePrice ? `${formatPriceWithUnit(parsePriceInput(hopePrice) ?? 0, priceUnit)} 이하` : null,
      allRegionsOn || regions.length === 0 ? "전 지역" : regions.join("·"),
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <main className="flex flex-col min-h-screen">
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4.5" style={{ borderBottom: "1px solid #EEF0F2" }}>
          <button type="button" onClick={goBack} className="text-gray500" style={{ fontSize: rem(19), background: "none", border: "none", padding: 0, cursor: "pointer" }}>←</button>
          {/* 2026-09-26: 탭 화면마다 로고 유무가 달라 브랜드 인지가 끊긴다는 피드백 —
              모든 하단탭 화면 헤더에 작은 로고를 공통으로 배치. */}
          <img src="/images/logo.png" alt="덤핑점핑" className="w-6 h-6 rounded-md flex-shrink-0 object-contain" />
          <span className="font-display text-2xl whitespace-nowrap" style={{ color: "#0B2540" }}>
            이런 상품 찾습니다
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-6" style={{ paddingTop: 40 }}>
          <CheckCircle className="w-12 h-12 mb-4 text-verified" />
          <h1 className="font-display text-2xl text-navy mb-2">구매 희망 등록 완료!</h1>
          <p className="text-gray500 text-base leading-relaxed mb-6">
            점핑매니저가 전국 재고를 뒤져서{" "}
            <br className="hidden sm:inline" />
            조건에 맞는 매물이 나오면 바로 알려드릴게요.
          </p>
          <div className="w-full text-left rounded-2xl" style={{ background: "#F5F6F8", padding: "14px 16px" }}>
            <div className="text-xs font-bold" style={{ color: "#6B7480" }}>등록한 조건</div>
            <div className="font-bold mt-1.5 leading-relaxed" style={{ fontSize: rem(14), color: "#0B2540" }}>{summary}</div>
          </div>

          <Link
            href="/mypage#referral"
            className="w-full block text-left rounded-2xl mt-4"
            style={{ background: "#FFF9EC", border: "1px solid #F0DCA8", padding: "13px 15px" }}
          >
            <p className="text-xs font-bold" style={{ color: "#8A6100" }}>
              🎁 판매자 친구를 추천하면 서로 사진 슬롯 +2장을 드려요
            </p>
            <p className="text-xs mt-1" style={{ color: "#8A6100" }}>추천 링크 보내러 가기 →</p>
          </Link>

          <Link
            href="/"
            className="w-full block text-center font-bold rounded-2xl text-white mt-5"
            style={{ background: "#0B2540", padding: "15px 0", fontSize: rem(15) }}
          >
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* 2026-09-26 (2): 화이트 헤더 바로 아래에 네이비 스트립이 붙어 있어 톤이
          뚝 끊겨 보인다는 피드백 — buy/sell/signup 3개 화면 모두 헤더와 긴급성
          로테이션 스트립을 하나의 네이비 블록으로 병합 (deals/마이페이지는
          원래부터 헤더 자체가 다크 히어로라 이 문제가 없었음). */}
      {/* 2026-09-26 (6): deals/홈과 나란히 볼 때 이 화면만 단색 네이비라 밋밋해
          보인다는 피드백 — 높이는 그대로 두고 배경만 deals/홈과 동일한 도트
          텍스처 그라디언트로 통일 (폼 필드 위치·스크롤은 불변). */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        {/* 2026-09-27 (deals 스타일 통일): 하단 탭 레벨 화면인 buy만 유일하게
            뒤로가기(←)를 쓰고 있던 불일치 — deals/page.tsx와 동일하게
            "로고=홈 링크 + Powered by JumpX 배지 / 소제목 라벨+로테이션 태그 행 /
            좌측 정렬 대형 타이틀" 구조로 교체. */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-3">
            {/* 2026-09-27: buy(찾습니다)·sell(매물등록)은 진입 경로가 다양해
                로고=홈 링크만으로는 부족하다는 피드백 — 뒤로가기(←)를 복원. */}
            <button type="button" onClick={goBack} style={{ fontSize: rem(19), color: "rgba(255,255,255,0.8)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>←</button>
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
          <div className="flex items-center justify-between flex-wrap gap-y-1.5">
            <div className="text-xs font-bold tracking-widest whitespace-nowrap" style={{ color: "#FFD166" }}>
              재고 구매 요청
            </div>
            <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
          </div>
          <h1 className="font-display text-2xl mt-1.5 text-white">이런 상품 찾습니다</h1>
        </div>

        {/* 2026-09-27: signup step1/2와 동일하게 네이비를 핵심 카피까지 확장 —
            기존 회색 카드(#EEF1F5) 배경을 걷어내고 네이비 위에 흰 텍스트로 직접 배치.
            2026-09-27 (재검토): manager.png는 불투명 흰 배경이 박혀있어 네이비 위에서
            흰 사각형이 그대로 보이는 문제 — 투명 배경 버전(manager-cut.png, 온보딩
            메인 캐릭터와 동일 에셋)으로 교체하고 크기도 2배 가까이 키움. */}
        <div className="flex items-center gap-3.5" style={{ padding: "2px 22px 22px" }}>
          <img
            src="/images/manager-cut.png"
            alt="점핑매니저"
            className="flex-shrink-0"
            style={{ width: 76, height: 76, objectFit: "contain", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.35))" }}
          />
          <p className="leading-snug" style={{ fontSize: rem(13), color: "rgba(255,255,255,.92)", fontWeight: 500 }}>
            찾는 재고를 올려두면 점핑매니저가 매입처를 직접 찾아 연결해드려요.
          </p>
        </div>
      </div>

      <div className="flex-1 px-5 py-4.5 flex flex-col gap-4.5" style={{ paddingBottom: 148 }}>
        <div>
          <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
            무엇을 찾으세요?
            <span className="text-xs font-bold" style={{ color: "#E25100" }}>(필수)</span>
          </div>
          <input
            className="w-full rounded-xl outline-none"
            style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: rem(14.5) }}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="예: 냉동 삼겹살 500kg 이상"
          />
          <p className="mt-1.5" style={{ fontSize: rem(14), color: "#4B5563" }}>
            💡 상품명을 입력하면 카테고리를 자동으로 골라드려요
          </p>
        </div>

        <div>
          <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
            연락처
            <span className="text-xs font-bold" style={{ color: "#E25100" }}>(필수)</span>
          </div>
          <ContactPhoneInput
            value={contactPhone}
            onChange={(v) => {
              setContactPhone(v);
              setContactError(null);
            }}
            autofilledValue={autofilledPhone}
            error={contactError}
          />
        </div>

        <div>
          <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
            카테고리
            <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
          </div>
          {categoryEditing ? (
            <>
            {!category && !categoryTouched && (
              <p className="mb-2" style={{ fontSize: rem(14), color: "#6B7480" }}>상품명을 입력하면 자동으로 골라드려요</p>
            )}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {mockCategories.map((c) => {
                const picked = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategoryTouched(true);
                      setCategory(picked ? "" : c);
                      setCategoryEditing(false);
                    }}
                    className="flex items-center gap-1 rounded-full whitespace-nowrap flex-shrink-0"
                    style={{
                      padding: "9px 13px",
                      fontSize: rem(13),
                      fontWeight: 700,
                      background: "#fff",
                      border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                      color: "#1A1F26",
                    }}
                  >
                    <span>{categoryIcons[c]}</span>
                    {c}
                  </button>
                );
              })}
            </div>
            </>
          ) : (
            <div className="flex items-center justify-between rounded-xl" style={{ border: "1.5px solid #E4E7EB", padding: "10px 13px" }}>
              <span className="flex items-center gap-1.5 text-sm font-bold min-w-0">
                {category ? (
                  <>
                    <span className="flex-shrink-0">{categoryIcons[category]}</span>
                    <span className="truncate" style={{ color: "#1A1F26" }}>{category}</span>
                    {!categoryTouched && (
                      <span
                        className="flex-shrink-0 text-xs font-bold rounded-full"
                        style={{ color: "var(--color-brandOrange)", background: "#FFF1E7", padding: "2px 8px" }}
                      >
                        추천됨
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: "#9AA3AD", fontWeight: 700 }}>카테고리 선택 안 함</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setCategoryEditing(true)}
                className="flex-shrink-0 text-xs font-bold"
                style={{ color: "#6B7480" }}
              >
                수정
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
              희망 수량
              <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
            </div>
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB" }}>
              <input
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "14px 10px", fontSize: rem(14.5) }}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="500"
              />
              <select
                className="flex-shrink-0 outline-none"
                style={{ width: 74, border: "none", borderLeft: "1px solid #E4E7EB", padding: "14px 8px", fontSize: rem(13), fontWeight: 700, color: "#0B2540", background: "#FAFBFC", textAlign: "center" }}
                value={quantityUnit}
                onChange={(e) => {
                  setQuantityUnit(e.target.value);
                  if (!priceUnitTouched) setPriceUnit(e.target.value);
                }}
              >
                {quantityUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
              희망 단가(이하)
              <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
            </div>
            <div className="flex items-center rounded-xl" style={{ border: "1.5px solid #E4E7EB" }}>
              <input
                type="text"
                inputMode="numeric"
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "14px 0 14px 10px", fontSize: rem(14.5) }}
                value={formatPriceInput(hopePrice)}
                onChange={(e) => setHopePrice(e.target.value)}
                placeholder="30,000"
              />
              {/* 2026-09-29: "원"만 있어 개당인지 kg당인지 총액인지 알 수 없었음 → "원 / kg" 형식 선택 */}
              <select
                aria-label="희망 단가 기준"
                className="flex-shrink-0 outline-none"
                style={{ width: 84, border: "none", borderLeft: "1px solid #E4E7EB", padding: "14px 6px", fontSize: rem(13), fontWeight: 700, color: "#0B2540", background: "#FAFBFC", textAlign: "center", borderRadius: "0 12px 12px 0" }}
                value={priceUnit}
                onChange={(e) => {
                  setPriceUnit(e.target.value);
                  setPriceUnitTouched(true);
                }}
              >
                {PRICE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u === "총액" ? "원 (총액)" : `원 / ${u}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: "#0B2540" }}>
              인수 가능 지역
              <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
            </span>
            <button
              type="button"
              onClick={() => setRegions(allRegionsOn ? [] : [...mockRegions])}
              className="font-bold"
              style={{ fontSize: rem(12), color: "#E25100" }}
            >
              {allRegionsOn ? "선택 해제" : "전 지역 선택"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mockRegions.map((r) => {
              const picked = regions.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r)}
                  className="rounded-full font-bold"
                  style={{
                    padding: "8px 13px",
                    fontSize: rem(12.5),
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
          {/* 2026-09-26 (9): "전 지역 선택" 버튼과 이 캡션이 사실상 같은 말(둘 다
              region:null=전지역)이라 중복으로 읽힌다는 피드백 — 버튼이 이미 같은
              의미를 명시적 액션으로 제공하므로 캡션 제거. */}
        </div>

        <div>
          <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
            추가 요청
            <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
          </div>
          <textarea
            className="w-full rounded-xl outline-none resize-none"
            style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: rem(14), lineHeight: 1.55, height: 88 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="보관 조건, 인수 가능 시기, 결제 조건 등"
          />
        </div>

        {/* design-v2: 배경 틴트를 빼고 화이트로 — 주황 테두리/텍스트가 틴트 위에서
            흐릿해지던 문제 수정 (잠든재고 카드와 동일 패턴).
            2026-09-26 (12): 지역 선택 칩(선택됨)/CTA 버튼도 같은 굵은 주황
            테두리를 쓰다 보니 이 정적 안내 카드가 버튼처럼 보여 헷갈린다는
            피드백 — 테두리를 다른 정적 카드들과 같은 중립 회색으로 교체. */}
        <div className="flex items-center gap-3 rounded-2xl" style={{ background: "#fff", border: "1.5px solid #E4E7EB", padding: "15px 16px" }}>
          <img src="/images/manager.png" alt="점핑매니저" className="flex-shrink-0 rounded-xl bg-white" style={{ width: 46, height: 46, objectFit: "contain" }} />
          <span className="flex-1 min-w-0">
            <span className="block font-black" style={{ fontSize: rem(15), color: "#0B2540" }}>등록은 완전 무료</span>
            <span className="block font-bold mt-0.5 leading-relaxed" style={{ fontSize: rem(12.5), color: "#E25100" }}>
              매칭되면 점핑매니저가 먼저 연락드립니다
            </span>
          </span>
        </div>
      </div>

      {/* design-v2: 필수 항목(무엇을 찾으세요/연락처)만 채워도 바로 제출할 수 있는데,
          버튼이 폼 맨 아래 인라인으로만 있으면 선택 항목까지 스크롤해야 찾을 수
          있었음 — sell/page.tsx와 같은 이유로 하단 고정 처리.
          에러 메시지도 버튼 바로 위(고정 영역)로 옮김 — 필수 항목(무엇을 찾으세요/
          연락처)은 폼 맨 위에 있는데 버튼은 어디서든 누를 수 있어서, 에러가 폼 맨
          아래에 있으면 스크롤을 안 내린 사용자에게는 화면 밖이라 안 보이던 문제.
          bottom: 0으로 두면 AppShell의 fixed 하단 탭바(BottomNav, z-40)에
          이 영역이 가려서 탭바 높이만큼 띄워서 탭바 바로 위에 오도록 함.
          2026-09-26: position:sticky였는데 실제로는 전혀 안 떠 있던 버그 발견 —
          layout.tsx의 body/wrapper div가 overflow-x-hidden만 설정하고
          overflow-y를 안 정해서 overflow-y가 auto로 계산되는 CSS 스펙 동작 때문에
          그 div가 의도치 않은 sticky 기준 컨테이너가 됐는데, 그 div 자체는 항상
          컨텐츠에 딱 맞게 커져서(overflow-y:auto인데 실제로 넘치는 일이 없음)
          내부적으로 스크롤이 발생한 적이 없어 sticky가 아무 효과도 못 냄 — 버튼이
          그냥 폼 맨 끝에 있는 일반 엘리먼트처럼 렌더링됨(홈/마이페이지 CTA는 동일
          문제를 안 겪는 position:fixed라 정상 동작했음). fixed로 교체하고 위
          콘텐츠에 paddingBottom 132px(홈 CTA와 동일 수치)를 더해 가려지지 않게 함. */}
      {/* 2026-09-27: 홈 하단 CTA와 동일한 톤으로 통일 — 불투명 흰 바+실선 테두리
          대신 반투명+블러 카드 + 상단 페이드로, 스크롤 중인 폼 내용이 자연스럽게
          이어지도록 함. */}
      <div
        className="fixed z-10 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-5 pt-5"
        style={{ bottom: NAV_BOTTOM }}
      >
        <div
          className="pointer-events-none absolute left-0 right-0"
          style={{
            bottom: "100%",
            height: 28,
            background: "linear-gradient(to bottom, rgba(245,246,248,0), rgba(255,255,255,.85))",
          }}
        />
        <div
          className="rounded-2xl"
          style={{
            background: "rgba(255,255,255,.9)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 -6px 16px rgba(11,37,64,.07)",
            padding: 8,
          }}
        >
          {error && (
            <div className="text-sm text-orange font-medium mb-2 text-center">{error}</div>
          )}
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full font-black rounded-2xl text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#E25100,#FF6F0F)", padding: "17px 0", fontSize: rem(16.5), boxShadow: "0 8px 20px rgba(226,81,0,.3)" }}
          >
            {submitting ? "등록 중..." : "구매 희망 등록하기"}
          </button>
        </div>
      </div>
    </main>
  );
}
