// /deals "찾습니다" 알림판 규칙 (2026-10-13 대표 확정) — 서버(/api/buy-requests/summary)와 화면이 같이 씀. 다른 모듈 import 없음(단위 시험용).
//   대상 글: outcome='pending' · 최근 30일 · 시험 계정 제외(서버). 건수 = 대상 글 수.
//   이름: 점핑매니저가 연락한(contacted=true) 글의 품목만, 최신순 최대 2개 · 연락처·링크가 섞인 이름은 빼고(건수엔 포함) · 7자 넘으면 7자 + "…".

export const BUY_NOTICE_DAYS = 30;
export const BUY_NOTICE_NAME_MAX = 7; // 글자 수(Array.from — 이모지 1개 = 1자)
export const BUY_NOTICE_MAX_NAMES = 2;
export const BUY_NOTICE_PAIR_MAX = 9; // 두 이름 글자 합이 이 이하면 "이름1·이름2", 넘으면 "이름1 외 1건"

// /buy 상품명에 연락처·링크(titleGuard hasContactOrLink) → 등록 막음. 화면 알약·칸 아래 안내·서버 400 문구가 같은 값
export const BUY_PRODUCT_CONTACT_ERROR = "상품명에는 연락처나 링크를 적지 말아 주세요";
// /buy 개인정보 동의 아래 보조 문구 — 품목이 알림판에 보일 수 있음을 알림
export const BUY_VISIBILITY_NOTE = "요청 내용(연락처 제외)은 다른 회원에게 보일 수 있어요";

export type BuySummary ={ count: number; names: string[] };
export type NoticePiece = { text: string; strong?: boolean };

/** 앞뒤 공백 정리(가운데 연속 공백·줄바꿈은 1칸) 후 7자 넘으면 7자 + "…". 빈 문자열이면 "" */
export function trimNoticeName(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  const chars = Array.from(t);
  return chars.length > BUY_NOTICE_NAME_MAX ? chars.slice(0, BUY_NOTICE_NAME_MAX).join("") + "…" : t;
}

export type BuyNoticeRow = { product_name: string | null; contacted: boolean | null; created_at: string };

/**
 * 대상 글(이미 pending·30일로 거른 것) → 응답 { count, names }. 반환 객체엔 이 두 칸만 — 연락처·희망가 등은 여기로 들어와도 나가지 않음.
 *   isTest: 시험 계정 글이면 true(건수·이름 모두 제외) · hasContact: 연락처·링크가 섞인 이름(이름만 제외, 건수엔 포함)
 *   같은 이름(자른 뒤 기준)은 한 번만 — "삼겹살·삼겹살"처럼 보이지 않게
 */
export function summarizeBuyRows<R extends BuyNoticeRow>(
  rows: R[],
  isTest: (row: R) => boolean,
  hasContact: (name: string) => boolean
): BuySummary {
  const live = rows.filter((r) => !isTest(r)).sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  const names: string[] = [];
  for (const r of live) {
    if (names.length >= BUY_NOTICE_MAX_NAMES) break;
    if (r.contacted !== true || typeof r.product_name !== "string") continue;
    const full = r.product_name.replace(/\s+/g, " ").trim();
    if (!full || hasContact(full)) continue;
    const name = trimNoticeName(full);
    if (!names.includes(name)) names.push(name);
  }
  return { count: live.length, names };
}

/** 알림판 본문 조각 — strong은 상품명·건수(굵게). "…"이 붙은 이름도 글자 수에 포함 */
export function buyNoticePieces({ count, names }: BuySummary): NoticePiece[] {
  const n = Math.max(0, Math.floor(count || 0));
  const list = (names ?? []).filter(Boolean).slice(0, BUY_NOTICE_MAX_NAMES);
  if (n === 0) return [{ text: "찾는 상품, 연결해드려요" }];
  if (n >= 3) {
    if (list.length === 0) return [{ text: "지금 찾는 상품 " }, { text: `${n}건`, strong: true }];
    return [{ text: `${n}건`, strong: true }, { text: " · " }, { text: list[0], strong: true }, { text: " 외" }];
  }
  if (list.length === 0) return [{ text: "지금 찾는 상품이 있어요" }];
  if (list.length === 1) return [{ text: list[0], strong: true }, { text: " 찾는 중" }];
  const len = Array.from(list[0]).length + Array.from(list[1]).length;
  if (len <= BUY_NOTICE_PAIR_MAX) {
    return [{ text: list[0], strong: true }, { text: "·" }, { text: list[1], strong: true }, { text: " 찾는 중" }];
  }
  return [{ text: list[0], strong: true }, { text: " 외 1건 찾는 중" }];
}

export const buyNoticeText = (s: BuySummary) => buyNoticePieces(s).map((p) => p.text).join("");
