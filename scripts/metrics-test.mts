// 일별 합계 기록 단위 시험 — src/lib/partnerSlots.ts(검증) · src/lib/metricsCore.ts(봇 거르기·세션 1회 키·기간) (2026-10-30 feat/stats-foundation).
// 실행: node --experimental-strip-types scripts/metrics-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = await import(pathToFileURL(join(root, "src/lib/partnerSlots.ts")).href);
const M = await import(pathToFileURL(join(root, "src/lib/metricsCore.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(ok ? "ok  " : "FAIL", msg, ok ? "" : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

// ── 슬롯 목록 · 이름 규칙(광고 차단 회피)
eq(P.SLOT_IDS.length, 10, "SLOT_IDS 10개");
eq([...P.SLOT_IDS].sort(), ["connect_done", "deals_board", "home_board_guest", "home_board_member", "logistics_fx", "logistics_pallet", "logistics_shipping", "logistics_weather", "sell_done", "supply_done"], "SLOT_IDS 내용");
eq(P.SLOT_IDS.every((s: string) => /^[a-z0-9_]{1,40}$/.test(s)), true, "SLOT_IDS 모두 ^[a-z0-9_]{1,40}$");
eq(P.SLOT_IDS.some((s: string) => /ad|banner|sponsor/.test(s.replace("_done", "").replace("deals", "").replace("pallet", ""))), false, "SLOT_IDS에 ad·banner·sponsor 없음(deals·pallet 제외 어휘 검사)");

// ── slot 검증
eq(P.isValidSlot("connect_done"), true, "slot 목록에 있음 → 통과");
eq(P.isValidSlot("not_a_slot"), false, "목록에 없는 slot 거부");
eq(P.isValidSlot("Connect_Done"), false, "대문자 거부");
eq(P.isValidSlot("connect-done"), false, "하이픈 거부(slot은 _만)");
eq(P.isValidSlot(""), false, "빈 slot 거부");
eq(P.isValidSlot("a".repeat(41)), false, "41자 slot 거부");
eq(P.isValidSlot(123), false, "숫자 slot 거부");

// ── partnerId 검증
eq(P.isValidPartnerId("cargo-link_1"), true, "partnerId 소문자·숫자·-·_ 통과");
eq(P.isValidPartnerId("a".repeat(60)), true, "partnerId 60자 통과");
eq(P.isValidPartnerId("a".repeat(61)), false, "partnerId 61자 거부");
eq(P.isValidPartnerId("Cargo"), false, "partnerId 대문자 거부");
eq(P.isValidPartnerId("a b"), false, "partnerId 공백 거부");
eq(P.isValidPartnerId("a;drop"), false, "partnerId 특수문자 거부");
eq(P.isValidPartnerId(""), false, "partnerId 빈 값 거부");

// ── kind
eq(P.isValidKind("impression") && P.isValidKind("click"), true, "kind impression·click 통과");
eq(P.isValidKind("view") || P.isValidKind(""), false, "그 외 kind 거부");

// ── 본문 정리
eq(P.parseSlotBody({ slot: "sell_done", partnerId: "p1", kind: "click" }), { slot: "sell_done", partnerId: "p1", kind: "click" }, "slot 본문 통과");
eq(P.parseSlotBody({ slot: "sell_done", partnerId: "P1", kind: "click" }), null, "slot 본문 partnerId 오류 → null");
eq(P.parseSlotBody(null), null, "slot 본문 null → null");
eq(P.parseSlotBody({}), null, "slot 본문 빈 객체 → null");
const U = "11111111-2222-4333-8444-555555555555";
eq(P.parseDealViewBody({ dealId: U }), { dealId: U }, "deal-view 본문 통과");
eq(P.parseDealViewBody({ dealId: "abc" }), null, "deal-view uuid 아님 → null");
eq(P.parseDealViewBody({ dealId: U + "x" }), null, "deal-view uuid 뒤 군더더기 → null");
eq(P.parseDealViewBody(undefined), null, "deal-view 본문 없음 → null");

// ── 봇 User-Agent
const UA = {
  kakaoInApp: "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 KAKAOTALK 10.4.5",
  kakaoInAppIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5",
  kakaoScrap: "facebookexternalhit/1.1;kakaotalk-scrap/1.0; (+https://devtalk.kakao.com/t/scrap/33984)",
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
};
eq(M.isBotUserAgent(UA.kakaoInApp), false, "KAKAOTALK(안드로이드 인앱 실사용자) 통과");
eq(M.isBotUserAgent(UA.kakaoInAppIos), false, "KAKAOTALK(iOS 인앱 실사용자) 통과");
eq(M.isBotUserAgent(UA.kakaoScrap), true, "kakaotalk-scrap 차단");
eq(M.isBotUserAgent("kakaotalk-scrap/1.0"), true, "kakaotalk-scrap 단독 차단");
eq(M.isBotUserAgent(UA.chrome) || M.isBotUserAgent(UA.iphone), false, "일반 크롬·사파리 통과");
for (const [name, ua] of [
  ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["bingbot", "Mozilla/5.0 (compatible; bingbot/2.0)"],
  ["Yeti(네이버 crawl)", "Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd) crawler"],
  ["Baiduspider", "Mozilla/5.0 (compatible; Baiduspider/2.0)"],
  ["Slurp", "Mozilla/5.0 (compatible; Yahoo! Slurp)"],
  ["링크 미리보기", "Slackbot-LinkExpanding 1.0 preview"],
  ["facebookexternalhit", "facebookexternalhit/1.1"],
  ["HeadlessChrome", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0 Safari/537.36"],
  ["Lighthouse", "Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse"],
  ["대문자 BOT", "SOMEBOT/1.0"],
] as const) eq(M.isBotUserAgent(ua), true, `봇 차단: ${name}`);
eq(M.isBotUserAgent(""), true, "UA 비어 있음 → 차단");
eq(M.isBotUserAgent(null), true, "UA 없음(null) → 차단");
eq(M.isBotUserAgent(undefined), true, "UA 없음(undefined) → 차단");

// ── 세션 1회 키
eq(M.impressionKey("sell_done", "p1"), "pm:imp:sell_done:p1", "노출 키 형식 pm:imp:<slot>:<partnerId>");
eq(M.viewKey(U), `pm:view:${U}`, "조회 키 형식 pm:view:<dealId>");
const mk = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), _m: m };
};
{
  M._resetMemoryForTest();
  const st = mk();
  eq(M.firstInSession(st, "k1"), true, "첫 호출 → true(기록)");
  eq(M.firstInSession(st, "k1"), false, "같은 키 두 번째 → false");
  eq(st._m.has("k1"), true, "저장소에 키 기록됨");
  eq(M.firstInSession(st, "k2"), true, "다른 키는 다시 true");
  // 새 화면(메모리 비움)이어도 같은 세션 저장소에 키가 있으면 막힘 — 새로고침
  M._resetMemoryForTest();
  eq(M.firstInSession(st, "k1"), false, "새로고침(메모리 비움) 뒤에도 저장소 키로 false");
  // 새 세션(새 저장소) → true
  M._resetMemoryForTest();
  eq(M.firstInSession(mk(), "k1"), true, "새 세션(새 저장소) → 다시 true");
  // 저장소가 막혀 있어도(throw) 같은 화면 안에서는 한 번만
  M._resetMemoryForTest();
  const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  eq([M.firstInSession(bad, "k9"), M.firstInSession(bad, "k9")], [true, false], "저장소 오류 → 메모리로 대신(첫 true·다음 false)");
  M._resetMemoryForTest();
  eq([M.firstInSession(null, "k8"), M.firstInSession(undefined, "k8")], [true, false], "저장소 없음 → 메모리로 대신");
}

// ── 한국 날짜
eq(M.kstDate(Date.parse("2026-10-30T14:59:59Z")), "2026-10-30", "UTC 14:59 → 한국 23:59 = 같은 날");
eq(M.kstDate(Date.parse("2026-10-30T15:00:00Z")), "2026-10-31", "UTC 15:00 → 한국 다음 날 00:00");

// ── 관리자 기간
eq(M.parseRange("2026-10-01", "2026-10-30"), { from: "2026-10-01", to: "2026-10-30" }, "기간 통과");
eq(M.parseRange("2026-10-30", "2026-10-30"), { from: "2026-10-30", to: "2026-10-30" }, "하루 기간 통과");
eq(M.parseRange("2026-10-30", "2026-10-01"), null, "from > to 거부");
eq(M.parseRange("2026-02-30", "2026-03-01"), null, "없는 날짜 거부");
eq(M.parseRange("2026/10/01", "2026-10-30"), null, "형식 오류 거부");
eq(M.parseRange("2026-01-01", "2026-04-03"), null, "93일 구간(92일 차이) 거부");
eq(M.parseRange("2026-01-01", "2026-04-02"), { from: "2026-01-01", to: "2026-04-02" }, "92일 구간(91일 차이)까지 통과");
eq(M.parseRange(undefined, "2026-10-30"), null, "from 없음 거부");

// ── 칸 항목 · 회전 (2026-11-01 PR 2)
{
  const ids = P.PARTNER_ITEMS.map((i: { id: string }) => i.id);
  eq(new Set(ids).size, ids.length, "항목 id 중복 없음");
  eq(P.PARTNER_ITEMS.every((i: { id: string }) => P.isValidPartnerId(i.id)), true, "항목 id 모두 partnerId 규칙 통과");
  eq(P.PARTNER_ITEMS.some((i: { id: string; title: string; desc: string; cta: string }) => /ad|banner|sponsor|track/.test(i.id)), false, "항목 id에 ad·banner·sponsor·track 없음");
  eq(P.partnerRotation("member", true).map((i: { id: string }) => i.id), ["sell", "buy", "partner", "kakao", "jumpx_waitlist"], "회원 목록 5개(판매·찾습니다·점핑파트너·카카오·오픈 알림)");
  eq(P.partnerRotation("guest", true).map((i: { id: string }) => i.id), ["signup", "sell_guest"], "비회원 목록 2개(가입·판매 등록)");
  eq(P.partnerRotation("member", false).map((i: { id: string }) => i.id), ["sell", "buy", "partner", "kakao"], "플래그 off → 점프엑스 항목 없음");
  eq(P.partnerRotation("guest", false).length, 2, "플래그 off여도 비회원 목록은 그대로");
  eq(P.partnerRotation("member", true, ["sell"]).map((i: { id: string }) => i.id).includes("sell"), false, "excludeIds 제외");
  const text = P.PARTNER_ITEMS.map((i: { title: string; desc: string; cta: string }) => i.title + i.desc + i.cta).join("|");
  eq(/경매|입찰|결제|낙찰|보증|검증/.test(text), false, "항목 문구에 미오픈 기능(경매·입찰·결제·낙찰)·검증 표현 없음");
  const jx = P.PARTNER_ITEMS.find((i: { id: string }) => i.id === "jumpx_waitlist");
  eq(jx.cta, "오픈 알림 받기", "점프엑스 항목 = 오픈 알림 받기만");
  eq(P.PARTNER_KAKAO_FRIEND_URL, "https://pf.kakao.com/_xcFZrX/friend", "카카오 항목 주소 = 채널 친구 추가(/friend)");
  const kk = P.PARTNER_ITEMS.find((i: { id: string }) => i.id === "kakao");
  eq([kk.title, kk.desc, kk.cta], ["카카오 채널 추가", "새 매물 소식을 카카오톡으로 받아보세요", "채널 추가하기"], "카카오 항목 문구(소식 받기 성격)");
  eq(/문의|물어/.test(kk.title + kk.desc + kk.cta), false, "카카오 항목에 문의 표현 없음");
  eq(P.PARTNER_CHIP_LABEL, { notice: "덤핑점핑 안내", external: "광고" }, "칩 문구");
  eq(P.PARTNER_ITEMS.every((i: { chip: string }) => i.chip === "notice"), true, "지금은 자사 안내 칩만");

  const mk2 = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  M._resetRotationForTest();
  const st = mk2();
  eq([0, 1, 2, 3, 4, 5, 6].map(() => M.nextRotationIndex(st, "sell_done", 5)), [0, 1, 2, 3, 4, 0, 1], "세션 순번: 0..4 다음 0");
  eq(M.nextRotationIndex(st, "connect_done", 5), 0, "칸마다 따로 센다");
  M._resetRotationForTest();
  eq(M.nextRotationIndex(st, "sell_done", 5), 2, "새로고침(메모리 비움)해도 저장소 순번 이어감");
  M._resetRotationForTest();
  eq(M.nextRotationIndex(mk2(), "sell_done", 5), 0, "새 세션 → 처음부터");
  M._resetRotationForTest();
  const bad2 = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  eq([M.nextRotationIndex(bad2, "x", 3), M.nextRotationIndex(bad2, "x", 3), M.nextRotationIndex(null, "x", 3)], [0, 1, 2], "저장소 오류·없음 → 메모리 순번");
  eq(M.nextRotationIndex(mk2(), "y", 0), 0, "항목 0개여도 0(터지지 않음)");
}

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
