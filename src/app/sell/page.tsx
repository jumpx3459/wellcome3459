"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { mockCategories, mockRegions, categoryIcons, categoryColors, quantityUnits } from "@/lib/mockData";
import ImageUploader from "@/components/ImageUploader";
import VideoUploader from "@/components/VideoUploader";
import { formatPriceInput, parsePriceInput } from "@/lib/format";

export default function SellPage() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [category, setCategory] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [productName, setProductName] = useState("");
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
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName || null,
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
      <main className="flex flex-col items-center min-h-screen px-6 pt-20 text-center">
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
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-8 pb-6 text-white"
        style={{ background: "linear-gradient(135deg, #0B2540, #1B3A5C)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Link href="/" className="bg-white rounded-lg px-3.5 py-2.5 inline-block">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
          </Link>
          <span className="text-white/70 text-sm tracking-wide">Powered by JumpX</span>
        </div>
        <div className="text-xs font-bold tracking-widest" style={{ color: "#FFD166" }}>
          판매자 신청
        </div>
        <h1 className="font-display text-2xl mt-2 leading-snug">
          처분이 급한 덤핑재고,
          <br />
          여기서 알려보세요
        </h1>
        <p className="text-white/80 text-sm mt-2">
          신청서를 검토한 뒤 점핑매니저가 직접 연락드려요.
        </p>
      </div>

      <div className="mx-5 mt-4 bg-white border border-gray200 rounded-2xl p-3 flex items-center gap-3.5">
        <img
          src="/images/manager.png"
          alt="점핑매니저"
          className="w-20 h-20 rounded-xl object-contain bg-white flex-shrink-0"
        />
        <p className="text-base font-bold text-navy leading-snug">
          점핑매니저가 바로 연락드립니다.
        </p>
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-5">
        <div>
          <label className="text-sm font-bold text-navy mb-2 block">매물명 *</label>
          <input
            className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
            style={{ height: "52px" }}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="예: 국내산 갈치 20kg 박스"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-navy mb-2 block">수량 *</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 min-w-0 border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
              style={{ height: "52px" }}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="55"
            />
            <select
              className="border-2 border-gray200 rounded-xl px-3 text-base outline-none focus:border-orange"
              style={{ height: "52px", width: "96px" }}
              value={quantityUnit}
              onChange={(e) => setQuantityUnit(e.target.value)}
            >
              {quantityUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-navy mb-2 block">연락처 *</label>
          <input
            className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
            style={{ height: "52px" }}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="010-0000-0000"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
            희망 단가 (창고 출고가)
            <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
              선택
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              className="w-full border-2 border-gray200 rounded-xl pl-4 pr-10 text-base outline-none focus:border-orange"
              style={{ height: "52px" }}
              value={formatPriceInput(hopePrice)}
              onChange={(e) => setHopePrice(e.target.value)}
              placeholder="219,000"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray500 font-medium">
              원
            </span>
          </div>
          <p className="text-xs text-gray500 mt-2">
            창고에서 직접 가져가는 가격 기준이에요. 배송비는 별도예요.
          </p>
        </div>

        <div>
          <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
            최소주문수량(MOQ)
            <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
              선택
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
              style={{ height: "52px" }}
              value={minOrderQty}
              onChange={(e) => setMinOrderQty(e.target.value)}
              placeholder="예: 5"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray500 font-medium">
              {quantityUnit} 이상
            </span>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
            언제까지 판매를 원하세요?
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "3", l: "3시간" },
              { v: "12", l: "12시간" },
              { v: "24", l: "하루" },
              { v: "72", l: "3일" },
              { v: "168", l: "일주일" },
              { v: "", l: "점핑매니저와 협의" },
            ].map((opt) => (
              <button
                key={opt.l}
                onClick={() => setHopeDurationHours(opt.v)}
                className={`text-sm px-4 py-2.5 rounded-full border-2 font-bold ${
                  hopeDurationHours === opt.v
                    ? "bg-navy text-white border-navy"
                    : "border-gray200 text-gray500"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray500 mt-2">
            실제 재고 상황에 맞게 선택해주세요. 여기서 정한 시간이 구매자에게 보이는 마감 카운트다운 기준이 돼요.
          </p>
        </div>

        {error && <div className="text-sm text-orange font-medium">{error}</div>}

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
            <div>
              <label className="text-sm font-bold text-navy mb-2 block">업체명</label>
              <input
                className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
                style={{ height: "52px" }}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="예: 웰컴코리아(주)"
              />
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
              <label className="text-base font-bold text-navy mb-2 block">카테고리</label>
              <div className="grid grid-cols-3 gap-2">
                {mockCategories.map((c) => {
                  const picked = category === c;
                  const color = categoryColors[c];
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(picked ? "" : c)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border py-3.5 px-1 text-center"
                      style={
                        picked
                          ? { background: color.solid, borderColor: color.solid, color: "#fff" }
                          : { background: color.bg, borderColor: color.bg, color: color.text }
                      }
                    >
                      <span className="text-2xl leading-none">{categoryIcons[c]}</span>
                      <span className="text-sm font-bold leading-tight">{c}</span>
                    </button>
                  );
                })}
              </div>
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
                      region === r ? "bg-navy text-white border-navy" : "border-gray200 text-gray500"
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

            <ImageUploader onChange={setImages} />

            <VideoUploader onChange={setVideoUrl} />
          </div>
        )}
      </div>

      <div className="px-5 pb-6">
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full text-white font-bold rounded-2xl text-lg disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #D9531E, #F2891F)", padding: "18px 0" }}
        >
          {submitting ? "처리 중..." : "등록 신청하기"}
        </button>
      </div>
    </main>
  );
}
