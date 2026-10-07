import { NextResponse } from "next/server";
import { FX_CODES } from "@/lib/fxCurrencies";

// 2026-10-07: 환율 계산기가 브라우저에서 api.frankfurter.app을 직접 부르던 것을 서버 경로로 옮김.
// 그 주소가 api.frankfurter.dev로 301 이동했는데 301 응답엔 CORS 헤더가 없어 브라우저가 막았음("환율 조회에 실패했어요").
// 서버에서 부르면 CORS 영향이 없고, 주소가 또 바뀌어도 이 파일(또는 FX_API_BASE_URL)만 고치면 됨.
//
// 6시간 캐시(서버 메모리 + CDN s-maxage). 다시 받아오다 실패하면 직전 값을 그대로 내려주고, 한 번도 못 받았으면 502.
// 키는 필요 없음. FX_API_BASE_URL은 시험 때 가짜 서버를 연결하려는 용도(기본값 = 운영 주소).
const TTL_MS = Number(process.env.FX_CACHE_TTL_MS) || 21600 * 1000;
const DEFAULT_BASE = "https://api.frankfurter.dev/v1/latest";

type Entry = { rate: number; date: string; at: number };
const cache = new Map<string, Entry>();

export async function GET(req: Request) {
  const currency = new URL(req.url).searchParams.get("currency") ?? "";
  if (!FX_CODES.includes(currency)) {
    return NextResponse.json({ error: "지원하지 않는 통화예요." }, { status: 400 });
  }

  const hit = cache.get(currency);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ rate: hit.rate, date: hit.date }, { headers: { "Cache-Control": "public, s-maxage=21600" } });
  }

  try {
    const base = process.env.FX_API_BASE_URL || DEFAULT_BASE;
    const res = await fetch(`${base}?base=${currency}&symbols=KRW`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.KRW;
    if (typeof rate !== "number" || !(rate > 0) || typeof data.date !== "string") throw new Error("bad shape");
    cache.set(currency, { rate, date: data.date, at: Date.now() });
    return NextResponse.json({ rate, date: data.date }, { headers: { "Cache-Control": "public, s-maxage=21600" } });
  } catch {
    // 직전 값이 있으면 그대로 — 오래됐어도 날짜(date)가 같이 가서 화면에 기준일이 보임
    if (hit) return NextResponse.json({ rate: hit.rate, date: hit.date, stale: true });
    return NextResponse.json({ error: "환율을 불러오지 못했어요." }, { status: 502 });
  }
}
