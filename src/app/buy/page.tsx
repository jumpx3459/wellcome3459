"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { mockCategories, mockRegions, categoryIcons, quantityUnits, guessCategory } from "@/lib/mockData";
import { formatPriceInput, parsePriceInput } from "@/lib/format";
import { isValidKoreanPhone, fromE164Phone } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function BuyPage() {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState(quantityUnits[0]);
  const [hopePrice, setHopePrice] = useState("");
  const [contactPhone, setContactPhone] = useState("");
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
      if (member?.phone) setContactPhone(fromE164Phone(member.phone));
    })();
  }, []);

  useEffect(() => {
    if (categoryTouched || !productName.trim()) return;
    const guessed = guessCategory(productName);
    if (guessed) setCategory(guessed);
  }, [productName, categoryTouched]);

  const allRegionsOn = regions.length === mockRegions.length;
  const toggleRegion = (r: string) => setRegions((prev) => (prev.includes(r) ? prev.filter((v) => v !== r) : [...prev, r]));

  const submit = async () => {
    setError(null);
    if (!productName || !contactPhone) {
      setError("찾는 품목과 연락처는 꼭 입력해주세요.");
      return;
    }
    if (!isValidKoreanPhone(contactPhone)) {
      setError("올바른 휴대폰 번호를 입력해주세요.");
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
          region: regions.length > 0 && !allRegionsOn ? regions.join(", ") : null,
          quantity: quantity ? `${quantity}${quantityUnit}` : null,
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
    const summary = [
      category || "전체 카테고리",
      productName || "찾는 재고",
      quantity ? `${quantity}${quantityUnit} 이상` : null,
      hopePrice ? `${formatPriceInput(hopePrice)}원 이하` : null,
      allRegionsOn || regions.length === 0 ? "전 지역" : regions.join("·"),
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <main className="flex flex-col min-h-screen">
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4.5" style={{ borderBottom: "1px solid #EEF0F2" }}>
          <Link href="/" className="text-gray500" style={{ fontSize: 19 }}>←</Link>
          <span className="font-black" style={{ fontSize: 20, color: "#0B2540", letterSpacing: "-0.02em" }}>
            이런 재고 찾습니다
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-6" style={{ paddingTop: 40 }}>
          <CheckCircle className="w-12 h-12 mb-4 text-verified" />
          <h1 className="font-display text-2xl text-navy mb-2">구매 희망 등록 완료!</h1>
          <p className="text-gray500 text-base leading-relaxed mb-6">
            점핑매니저가 전국 재고를 뒤져서
            <br />
            조건에 맞는 매물이 나오면 바로 알려드릴게요.
          </p>
          <div className="w-full text-left rounded-2xl" style={{ background: "#F5F6F8", padding: "14px 16px" }}>
            <div className="text-xs font-bold" style={{ color: "#6B7480" }}>등록한 조건</div>
            <div className="font-bold mt-1.5 leading-relaxed" style={{ fontSize: 14, color: "#0B2540" }}>{summary}</div>
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
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4.5" style={{ borderBottom: "1px solid #EEF0F2" }}>
        <Link href="/" className="text-gray500" style={{ fontSize: 19 }}>←</Link>
        <span className="font-black" style={{ fontSize: 20, color: "#0B2540", letterSpacing: "-0.02em" }}>
          이런 재고 찾습니다
        </span>
      </div>

      <div className="flex-1 px-5 py-4.5 flex flex-col gap-4.5">
        <div className="flex items-center gap-3 rounded-2xl" style={{ background: "#EEF1F5", padding: "13px 15px" }}>
          <img src="/images/manager.png" alt="점핑매니저" className="flex-shrink-0" style={{ width: 44, height: 44, objectFit: "contain" }} />
          <p className="leading-snug" style={{ fontSize: 12.5, color: "#0B2540", fontWeight: 500 }}>
            찾는 재고를 올려두면 점핑매니저가 매입처를 직접 찾아 연결해드려요.
          </p>
        </div>

        <div>
          <div className="text-sm font-bold mb-2" style={{ color: "#0B2540" }}>무엇을 찾으세요?</div>
          <input
            className="w-full rounded-xl outline-none"
            style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 14.5 }}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="예: 냉동 삼겹살 500kg 이상"
          />
        </div>

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
            카테고리
            <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
          </div>
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
            <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
              희망 수량
              <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
            </div>
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB" }}>
              <input
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "14px 10px", fontSize: 14.5 }}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="500"
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
            <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
              희망 단가(이하)
              <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
            </div>
            <div className="flex items-center rounded-xl" style={{ border: "1.5px solid #E4E7EB" }}>
              <input
                type="text"
                inputMode="numeric"
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "14px 0 14px 10px", fontSize: 14.5 }}
                value={formatPriceInput(hopePrice)}
                onChange={(e) => setHopePrice(e.target.value)}
                placeholder="30,000"
              />
              <span className="flex-shrink-0 text-sm font-bold" style={{ color: "#6B7480", padding: "0 12px" }}>원</span>
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
              style={{ fontSize: 12, color: "#E25100" }}
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
                    fontSize: 12.5,
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
          <p className="text-xs mt-1.5" style={{ color: "#6B7480" }}>선택 안 하면 전국 어디든 괜찮다는 뜻이에요</p>
        </div>

        <div>
          <div className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#0B2540" }}>
            추가 요청
            <span className="text-xs font-bold" style={{ color: "#6B7480" }}>(선택)</span>
          </div>
          <textarea
            className="w-full rounded-xl outline-none resize-none"
            style={{ border: "1.5px solid #E4E7EB", padding: 14, fontSize: 14, lineHeight: 1.55, height: 88 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="보관 조건, 인수 가능 시기, 결제 조건 등"
          />
        </div>

        {/* design-v2: 배경 틴트를 빼고 화이트로 — 주황 테두리/텍스트가 틴트 위에서
            흐릿해지던 문제 수정 (잠든재고 카드와 동일 패턴). */}
        <div className="flex items-center gap-3 rounded-2xl" style={{ background: "#fff", border: "2px solid var(--color-brandOrange)", padding: "15px 16px" }}>
          <img src="/images/manager.png" alt="점핑매니저" className="flex-shrink-0 rounded-xl bg-white" style={{ width: 46, height: 46, objectFit: "contain" }} />
          <span className="flex-1 min-w-0">
            <span className="block font-black" style={{ fontSize: 15, color: "#0B2540" }}>등록은 완전 무료</span>
            <span className="block font-bold mt-0.5 leading-relaxed" style={{ fontSize: 12.5, color: "#E25100" }}>
              매칭되면 점핑매니저가 먼저 연락드립니다
            </span>
          </span>
        </div>

        {error && <div className="text-sm text-orange font-medium">{error}</div>}
      </div>

      {/* design-v2: 필수 항목(무엇을 찾으세요/연락처)만 채워도 바로 제출할 수 있는데,
          버튼이 폼 맨 아래 인라인으로만 있으면 선택 항목까지 스크롤해야 찾을 수
          있었음 — sell/page.tsx와 같은 이유로 sticky bottom 처리. */}
      <div
        className="sticky bottom-0 z-10"
        style={{ padding: "14px 20px 20px", borderTop: "1px solid #EEF0F2", background: "#fff" }}
      >
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full font-black rounded-2xl text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#E25100,#FF6F0F)", padding: "17px 0", fontSize: 16.5, boxShadow: "0 8px 20px rgba(226,81,0,.3)" }}
        >
          {submitting ? "등록 중..." : "구매 희망 등록하기"}
        </button>
      </div>
    </main>
  );
}
