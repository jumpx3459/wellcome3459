// /deals "찾습니다" 알림판 규칙 단위 시험 — src/lib/buyNotice.ts (2026-10-13 feat/deals-buy-notice)
// 실행: node --experimental-strip-types scripts/buy-notice-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const B = await import(pathToFileURL(join(root, "src/lib/buyNotice.ts")).href);
const G = await import(pathToFileURL(join(root, "src/lib/titleGuard.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};
const text = (count: number, names: string[]) => B.buyNoticeText({ count, names });

// ── 문구 6경우
eq(text(0, []), "찾는 상품, 연결해드려요", "0건");
eq(text(2, []), "지금 찾는 상품이 있어요", "1~2건 · 이름 0");
eq(text(1, ["삼겹살"]), "삼겹살 찾는 중", "1~2건 · 이름 1");
eq(text(2, ["삼겹살", "냉동새우"]), "삼겹살·냉동새우 찾는 중", "1~2건 · 이름 2 · 합 7자");
eq(text(2, ["냉동 삼겹살", "냉동새우"]), "냉동 삼겹살 외 1건 찾는 중", "1~2건 · 이름 2 · 합 10자 → 외 1건");
eq(text(5, []), "지금 찾는 상품 5건", "3건 이상 · 이름 0");
eq(text(3, ["삼겹살", "새우"]), "3건 · 삼겹살 외", "3건 이상 · 이름 있음");
// 굵게 조각
eq(B.buyNoticePieces({ count: 3, names: ["삼겹살"] }).filter((p: { strong?: boolean }) => p.strong).map((p: { text: string }) => p.text), ["3건", "삼겹살"], "굵게 = 건수·상품명");
eq(B.buyNoticePieces({ count: 7, names: [] }).filter((p: { strong?: boolean }) => p.strong).map((p: { text: string }) => p.text), ["7건"], "굵게 = 건수(이름 없음)");

// ── 합 9자 경계 ("…"도 1자)
eq(text(2, ["가나다라", "마바사아자"]), "가나다라·마바사아자 찾는 중", "합 9자 → 두 이름");
eq(text(2, ["가나다라마", "바사아자차"]), "가나다라마 외 1건 찾는 중", "합 10자 → 외 1건");
eq(text(2, ["가나다라마바사…", "아"]), "가나다라마바사…·아 찾는 중", "'…' 포함 8자 + 1자 = 9자 → 두 이름");
eq(text(2, ["가나다라마바사…", "아자"]), "가나다라마바사… 외 1건 찾는 중", "'…' 포함 8자 + 2자 = 10자 → 외 1건");

// ── 이름 자르기 (7자 / … / 이모지·영문 혼합)
eq(B.trimNoticeName("  삼겹살  "), "삼겹살", "앞뒤 공백 정리");
eq(B.trimNoticeName("냉동  \n 삼겹살"), "냉동 삼겹살", "가운데 공백·줄바꿈 1칸");
eq(B.trimNoticeName("가나다라마바사"), "가나다라마바사", "딱 7자 → 그대로");
eq(B.trimNoticeName("가나다라마바사아"), "가나다라마바사…", "8자 → 7자 + …");
eq(B.trimNoticeName("🐷🐷삼겹살 500kg"), "🐷🐷삼겹살 5…", "이모지 = 1자");
eq(B.trimNoticeName("iPhone 15 Pro"), "iPhone …", "영문 7자(공백 포함)");
eq(B.trimNoticeName("LG그램16인치"), "LG그램16인…", "영문·한글·숫자 혼합");
eq(B.trimNoticeName("   "), "", "공백만 → 빈 문자열");

// ── 행 → 요약 (서버 규칙)
const rows = [
  { product_name: "최신 미연락", contacted: false, created_at: "2026-10-13T05:00:00Z", member_id: null, contact_phone: "01011112222" },
  { product_name: "냉동 삼겹살 500kg 이상", contacted: true, created_at: "2026-10-13T04:00:00Z", member_id: "m1", contact_phone: null },
  { product_name: "시험 계정 글", contacted: true, created_at: "2026-10-13T03:30:00Z", member_id: "test1", contact_phone: null },
  { product_name: "새우 010-1234-5678", contacted: true, created_at: "2026-10-13T03:00:00Z", member_id: null, contact_phone: null },
  { product_name: "냉동 삼겹살 500kg 이상", contacted: true, created_at: "2026-10-12T03:00:00Z", member_id: null, contact_phone: null },
  { product_name: "광어", contacted: true, created_at: "2026-10-11T03:00:00Z", member_id: null, contact_phone: null },
  { product_name: "고등어", contacted: true, created_at: "2026-10-10T03:00:00Z", member_id: null, contact_phone: null },
];
const isTest = (r: { member_id: string | null }) => r.member_id === "test1";
const s = B.summarizeBuyRows(rows, isTest, G.hasContactOrLink);
eq(Object.keys(s), ["count", "names"], "응답 칸 = count·names");
eq(s.count, 6, "건수: 시험 글만 빠짐(미연락·연락처 섞인 글은 건수에 포함)");
eq(s.names, ["냉동 삼겹살 …", "광어"], "이름: 연락한 글 최신 2개 · 연락처 섞인 이름 제외 · 같은 이름 1번 · 7자 + …");
eq(B.summarizeBuyRows([...rows].reverse(), isTest, G.hasContactOrLink).names, ["냉동 삼겹살 …", "광어"], "들어온 순서와 무관하게 최신순");
eq(B.summarizeBuyRows([], isTest, G.hasContactOrLink), { count: 0, names: [] }, "글 없음");
eq(B.summarizeBuyRows([rows[0]], isTest, G.hasContactOrLink), { count: 1, names: [] }, "미연락 글만 → 이름 없음");
const leaky = B.summarizeBuyRows([{ ...rows[1], hope_price: 5000, description: "비밀", id: "x" }], isTest, G.hasContactOrLink);
eq(Object.keys(leaky), ["count", "names"], "다른 칸이 들어와도 나가지 않음");

// ── 상품명 연락처·링크 검사 (/api/buy-requests 400 기준)
eq(["삼겹살 010-1234-5678", "새우 www.abc.com", "카톡 문의 광어", "https://x.kr 고등어"].map(G.hasContactOrLink), [true, true, true, true], "번호·링크·메신저 → 걸림");
eq(["냉동 삼겹살 500kg 이상", "LG그램 16인치", "생수 2L 500박스"].map(G.hasContactOrLink), [false, false, false], "정상 품목 → 통과");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
