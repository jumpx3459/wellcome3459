"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPriceInput, parsePriceInput } from "@/lib/format";

// 환율 계산기에서 지원하는 통화 목록 (B2B 소싱에서 실사용 빈도가 높은 순)
const CURRENCIES = [
  { code: "USD", label: "미국 달러", flag: "🇺🇸" },
  { code: "CNY", label: "중국 위안", flag: "🇨🇳" },
  { code: "JPY", label: "일본 엔 (100엔)", flag: "🇯🇵" },
  { code: "EUR", label: "유럽 유로", flag: "🇪🇺" },
];

// 관세율 프리셋 — 정확한 세율은 품목별 HS코드에 따라 다르므로 참고용 기본값만 제공
const TARIFF_PRESETS = [
  { label: "식품/농수산", rate: 8 },
  { label: "의류/잡화", rate: 13 },
  { label: "전자제품", rate: 0 },
  { label: "직접 입력", rate: null },
];

// 물류 날씨용 17개 지역 대표 좌표 (도청/시청 소재지 기준)
const REGION_COORDS: Record<string, { lat: number; lon: number }> = {
  서울: { lat: 37.5665, lon: 126.978 },
  부산: { lat: 35.1796, lon: 129.0756 },
  대구: { lat: 35.8714, lon: 128.6014 },
  인천: { lat: 37.4563, lon: 126.7052 },
  광주: { lat: 35.1595, lon: 126.8526 },
  대전: { lat: 36.3504, lon: 127.3845 },
  울산: { lat: 35.5384, lon: 129.3114 },
  세종: { lat: 36.48, lon: 127.289 },
  경기: { lat: 37.4138, lon: 127.5183 },
  강원: { lat: 37.8228, lon: 128.1555 },
  충북: { lat: 36.6357, lon: 127.4913 },
  충남: { lat: 36.6588, lon: 126.6728 },
  전북: { lat: 35.7175, lon: 127.153 },
  전남: { lat: 34.8161, lon: 126.4629 },
  경북: { lat: 36.4919, lon: 128.8889 },
  경남: { lat: 35.4606, lon: 128.2132 },
  제주: { lat: 33.4996, lon: 126.5312 },
};

// WMO 날씨 코드를 아이콘/한글 라벨로 변환 (Open-Meteo 기준)
function weatherInfo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "맑음" };
  if ([1, 2].includes(code)) return { icon: "🌤", label: "대체로 맑음" };
  if (code === 3) return { icon: "☁️", label: "흐림" };
  if ([45, 48].includes(code)) return { icon: "🌫", label: "안개" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦", label: "이슬비" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "🌧", label: "비" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: "❄️", label: "눈" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈", label: "뇌우" };
  return { icon: "🌡", label: "-" };
}

const TABS = [
  { key: "shipping", label: "🚚 운송 매칭" },
  { key: "pallet", label: "📐 팔레트 적재" },
  { key: "weather", label: "🌤 물류 날씨" },
  { key: "fx", label: "💱 환율" },
  { key: "tariff", label: "📦 관부가세" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// 점핑전국물류 전용 보조 브랜드 컬러 (덤핑점핑 본체의 네이비/오렌지와 구분되는 틸 계열)
const TEAL = "#0E7490";
const TEAL_LIGHT = "#5EEAD4";

const TAB_KEYS = TABS.map((t) => t.key) as readonly string[];

export default function LogisticsPage() {
  return (
    <Suspense fallback={null}>
      <LogisticsPageInner />
    </Suspense>
  );
}

function LogisticsPageInner() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: TabKey =
    requestedTab && TAB_KEYS.includes(requestedTab) ? (requestedTab as TabKey) : "shipping";
  const [tab, setTab] = useState<TabKey>(initialTab);

  return (
    <main className="flex flex-col min-h-screen">
      <div
        className="px-5 pt-5 pb-4 text-white"
        style={{ background: "linear-gradient(135deg, #0B2540, #123A4A)" }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Link href="/" className="bg-white rounded-lg px-3 py-2 inline-block">
            <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
          </Link>
          <span className="text-white/70 text-xs tracking-wide">Powered by JumpX</span>
        </div>
        <h1 className="font-display text-[22px] leading-tight">점핑전국물류</h1>
        <p className="text-white/70 text-xs mt-1.5 leading-relaxed">
          소싱부터 배송까지, 물류 실무 도구를 한 곳에 모았어요.
        </p>
      </div>

      <div className="px-5 pt-5 relative">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="text-[13px] font-bold rounded-full px-4 py-2.5 whitespace-nowrap transition-colors"
              style={
                tab === t.key
                  ? { background: TEAL, color: "#fff" }
                  : { background: "#F5F6F8", color: "#6B7480" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          className="pointer-events-none absolute right-0 top-5 bottom-1 w-10"
          style={{ background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.95))" }}
        />
      </div>

      <div className="flex-1 px-5 py-5">
        {tab === "fx" && <FxCalculator />}
        {tab === "tariff" && <TariffCalculator />}
        {tab === "weather" && <WeatherWidget />}
        {tab === "pallet" && <PalletCalculator />}
        {tab === "shipping" && <ShippingMatchTeaser />}
      </div>
    </main>
  );
}

// ── 환율 계산기 ────────────────────────────────────────────────
function FxCalculator() {
  const [currency, setCurrency] = useState("USD");
  const [amountRaw, setAmountRaw] = useState("1,000");
  const [rate, setRate] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`https://api.frankfurter.app/latest?from=${currency}&to=KRW`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const raw = data?.rates?.KRW;
        if (!raw) throw new Error("no rate");
        setRate(currency === "JPY" ? raw * 100 : raw);
        setUpdatedAt(data.date);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [currency]);

  const amount = parsePriceInput(amountRaw) ?? 0;
  const converted = rate ? Math.round(amount * rate) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-sm font-bold text-navy mb-2 block">통화 선택</label>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className="flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left"
              style={
                currency === c.code
                  ? { borderColor: TEAL, background: TEAL, color: "#fff" }
                  : { borderColor: "#E4E7EB", color: "#1A1F26" }
              }
            >
              <span className="text-xl">{c.flag}</span>
              <div>
                <div className="text-sm font-bold leading-tight">{c.code}</div>
                <div
                  className="text-[11px] leading-tight"
                  style={{ color: currency === c.code ? "rgba(255,255,255,0.7)" : "#6B7480" }}
                >
                  {c.label}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-navy mb-2 block">금액 ({currency})</label>
        <input
          type="text"
          inputMode="numeric"
          value={amountRaw}
          onChange={(e) => setAmountRaw(formatPriceInput(e.target.value))}
          className="w-full border-2 border-gray200 rounded-xl px-4 py-3.5 text-lg font-bold text-navy focus:outline-none focus:border-navy"
          placeholder="1,000"
        />
      </div>

      <div className="rounded-2xl px-5 py-5" style={{ background: "#F5F6F8" }}>
        {loading ? (
          <div className="text-center text-gray500 text-sm py-4">환율 조회 중...</div>
        ) : error ? (
          <div className="text-center text-sm py-4" style={{ color: "#C2410C" }}>
            환율 조회에 실패했어요. 잠시 후 다시 시도해주세요.
          </div>
        ) : (
          <>
            <div className="text-xs font-bold text-gray500 mb-1">예상 원화 환산액</div>
            <div className="font-display text-3xl text-navy">
              {converted !== null ? converted.toLocaleString("ko-KR") : "-"}원
            </div>
            <div className="text-xs text-gray500 mt-2">
              1 {currency} ≈ {rate?.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원
              {currency === "JPY" && " (100엔 기준)"} · {updatedAt} 기준
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-gray500 leading-relaxed">
        ※ 실시간 매매기준율이며, 실제 송금·결제 시 은행/카드사 수수료가 추가로 붙을 수 있어요.
      </p>
    </div>
  );
}

// ── 관부가세 계산기 ────────────────────────────────────────────
function TariffCalculator() {
  const [priceRaw, setPriceRaw] = useState("1,000,000");
  const [freightRaw, setFreightRaw] = useState("100,000");
  const [tariffRate, setTariffRate] = useState<number>(8);
  const [customRate, setCustomRate] = useState("8");
  const [includeVat, setIncludeVat] = useState(true);

  const price = parsePriceInput(priceRaw) ?? 0;
  const freight = parsePriceInput(freightRaw) ?? 0;
  const cif = price + freight;
  const tariff = Math.round((cif * tariffRate) / 100);
  const vatBase = cif + tariff;
  const vat = includeVat ? Math.round(vatBase * 0.1) : 0;
  const totalTax = tariff + vat;
  const totalCost = cif + totalTax;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-bold text-navy mb-2 block">상품가 (원)</label>
          <input
            type="text"
            inputMode="numeric"
            value={priceRaw}
            onChange={(e) => setPriceRaw(formatPriceInput(e.target.value))}
            className="w-full border-2 border-gray200 rounded-xl px-3 py-3 text-base font-bold text-navy focus:outline-none focus:border-navy"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-navy mb-2 block">운임+보험 (원)</label>
          <input
            type="text"
            inputMode="numeric"
            value={freightRaw}
            onChange={(e) => setFreightRaw(formatPriceInput(e.target.value))}
            className="w-full border-2 border-gray200 rounded-xl px-3 py-3 text-base font-bold text-navy focus:outline-none focus:border-navy"
          />
        </div>
      </div>
      <p className="text-[11px] text-gray500 -mt-3">
        💡 환율 계산기에서 나온 원화 환산액을 상품가에 입력하면 편해요.
      </p>

      <div>
        <label className="text-sm font-bold text-navy mb-2 block">관세율</label>
        <div className="flex flex-wrap gap-2">
          {TARIFF_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                if (p.rate !== null) setTariffRate(p.rate);
                else setTariffRate(Number(customRate) || 0);
              }}
              className="text-sm px-3.5 py-2 rounded-full border-2 font-bold"
              style={
                (p.rate !== null && tariffRate === p.rate) || (p.rate === null && tariffRate === Number(customRate))
                  ? { background: TEAL, borderColor: TEAL, color: "#fff" }
                  : { borderColor: "#E4E7EB", color: "#6B7480" }
              }
            >
              {p.label}
              {p.rate !== null && ` ${p.rate}%`}
            </button>
          ))}
          <input
            type="text"
            inputMode="decimal"
            value={customRate}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setCustomRate(v);
              setTariffRate(Number(v) || 0);
            }}
            className="w-16 border-2 border-gray200 rounded-full px-2 py-2 text-sm font-bold text-center text-navy focus:outline-none focus:border-navy"
          />
          <span className="text-sm font-bold text-gray500 self-center">%</span>
        </div>
      </div>

      <button
        onClick={() => setIncludeVat((v) => !v)}
        className="flex items-center gap-2 text-sm font-bold text-navy"
      >
        <span
          className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
          style={includeVat ? { background: TEAL, color: "#fff" } : { border: "2px solid #E4E7EB" }}
        >
          {includeVat && "✓"}
        </span>
        부가세(10%) 포함해서 계산
      </button>

      <div className="rounded-2xl px-5 py-5 flex flex-col gap-2.5" style={{ background: "#F5F6F8" }}>
        <Row label="과세가격 (CIF)" value={cif} />
        <Row label={`관세 (${tariffRate}%)`} value={tariff} />
        {includeVat && <Row label="부가세 (10%)" value={vat} />}
        <div className="border-t border-gray200 my-1" />
        <Row label="예상 세금 합계" value={totalTax} bold />
        <div className="rounded-xl px-4 py-4 mt-1" style={{ background: TEAL }}>
          <div className="text-xs font-bold" style={{ color: TEAL_LIGHT }}>
            예상 총 수입원가
          </div>
          <div className="font-display text-2xl text-white mt-1">{totalCost.toLocaleString("ko-KR")}원</div>
        </div>
      </div>

      <p className="text-[11px] text-gray500 leading-relaxed">
        ※ 실제 관세율은 HS코드·품목·협정세율(FTA)에 따라 달라져요. 이 계산기는 사전 마진 검토용
        참고자료이며, 정확한 세액은 관세청 또는 관세사를 통해 확인해주세요.
      </p>
    </div>
  );
}

// ── 물류 날씨 위젯 ─────────────────────────────────────────────
type WeatherData = {
  temp: number;
  feelsLike: number;
  code: number;
  windSpeed: number;
  precipProb: number;
};

function WeatherWidget() {
  const [region, setRegion] = useState("서울");
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const { lat, lon } = REGION_COORDS[region];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation_probability&timezone=Asia%2FSeoul`;

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const c = json?.current;
        if (!c) throw new Error("no current");
        setData({
          temp: Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          code: c.weather_code,
          windSpeed: c.wind_speed_10m,
          precipProb: c.precipitation_probability ?? 0,
        });
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [region]);

  const info = data ? weatherInfo(data.code) : null;
  const rainWarning = data && data.precipProb >= 60;
  const windWarning = data && data.windSpeed >= 40;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-sm font-bold text-navy mb-2 block">지역 선택</label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(REGION_COORDS).map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className="text-sm px-3.5 py-2 rounded-full border-2 font-bold"
              style={
                region === r
                  ? { background: TEAL, borderColor: TEAL, color: "#fff" }
                  : { borderColor: "#E4E7EB", color: "#6B7480" }
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl px-5 py-6" style={{ background: "#F5F6F8" }}>
        {loading ? (
          <div className="text-center text-gray500 text-sm py-4">날씨 조회 중...</div>
        ) : error || !data || !info ? (
          <div className="text-center text-sm py-4" style={{ color: "#C2410C" }}>
            날씨 조회에 실패했어요. 잠시 후 다시 시도해주세요.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray500 mb-1">
                  {region} · 현재 날씨
                </div>
                <div className="font-display text-4xl text-navy">{data.temp}°</div>
                <div className="text-sm text-gray500 mt-1">체감 {data.feelsLike}°</div>
              </div>
              <div className="text-center">
                <div className="text-5xl leading-none">{info.icon}</div>
                <div className="text-sm font-bold text-navy mt-2">{info.label}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <div className="bg-white rounded-xl px-3 py-3 text-center">
                <div className="text-[11px] text-gray500 mb-0.5">강수확률</div>
                <div className="text-base font-bold text-navy">{data.precipProb}%</div>
              </div>
              <div className="bg-white rounded-xl px-3 py-3 text-center">
                <div className="text-[11px] text-gray500 mb-0.5">풍속</div>
                <div className="text-base font-bold text-navy">{Math.round(data.windSpeed)}km/h</div>
              </div>
            </div>
          </>
        )}
      </div>

      {(rainWarning || windWarning) && (
        <div className="rounded-xl px-4 py-3.5" style={{ background: "#FDEEE8" }}>
          <div className="text-sm font-bold" style={{ color: "#C2410C" }}>
            ⚠️ {rainWarning && "강수 확률이 높아요"}
            {rainWarning && windWarning && " · "}
            {windWarning && "바람이 강해요"}
          </div>
          <div className="text-xs mt-1" style={{ color: "#C2410C" }}>
            상하차·배송 일정 조율 시 참고하세요.
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray500 leading-relaxed">
        ※ 도/시 단위 대표 좌표 기준 예보이며, 실제 상하차 현장 날씨와 다를 수 있어요.
      </p>
    </div>
  );
}

// ── 팔레트 적재 계산기 ─────────────────────────────────────────
const PALLET_PRESETS = [
  { label: "표준 파렛트 (1100×1100)", l: 1100, w: 1100 },
  { label: "유로 파렛트 (1200×800)", l: 1200, w: 800 },
  { label: "직접 입력", l: null, w: null },
];

function PalletCalculator() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [palletL, setPalletL] = useState("1100");
  const [palletW, setPalletW] = useState("1100");
  const [maxHeight, setMaxHeight] = useState("1500");
  const [boxL, setBoxL] = useState("400");
  const [boxW, setBoxW] = useState("300");
  const [boxH, setBoxH] = useState("250");

  const pL = Number(palletL) || 0;
  const pW = Number(palletW) || 0;
  const mH = Number(maxHeight) || 0;
  const bL = Number(boxL) || 1;
  const bW = Number(boxW) || 1;
  const bH = Number(boxH) || 1;

  // 두 가지 배치(정방향/90도 회전) 중 더 많이 들어가는 쪽을 채택
  const layoutA = Math.floor(pL / bL) * Math.floor(pW / bW);
  const layoutB = Math.floor(pL / bW) * Math.floor(pW / bL);
  const perLayer = Math.max(layoutA, layoutB);
  const bestLayout = layoutA >= layoutB ? "정방향" : "90도 회전";
  const layers = Math.max(Math.floor(mH / bH), 0);
  const total = perLayer * layers;

  const areaUsed = perLayer * bL * bW;
  const areaTotal = pL * pW;
  const areaEfficiency = areaTotal > 0 ? Math.min(100, Math.round((areaUsed / areaTotal) * 100)) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-sm font-bold text-navy mb-2 block">파렛트 규격</label>
        <div className="flex flex-wrap gap-2">
          {PALLET_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => {
                setPresetIdx(i);
                if (p.l && p.w) {
                  setPalletL(String(p.l));
                  setPalletW(String(p.w));
                }
              }}
              className="text-sm px-3.5 py-2 rounded-full border-2 font-bold"
              style={
                presetIdx === i
                  ? { background: TEAL, borderColor: TEAL, color: "#fff" }
                  : { borderColor: "#E4E7EB", color: "#6B7480" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <NumField label="파렛트 가로" unit="mm" value={palletL} onChange={setPalletL} />
        <NumField label="파렛트 세로" unit="mm" value={palletW} onChange={setPalletW} />
        <NumField label="최대 적재고" unit="mm" value={maxHeight} onChange={setMaxHeight} />
      </div>

      <div>
        <div className="text-sm font-bold text-navy mb-2">박스(매물) 규격</div>
        <div className="grid grid-cols-3 gap-2.5">
          <NumField label="가로" unit="mm" value={boxL} onChange={setBoxL} />
          <NumField label="세로" unit="mm" value={boxW} onChange={setBoxW} />
          <NumField label="높이" unit="mm" value={boxH} onChange={setBoxH} />
        </div>
      </div>

      <div className="rounded-2xl px-5 py-5 flex flex-col gap-2.5" style={{ background: "#F5F6F8" }}>
        <Row label={`한 층당 박스 수 (${bestLayout})`} value={perLayer} suffix="개" />
        <Row label="적재 가능 층수" value={layers} suffix="층" />
        <Row label="바닥면 적재 효율" value={areaEfficiency} suffix="%" />
        <div className="border-t border-gray200 my-1" />
        <div className="rounded-xl px-4 py-4 mt-1" style={{ background: TEAL }}>
          <div className="text-xs font-bold" style={{ color: TEAL_LIGHT }}>
            파렛트 1개당 총 적재 수량
          </div>
          <div className="font-display text-2xl text-white mt-1">{total.toLocaleString("ko-KR")}개</div>
        </div>
      </div>

      <p className="text-[11px] text-gray500 leading-relaxed">
        ※ 박스를 90도 돌려 쌓는 경우까지 비교해 더 많이 들어가는 배치를 자동으로 보여줘요. 파렛트
        자체 높이, 랩핑 여유공간, 무게 제한(적재 중량)은 별도로 고려해주세요.
      </p>
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray500 mb-1.5 block">
        {label} ({unit})
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className="w-full border-2 border-gray200 rounded-xl px-3 py-2.5 text-sm font-bold text-navy text-center focus:outline-none focus:border-navy"
      />
    </div>
  );
}

// ── 운송 매칭 (준비중 티저) ────────────────────────────────────
function ShippingMatchTeaser() {
  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-2xl px-5 py-7 text-center"
        style={{ background: "linear-gradient(135deg, #123A4A, #0B2540)" }}
      >
        <span
          className="inline-block text-[11px] font-bold px-3 py-1 rounded-full mb-3"
          style={{ background: "rgba(94,234,212,0.15)", color: TEAL_LIGHT }}
        >
          준비중 · COMING SOON
        </span>
        <div className="text-white font-display text-xl leading-snug">
          운송사 매칭 · 견적 비교
        </div>
        <p className="text-white/70 text-sm mt-2.5 leading-relaxed">
          점프엑스 매물을 낙찰받은 다음, 지역·화물량에 맞는 운송사를 자동으로 매칭하고
          견적을 비교하는 기능을 준비하고 있어요.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-gray200 px-5 py-5">
        <div className="text-sm font-bold text-navy mb-1">지금 당장 운송이 필요하다면</div>
        <p className="text-[13px] text-gray500 leading-relaxed mb-4">
          점핑로지스 자체 매칭 서비스가 열리기 전까지는, 검증된 화물 운송 플랫폼을 통해
          견적을 받아보실 수 있어요.
        </p>
        <a
          href="https://www.cargo-link.co.kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-white font-bold rounded-xl py-3.5"
          style={{ background: "#FF6F0F" }}
        >
          카고링크에서 화물 견적 받기 →
        </a>
      </div>

      <p className="text-[11px] text-gray500 leading-relaxed">
        ※ 카고링크는 점프엑스와 제휴 관계가 아닌 외부 서비스이며, 이용 시 해당 플랫폼의
        약관이 적용됩니다.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  suffix = "원",
}: {
  label: string;
  value: number;
  bold?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? "font-bold text-navy" : "text-gray500"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-navy" : "font-bold text-gray900"}`}>
        {value.toLocaleString("ko-KR")}
        {suffix}
      </span>
    </div>
  );
}
