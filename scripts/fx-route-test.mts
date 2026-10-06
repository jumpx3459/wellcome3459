// 환율 서버 경로(/api/fx) 시험 — 가짜 환율 서버(이 스크립트가 직접 띄움)만 쓰고 외부·운영 접속 없음 (2026-10-07).
// 준비: 앱을 FX_API_BASE_URL=http://127.0.0.1:<FAKE_PORT>/v1/latest FX_CACHE_TTL_MS=300 로 빌드·실행(next start).
// 실행: BASE_URL=http://127.0.0.1:3000 FAKE_PORT=54399 node --experimental-strip-types scripts/fx-route-test.mts
//   옛 코드(main, /api/fx 없음)에 돌리면 404라서 실패해야 정상.
import http from "node:http";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PORT = Number(process.env.FAKE_PORT ?? 54399);
let mode: "ok" | "down" = "ok";
const calls: string[] = [];

const fake = http.createServer((req, res) => {
  calls.push(req.url ?? "");
  if (mode === "down") {
    res.writeHead(503);
    res.end("down");
    return;
  }
  const u = new URL(req.url ?? "", "http://x");
  const base = u.searchParams.get("base") ?? "";
  const rate = ({ USD: 1338.78, CNY: 187.5, JPY: 9.1, EUR: 1550.25 } as Record<string, number>)[base];
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ amount: 1, base, date: "2026-10-06", rates: { KRW: rate } }));
});
await new Promise<void>((r) => fake.listen(PORT, "127.0.0.1", r));

let fail = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) fail++;
};
const get = async (q: string) => {
  const r = await fetch(`${BASE}/api/fx?currency=${q}`);
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1) 성공 — 허용 통화, 가짜 서버가 받은 요청 모양까지 확인
mode = "ok";
let r = await get("USD");
check("성공: 200 + rate·date", r.status === 200 && r.body?.rate === 1338.78 && r.body?.date === "2026-10-06", JSON.stringify(r.body));
check("가짜 서버가 base=USD&symbols=KRW로 호출됨", calls.some((c) => c.includes("base=USD") && c.includes("symbols=KRW")));
// 2) 허용 목록 밖 통화 400
r = await get("GBP");
check("목록 밖 통화(GBP) → 400", r.status === 400);
r = await get("");
check("통화 없음 → 400", r.status === 400);
// 3) 캐시 만료 뒤 가짜 서버 장애 → 직전 값 유지
await get("CNY");
await sleep(400);
mode = "down";
r = await get("CNY");
check("실패하지만 직전 값 있음 → 200 + 직전 값", r.status === 200 && r.body?.rate === 187.5 && r.body?.date === "2026-10-06", JSON.stringify(r.body));
// 4) 처음부터 실패 → 502
r = await get("EUR");
check("처음부터 실패(EUR 값 없음) → 502", r.status === 502, JSON.stringify(r.body));

fake.close();
console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
process.exit(fail ? 1 : 0);
