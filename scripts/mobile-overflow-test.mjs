// 회원 화면 가로 넘침 시험 (2026-10-26, fix/mobile-overflow) — 앞으로 회귀 방지용.
// (2026-10-27 확장) 홈·/deals 카드(가격 줄)와 브랜드 보호 매물 상세(비회원·회원)도 포함 — 매물 응답은 페이지에서 가짜로 채움.
// 7개 경로 × 360·390·412 폭 × 글자 크기(기본·130%·200%)에서
//   ① documentElement·body scrollWidth = clientWidth
//   ② 화면 오른쪽 끝(clientWidth)을 넘는 요소가 하나도 없음 (AppShell의 overflow-x: clip 안에 숨어 "잘려 보이는" 요소 포함)
// 준비: 앱을 가짜 env로 빌드·실행(next start). 외부·운영 접속 없음 — 앱 밖 요청은 모두 막고 회원 세션·목록은 가짜 응답.
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3197 NEXT_PUBLIC_SUPABASE_ANON_KEY=fake SUPABASE_SERVICE_ROLE_KEY=fake \
//   ADMIN_SESSION_SECRET=fakefakefakefakefakefakefakefake NEXT_PUBLIC_SITE_URL=https://dumpingjumping.com next build --webpack && next start -p 3198
// 실행: BASE_URL=http://127.0.0.1:3198 node scripts/mobile-overflow-test.mjs
//   (회원 세션 저장 키 sb-127-auth-token은 Supabase 주소가 http://127.0.0.1:… 일 때 기준)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3198";
const PROT_ID = "cccccccc-0000-4000-8000-000000000002"; // 보호 매물(공개 사진 1장 + 보호 사진 3장)
const TILE_ID = "cccccccc-0000-4000-8000-000000000003"; // 보호 매물(공개 사진 없음 → 🛡 타일)
const ROUTES = ["/buy", "/buy/new", "/sell", "/sell?buyRef=11111111-1111-4111-8111-111111111111", "/deals", "/", "/mypage", `/deals/${PROT_ID}`, `/deals/${TILE_ID}`];
const WIDTHS = [360, 390, 412];
// 일부 경로만 빠르게: ONLY="/deals,/" node scripts/mobile-overflow-test.mjs
// 글자 크기 배율(루트 112.5% 기준). 200%는 안드로이드 "가장 크게" 근처 — 아래 STRICT_AT_200 경로만 요구.
const SCALES = [{ label: "기본", f: 1 }, { label: "130%", f: 1.3 }, { label: "200%", f: 2 }];
// 200% 글자에서 넘침 0을 요구하는 경로. /mypage만 기본·130%까지(10/27: 홈·/deals 카드 가격 줄·보호 매물 상세 추가).
const STRICT_AT_200 = new Set(ROUTES.filter((r) => r !== "/mypage"));

let failed = 0;
const chk = (m, c, x = "") => { if (!c) failed++; console.log(c ? "ok  " : "FAIL", m, x); };

// 화면 오른쪽 끝을 넘는 요소(고정 위치 포함, overflow:clip 조상에 가려진 것도 포함)
const findOffenders = () => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const e of document.querySelectorAll("body *")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= vw + 0.5) continue;
    // 가로 스크롤 칸(overflow-x: auto/scroll) 안의 요소는 의도된 가로 스크롤이라 제외
    let scroller = false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if ((o === "auto" || o === "scroll") && p.getBoundingClientRect().right <= vw + 0.5) { scroller = true; break; }
    }
    if (scroller) continue;
    // 의도된 한 줄 말줄임(text-overflow: ellipsis) 칸 안의 글자는 제외 — 칸이 화면 안이면 잘려 보이는 게 아니라 "…"로 보임
    let ellipsis = false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).textOverflow === "ellipsis" && p.getBoundingClientRect().right <= vw + 0.5) { ellipsis = true; break; }
    }
    if (ellipsis) continue;
    out.push(`${e.tagName.toLowerCase()}.${typeof e.className === "string" ? e.className.trim().split(/\s+/).slice(0, 3).join(".") : ""} w=${Math.round(r.width)} right=${Math.round(r.right)} "${e.textContent.trim().slice(0, 14)}"`);
  }
  return out.slice(0, 5);
};

// 매물 카드(a[href^="/deals/"]) 안에서 카드 오른쪽 끝을 넘는 글자·요소 — 카드의 overflow: clip에 가려 "잘려 보이는" 가격 줄 등 (2026-10-27 추가)
const findCardClip = () => {
  const out = [];
  for (const a of document.querySelectorAll('a[href^="/deals/"]')) {
    const pr = a.getBoundingClientRect();
    if (pr.width === 0) continue;
    for (const e of a.querySelectorAll("*")) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= pr.right + 0.5) continue;
      let ellipsis = false;
      for (let p = e.parentElement; p && p !== a; p = p.parentElement) if (getComputedStyle(p).textOverflow === "ellipsis") { ellipsis = true; break; }
      if (ellipsis) continue;
      out.push(`${e.tagName.toLowerCase()} right=${Math.round(r.right)} card=${Math.round(pr.right)} "${e.textContent.trim().slice(0, 14)}"`);
    }
  }
  return out.slice(0, 5);
};

const uid = "11111111-2222-4333-8444-555555555555";
const user = { id: uid, aud: "authenticated", role: "authenticated", phone: "821012345678", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = JSON.stringify({ access_token: "x.y.z", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user });
const buyItems = [
  { id: "11111111-1111-4111-8111-111111111111", name: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-SKU-LONGNAME-9999", category: "수산·축산물", quantity: "1000박스 이상 대량 구매 희망합니다", region: "경상남도 창원시", created_at: new Date().toISOString() },
  { id: "22222222-1111-4111-8111-111111111111", name: "냉동 오징어 대량", category: null, quantity: null, region: null, created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
];

// 가짜 매물(가격이 큰 값·긴 매물명 — 가격 줄이 가장 넓어지는 경우) — 목록·홈·상세 공통
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const ahead = (d) => new Date(Date.now() + d * 864e5).toISOString();
const IMG = "http://127.0.0.1:3197/storage/v1/object/public/deal-images/";
const mkDeal = (o) => ({
  id: "cccccccc-0000-4000-8000-000000000001", title: "프리미엄 한우 등심 1++ 구이용 대용량 특가", category_id: 7, region_id: 3, original_price: 23456789, deal_price: 12345678, price_mode: "fixed",
  total_qty: 1000, remaining_qty: 120, quantity_unit: "박스", price_unit: null, closes_at: ahead(2), created_at: ago(1), location: "경기도 성남시", images: [IMG + "a.png"], video_url: null,
  description: null, status: "active", stock_type: "general", min_order_qty: 10, interest_count: 3, brand_protected: false, protected_image_count: 0, seller_member_id: null, is_anonymous: true,
  seller_display_name: "비공개 판매자", package_unit: null, origin: "국내산", spec: null, storage_condition: null, storage_type: null, expiry_date: null, pid: null, manifest_items: null,
  categories: { name: "수산·축산물" }, regions: { name: "서울" }, ...o,
});
const DEALS = [
  mkDeal({}),
  mkDeal({ id: PROT_ID, title: "보호 매물 양배추환", brand_protected: true, protected_image_count: 3, created_at: ago(0.5) }),
  mkDeal({ id: TILE_ID, title: "보호 매물 닭가슴살", images: [], brand_protected: true, protected_image_count: 2, created_at: ago(0.2) }),
];
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const ONLY = process.env.ONLY?.split(",");
const browser = await chromium.launch();
for (const member of [true, false]) {
  for (const sc of SCALES) {
    for (const W of WIDTHS) {
      for (const route of ROUTES.filter((r) => !ONLY || ONLY.some((o) => r.startsWith(o) && (o !== "/" || r === "/")))) {
        const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        // 앱 밖(구글 폰트 등)·가짜 Supabase 주소는 막고, 필요한 응답만 가짜로
        await page.route((u) => !u.href.startsWith(BASE) && !u.hostname.startsWith("127.0.0.1"), (r) => r.abort());
        await page.route("**/api/buy-requests/public*", (r) => r.fulfill({ json: { items: buyItems } }));
        await page.route("**/storage/v1/object/**", (r) => r.fulfill({ body: PNG1, contentType: "image/png" }));
        await page.route(/\/rest\/v1\/deals\?/, (r) => {
          const id = /[?&]id=eq\.([0-9a-f-]+)/.exec(r.request().url())?.[1];
          const one = id ? DEALS.find((d) => d.id === id) : undefined;
          const obj = (r.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
          if (id) return one ? r.fulfill({ json: obj ? one : [one] }) : r.fulfill({ status: 406, json: { code: "PGRST116", message: "no rows" } });
          return r.fulfill({ json: DEALS });
        });
        await page.route("**/api/deal-protected", (r) => r.fulfill({ json: { brandName: "○○제약", photos: [1, 2, 3].map((i) => ({ url: `${IMG}p${i}.png` })), expiresInSeconds: 600 } }));
        if (member) {
          await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem("dj_first_visit_at", "1"); } catch {} }, ["sb-127-auth-token", session]);
          await page.route("**/auth/v1/user", (r) => r.fulfill({ json: user }));
          await page.route(/\/rest\/v1\/members\?/, (r) => r.fulfill({ json: { id: uid, phone: "01012345678", bonus_photo_slots: 0, is_business: false, name: "시험", company_name: "시험상사", notification_prefs: null } }));
        }
        await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => {});
        if (sc.f !== 1) await page.addStyleTag({ content: `html{font-size:${112.5 * sc.f}% !important}` });
        await page.waitForTimeout(700);
        const m = await page.evaluate(() => ({ cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, bsw: document.body.scrollWidth }));
        const off = await page.evaluate(findOffenders);
        const strict = sc.f < 2 || STRICT_AT_200.has(route);
        const tag = `${member ? "회원" : "비회원"} ${W}px 글자${sc.label} ${route.length > 12 ? route.slice(0, 12) + "…" : route}`;
        if (strict) {
          chk(`${tag}: scrollWidth = clientWidth`, m.sw === m.cw && m.bsw <= m.cw, `sw=${m.sw} bsw=${m.bsw} cw=${m.cw}`);
          chk(`${tag}: 화면 오른쪽 끝을 넘는 요소 없음`, off.length === 0, off.join(" | "));
          if (route === "/" || route === "/deals") {
            const clip = await page.evaluate(findCardClip);
            chk(`${tag}: 매물 카드 안 글자가 카드 오른쪽 끝을 넘지 않음`, clip.length === 0, clip.join(" | "));
          }
        }
        await ctx.close();
      }
    }
  }
}
await browser.close();
console.log(failed ? `\n${failed}건 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
