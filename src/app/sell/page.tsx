"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockCategories, mockRegions, categoryIcons, quantityUnits, guessCategory } from "@/lib/mockData";
import ImageUploader from "@/components/ImageUploader";
import VideoUploader from "@/components/VideoUploader";
import ManifestUploader from "@/components/ManifestUploader";
import { NAV_HEIGHT } from "@/components/BottomNav";
import { formatPriceInput, parsePriceInput } from "@/lib/format";
import { fromE164Phone, isValidKoreanPhone } from "@/lib/auth";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import type { ManifestRow } from "@/lib/parseCsv";

export default function SellPage() {
  const [companyName, setCompanyName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bonusPhotoSlots, setBonusPhotoSlots] = useState(0);

  // 로그인한 회원이면 인증된 번호를 미리 채워준다 — 대리 등록(다른 담당자
  // 연락처로 접수) 케이스가 있어서 수정은 그대로 허용한다.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setMemberId(userData.user.id);
      const { data: member } = await supabase
        .from("members")
        .select("phone, bonus_photo_slots")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (member?.phone) setContactPhone(fromE164Phone(member.phone));
      setBonusPhotoSlots(member?.bonus_photo_slots ?? 0);
    })();
  }, []);
  const [category, setCategory] = useState<string>("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [region, setRegion] = useState<string>("");
  const [productName, setProductName] = useState("");

  useEffect(() => {
    if (categoryTouched || !productName.trim()) return;
    const guessed = guessCategory(productName);
    if (guessed) setCategory(guessed);
  }, [productName, categoryTouched]);
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState(quantityUnits[0]);
  const [minOrderQty, setMinOrderQty] = useState("");
  const [hopePrice, setHopePrice] = useState("");
  const [hopeDurationHours, setHopeDurationHours] = useState("24");
  const [description, setDescription] = useState("");
  const [packageUnit, setPackageUnit] = useState("");
  const [origin, setOrigin] = useState("");
  const [spec, setSpec] = useState("");
  const [storageCondition, setStorageCondition] = useState("");
  const [pid, setPid] = useState(""); // 2026-09-26: 리퀴데이션 팔레트 등의 매니페스트/PID 번호 (선택)
  const [manifestItems, setManifestItems] = useState<ManifestRow[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const submit = async () => {
    setError(null);
    if (!productName || !quantity || !contactPhone) {
      setError("매물명 · 수량 · 연락처는 꼭 입력해주세요.");
      return;
    }
    if (!isValidKoreanPhone(contactPhone)) {
      setError("올바른 휴대폰 번호를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName || null,
          isAnonymous,
          memberId,
          contactName: contactName || null,
          contactPhone,
          category: category || null,
          region: region || null,
          productName,
          quantity: Number(quantity),
          quantityUnit,
          minOrderQty: minOrderQty ? Number(minOrderQty) : null,
          hopePrice: parsePriceInput(hopePrice) ?? null,
          hopeDurationHours: hopeDurationHours ? Number(hopeDurationHours) : null,
          description,
          packageUnit: packageUnit || null,
          origin: origin || null,
          spec: spec || null,
          storageCondition: storageCondition || null,
          pid: pid || null,
          manifestItems: manifestItems.length ? manifestItems : null,
          images,
          videoUrl,
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("신청 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="flex flex-col min-h-screen">
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4.5" style={{ borderBottom: "1px solid #EEF0F2" }}>
          <Link href="/" className="text-gray500" style={{ fontSize: 19 }}>←</Link>
          {/* 2026-09-26: 탭 화면마다 로고 유무가 달라 브랜드 인지가 끊긴다는 피드백 —
              모든 하단탭 화면 헤더에 작은 로고를 공통으로 배치. */}
          <img src="/images/logo.png" alt="덤핑점핑" className="w-6 h-6 rounded-md flex-shrink-0 object-contain" />
          <span className="font-black" style={{ fontSize: 17, color: "#0B2540", letterSpacing: "-0.02em" }}>
            재고 판매 등록
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-6" style={{ paddingTop: 36 }}>
          <CheckCircle className="w-12 h-12 mb-4 text-verified" />
          <h1 className="font-display text-2xl text-navy mb-2">신청이 접수됐어요</h1>
          <p className="text-gray500 text-base leading-relaxed mb-6">
            점핑매니저가 검토 후 24시간 이내에
            <br />
            입력하신 번호로 연락드려요.
          </p>
          <div className="bg-gray100 rounded-2xl px-6 py-5 flex flex-col items-center gap-3">
            <img
              src="/images/manager.png"
              alt="점핑매니저"
              className="w-32 h-32 rounded-xl object-contain bg-white"
            />
            <p className="text-sm font-bold text-navy">점핑매니저가 바로 연락드립니다.</p>
          </div>

          {memberId && (
            <Link
              href="/mypage#referral"
              className="w-full block text-left rounded-2xl mt-4"
              style={{ background: "#FFF9EC", border: "1px solid #F0DCA8", padding: "13px 15px" }}
            >
              <p className="text-xs font-bold" style={{ color: "#8A6100" }}>
                🎁 친구 추천하면 나도 친구도 사진 슬롯 +2장 (최대 6장까지)
              </p>
              <p className="text-xs mt-1" style={{ color: "#8A6100" }}>추천 링크 보내러 가기 →</p>
            </Link>
          )}

          <Link
            href="/"
            className="w-full block text-center font-bold rounded-2xl text-white mt-5"
            style={{ background: "#0B2540", padding: "15px 0", fontSize: 15 }}
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
          원래부터 헤더 자체가 다크 히어로라 이 문제가 없었음). 수수료 배지는
          네이비 배경 위에서도 눈에 띄도록 네이버 연두색(#03C75A) 솔리드로 교체. */}
      <div className="flex-shrink-0" style={{ background: "var(--color-navy)" }}>
        <div className="flex items-center gap-3 px-5 py-4.5">
          <Link href="/" style={{ fontSize: 19, color: "rgba(255,255,255,0.8)" }}>←</Link>
          <div className="bg-white rounded-lg px-1.5 py-1 flex-shrink-0">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-5 w-auto block" />
          </div>
          <span className="font-black" style={{ fontSize: 17, color: "#fff", letterSpacing: "-0.02em" }}>
            재고 판매 등록
          </span>
          {/* 2026-09-26 (3): 흰 글자+#03C75A 배경은 2.25:1로 11px 텍스트 기준(4.5:1)
              미달 — 네이비 글자로 바꿔 6.89:1 확보. */}
          <span className="ml-auto font-bold rounded-full" style={{ fontSize: 11, color: "#0B2540", background: "#03C75A", padding: "5px 10px" }}>
            수수료 0원
          </span>
        </div>
        <div className="flex items-center justify-center" style={{ padding: "9px 20px" }}>
          <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
        </div>
      </div>

      <div className="flex-1 px-5 py-4.5 flex flex-col gap-4.5" style={{ paddingBottom: 132 }}>
        <div className="flex items-center gap-3 rounded-2xl" style={{ background: "#EEF1F5", padding: "13px 15px" }}>
          <img src="/images/manager.png" alt="점핑매니저" className="flex-shrink-0" style={{ width: 44, height: 44, objectFit: "contain" }} />
          <p className="leading-snug" style={{ fontSize: 12.5, color: "#0B2540", fontWeight: 500 }}>
            신청서를 검토한 뒤 점핑매니저가 직접 연락드려요.
          </p>
        </div>

        <div>
          <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>매물 제목</div>
          <input
            className="w-full rounded-xl outline-none"
            style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 14.5 }}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="예: 국내산 갈치 20kg 박스"
          />
        </div>

        <div>
          <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>카테고리</div>
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
                  }}
                  className="flex items-center gap-1 rounded-full whitespace-nowrap flex-shrink-0"
                  style={{
                    padding: "9px 13px",
                    fontSize: 13,
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
        </div>

        <div className="flex gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>수량</div>
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB" }}>
              <input
                type="number"
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "14px 10px", fontSize: 14.5 }}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="55"
              />
              <select
                className="flex-shrink-0 outline-none"
                style={{ width: 74, border: "none", borderLeft: "1px solid #E4E7EB", padding: "14px 8px", fontSize: 13, fontWeight: 700, color: "#0B2540", background: "#FAFBFC", textAlign: "center" }}
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
              >
                {quantityUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>희망 단가(원)</div>
            <div className="flex items-center rounded-xl" style={{ border: "1.5px solid var(--color-brandOrange)" }}>
              <input
                type="text"
                inputMode="numeric"
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "14px 0 14px 10px", fontSize: 14.5 }}
                value={formatPriceInput(hopePrice)}
                onChange={(e) => setHopePrice(e.target.value)}
                placeholder="219,000"
              />
              <span className="flex-shrink-0 text-sm font-bold" style={{ color: "#6B7480", padding: "0 12px" }}>원</span>
            </div>
          </div>
        </div>
        <p className="text-xs -mt-3" style={{ color: "#6B7480" }}>
          창고에서 직접 가져가는 가격 기준이에요 (배송비 별도).
        </p>

        <div>
          <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>연락처</div>
          <input
            className="w-full rounded-xl outline-none"
            style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 14.5 }}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="010-0000-0000"
          />
        </div>

        <div>
          <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
            최소주문수량(MOQ)
            <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
          </div>
          <div className="flex items-center rounded-xl" style={{ border: "1.5px solid #E4E7EB" }}>
            <input
              type="number"
              className="flex-1 min-w-0 outline-none"
              style={{ border: "none", padding: "14px 0 14px 14px", fontSize: 14.5 }}
              value={minOrderQty}
              onChange={(e) => setMinOrderQty(e.target.value)}
              placeholder="예: 5"
            />
            <span className="flex-shrink-0 text-sm font-medium" style={{ color: "#6B7480", padding: "0 14px" }}>{quantityUnit} 이상</span>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>마감까지</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "3", l: "3시간" },
              { v: "12", l: "12시간" },
              { v: "24", l: "24시간" },
              { v: "72", l: "3일" },
              { v: "168", l: "7일" },
              { v: "", l: "점핑매니저와 협의" },
            ].map((opt) => {
              const picked = hopeDurationHours === opt.v;
              return (
                <button
                  key={opt.l}
                  onClick={() => setHopeDurationHours(opt.v)}
                  className="font-bold rounded-xl"
                  style={{
                    padding: "12px 14px",
                    fontSize: 13,
                    background: "#fff",
                    border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                    color: "#1A1F26",
                  }}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-2" style={{ color: "#6B7480" }}>
            여기서 정한 시간이 구매자에게 보이는 마감 카운트다운 기준이 돼요.
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl" style={{ background: "#F5F6F8", padding: "14px 16px" }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <span className="flex-1" style={{ fontSize: 12.5, color: "#0B2540", lineHeight: 1.5, fontWeight: 500 }}>
            점핑매니저 검토 후, 이 조건 알림을 받는 회원들에게 바로 발송돼요.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center justify-between border-2 border-gray200 rounded-xl px-4 text-sm font-bold text-navy"
          style={{ height: "52px" }}
        >
          상세 정보 추가 (선택)
          <span className="text-gray500">{showDetails ? "접기 ▴" : "펼치기 ▾"}</span>
        </button>
        {!showDetails && (
          <p className="text-xs text-gray500 -mt-3">
            없어도 등록돼요, 매니저가 통화로 확인해요.
          </p>
        )}

        {showDetails && (
          <div className="flex flex-col gap-5 border-2 border-gray200 rounded-2xl p-4">
            <ImageUploader onChange={setImages} max={4 + bonusPhotoSlots} />

            <VideoUploader onChange={setVideoUrl} />

            <div>
              <label className="text-sm font-bold text-navy mb-2 block">업체명</label>
              <input
                className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                style={{ height: "52px" }}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="예: 웰컴코리아(주)"
              />
              <label className="flex items-start gap-2.5 rounded-xl mt-2.5" style={{ background: "#F5F6F8", padding: "12px 14px" }}>
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-gray500">
                  <span className="font-bold text-navy">업체명 비공개로 등록</span>
                  <br />
                  체크하면 구매자에게는 업체명 대신 임의 표시명이 노출돼요(거래처·경쟁사 노출 걱정 없이 등록 가능). 점핑매니저에게는 항상 실제 업체명이 보여요.
                </span>
              </label>
            </div>

            <div>
              <label className="text-sm font-bold text-navy mb-2 block">담당자명</label>
              <input
                className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                style={{ height: "52px" }}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="홍길동"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-navy mb-1 block">재고 위치(지역)</label>
              <p className="text-xs text-gray500 mb-2">
                물건이 실제로 있는 지역이에요 — 이 지역 알림을 신청한 회원에게 알림이 가요.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {mockRegions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegion(region === r ? "" : r)}
                    className={`text-sm py-2.5 rounded-full border-2 font-bold text-center ${
                      region === r ? "bg-[#FF6F0F] text-white border-[#FF6F0F]" : "border-gray200 text-gray500"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-base font-bold text-navy mb-2 block">상품 상세 스펙</label>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-gray500 mb-1 block">포장 단위 (예: 20kg 박스)</label>
                  <input
                    className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                    style={{ height: "52px" }}
                    value={packageUnit}
                    onChange={(e) => setPackageUnit(e.target.value)}
                    placeholder="20kg 박스"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray500 mb-1 block">규격/사이즈 (예: 500ml)</label>
                  <input
                    className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                    style={{ height: "52px" }}
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    placeholder="500ml, S~L 혼합"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray500 mb-1 block">원산지</label>
                  <input
                    className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                    style={{ height: "52px" }}
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="국내산, 중국산 등"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray500 mb-1 block">보관조건 · 유통기한</label>
                  <input
                    className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                    style={{ height: "52px" }}
                    value={storageCondition}
                    onChange={(e) => setStorageCondition(e.target.value)}
                    placeholder="냉동보관, 소비기한 5일"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-navy mb-2 block">추가 설명</label>
              <textarea
                className="w-full border-2 border-gray200 rounded-xl px-4 py-3 text-base outline-none focus:border-orange"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="그 밖에 알려주실 내용"
              />
            </div>

            {/* 2026-09-26: 폐업 정리 등으로 여러 품목이 한 팔레트에 섞인 "혼합매물" 대응 —
                개별 사진 없이 PID/매니페스트 번호 + CSV 목록만으로도 등록할 수 있게. */}
            <div>
              <label className="text-sm font-bold text-navy mb-2 block">PID / 매니페스트 번호 (선택)</label>
              <input
                className="w-full border-2 border-gray200 rounded-xl px-4 py-3 text-base outline-none focus:border-orange"
                value={pid}
                onChange={(e) => setPid(e.target.value)}
                placeholder="예: P809200159651 (리퀴데이션 팔레트라면 적어주세요)"
              />
            </div>
            <ManifestUploader onChange={setManifestItems} />
          </div>
        )}
      </div>

      {/* design-v2: 필수 항목(제목/수량/연락처)만 채워도 바로 제출할 수 있는데,
          버튼이 폼 맨 아래 인라인으로만 있으면 상세정보까지 스크롤해야 찾을 수
          있었음 — signup 1단계와 같은 이유로 하단 고정 처리.
          에러 메시지도 버튼 바로 위(고정 영역)로 옮김 — 필수 항목(제목/수량/연락처)은
          폼 맨 위에 있는데 버튼은 어디서든 누를 수 있어서, 에러가 상세정보 섹션
          근처에 있으면 스크롤을 안 내린 사용자에게는 화면 밖이라 안 보이던 문제.
          bottom: 0으로 두면 AppShell의 fixed 하단 탭바(BottomNav, z-40)에
          이 영역이 가려서 탭바 높이만큼 띄워서 탭바 바로 위에 오도록 함.
          2026-09-26: position:sticky였는데 실제로는 전혀 안 떠 있던 버그 발견
          (buy/page.tsx와 동일 원인 — layout.tsx의 overflow-x-hidden 단독 설정이
          overflow-y:auto로 계산되면서 의도치 않은 sticky 기준 컨테이너가 됐는데
          그 컨테이너 자체는 내부 스크롤이 발생한 적이 없어 sticky가 무력화됨).
          fixed로 교체하고 위 콘텐츠에 paddingBottom 132px 추가. */}
      <div
        className="fixed z-10 left-1/2 -translate-x-1/2 w-full max-w-md"
        style={{ bottom: NAV_HEIGHT, padding: "14px 20px 20px", borderTop: "1px solid #EEF0F2", background: "#fff" }}
      >
        {error && (
          <div className="text-sm text-orange font-medium mb-2.5 text-center">{error}</div>
        )}
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full font-black rounded-2xl text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#E25100,#FF6F0F)", padding: "17px 0", fontSize: 16.5, boxShadow: "0 8px 20px rgba(226,81,0,.3)" }}
        >
          {submitting ? "처리 중..." : "무료로 매물 등록하기"}
        </button>
      </div>
    </main>
  );
}
