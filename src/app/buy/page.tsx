"use client";

import { useState } from "react";
import Link from "next/link";
import { mockCategories, mockRegions, categoryIcons } from "@/lib/mockData";
import { formatPriceInput, parsePriceInput } from "@/lib/format";
import CategoryScroller from "@/components/CategoryScroller";

export default function BuyPage() {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [hopePrice, setHopePrice] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!productName || !contactPhone) {
      setError("찾는 품목과 연락처는 꼭 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/buy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          category: category || null,
          region: region || null,
          quantity: quantity || null,
          hopePrice: parsePriceInput(hopePrice) ?? null,
          contactPhone,
          description,
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("등록 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="flex flex-col items-center min-h-screen px-6 pt-20 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="font-display text-2xl text-navy mb-2">등록됐어요</h1>
        <p className="text-gray500 text-base leading-relaxed mb-6">
          점핑매니저가 확인 후, 조건에 맞는 판매자를 찾으면
          <br />
          입력하신 번호로 바로 연락드려요.
        </p>
        <div className="bg-gray100 rounded-2xl px-6 py-5 flex flex-col items-center gap-3">
          <img
            src="/images/manager.png"
            alt="점핑매니저"
            className="w-32 h-32 rounded-xl object-contain bg-white"
          />
          <p className="text-sm font-bold text-navy">점핑매니저가 소싱을 시도해드립니다.</p>
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
        <div className="text-xs font-bold tracking-widest" style={{ color: "#8FB4DB" }}>
          구매 희망 등록
        </div>
        <h1 className="font-display text-2xl mt-2 leading-snug">
          🔍 이런 재고 찾습니다
        </h1>
        <p className="text-white/80 text-sm mt-2">
          찾는 물건과 조건만 남기면, 점핑매니저가 맞는 판매자를 직접 찾아드려요.
        </p>
      </div>

      <div className="mx-5 mt-4 bg-white border border-gray200 rounded-2xl p-3 flex items-center gap-3.5">
        <img
          src="/images/manager.png"
          alt="점핑매니저"
          className="w-20 h-20 rounded-xl object-contain bg-white flex-shrink-0"
        />
        <p className="text-base font-bold text-navy leading-snug">
          점핑매니저가 판매자를 찾아드립니다.
        </p>
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-5">
        <div>
          <label className="text-sm font-bold text-navy mb-2 block">찾는 품목 *</label>
          <input
            className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
            style={{ height: "52px" }}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="예: 냉동 오징어"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
            카테고리
            <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
              선택
            </span>
          </label>
          <CategoryScroller className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {mockCategories.map((c) => {
              const picked = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(picked ? "" : c)}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-full border py-2 px-3.5 text-center"
                  style={
                    picked
                      ? { background: "#F2891F", borderColor: "#F2891F", color: "#fff" }
                      : { background: "#F5F6F8", borderColor: "#F5F6F8", color: "#1B3A5C" }
                  }
                >
                  <span className="text-lg leading-none">{categoryIcons[c]}</span>
                  <span className="text-sm font-bold leading-tight whitespace-nowrap">{c}</span>
                </button>
              );
            })}
          </CategoryScroller>
        </div>

        <div>
          <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
            희망 지역
            <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
              선택
            </span>
          </label>
          <CategoryScroller className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setRegion("")}
              className={`flex-shrink-0 text-sm py-2 px-4 rounded-full border-2 font-bold text-center whitespace-nowrap ${
                region === "" ? "bg-navy text-white border-navy" : "border-gray200 text-gray500"
              }`}
            >
              전국 가능
            </button>
            {mockRegions.map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`flex-shrink-0 text-sm py-2 px-4 rounded-full border-2 font-bold text-center whitespace-nowrap ${
                  region === r ? "bg-navy text-white border-navy" : "border-gray200 text-gray500"
                }`}
              >
                {r}
              </button>
            ))}
          </CategoryScroller>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
              희망 수량
              <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
                선택
              </span>
            </label>
            <input
              className="w-full border-2 border-gray200 rounded-xl px-4 text-base outline-none focus:border-orange"
              style={{ height: "52px" }}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="예: 300박스"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
              희망가(이하)
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
                placeholder="30,000"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray500 font-medium">
                원
              </span>
            </div>
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
            추가 조건
            <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
              선택
            </span>
          </label>
          <textarea
            className="w-full border-2 border-gray200 rounded-xl px-4 py-3 text-base outline-none focus:border-orange"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="유통기한 조건, 규격, 인증서 필요 여부 등"
          />
        </div>

        {error && <div className="text-sm text-orange font-medium">{error}</div>}
      </div>

      <div className="px-5 pb-6">
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full text-white font-bold rounded-2xl text-lg disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #D9531E, #F2891F)", padding: "18px 0" }}
        >
          {submitting ? "등록 중..." : "구매 희망 등록하기"}
        </button>
      </div>
    </main>
  );
}
