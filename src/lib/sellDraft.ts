// /sell 판매 신청 작성 중 내용 — 이 기기(localStorage)에만 보관, 서버로 보내지 않음 (2026-10-07 PR 3)
// 전화·카메라 앱을 다녀오다 화면이 다시 열려도(탭이 닫혀 sessionStorage가 사라지는 경우 포함) 이어서 쓰게.
// 키에 회원 ID를 넣어 같은 기기의 다른 회원에겐 보이지 않음. 사진·영상은 이미 올라간 URL만(업로드 중·실패는 화면 상태라 제외).
// 판매자 확인 동의는 저장하지 않음 — 매번 새로 체크. 모든 접근은 실패해도 조용히 넘어감(사생활 보호 모드·저장소 막힘).
import type { ManifestRow } from "@/lib/parseCsv";

export type SellDraft = {
  companyName: string; isAnonymous: boolean; contactName: string; contactPhone: string; category: string;
  categoryTouched: boolean; stockType: string; region: string; productName: string; quantity: string; quantityUnit: string;
  minOrderQty: string; priceMode?: string; hopePrice: string; originalPrice: string; priceUnit: string; priceUnitTouched: boolean; hopeDurationHours: string;
  description: string; packageUnit: string; origin: string; spec: string; storageType: string; expiryDate: string; pid: string;
  images: string[]; videoUrl: string | null; manifestItems: ManifestRow[];
};

export type StoredSellDraft = { v: 1; savedAt: number; data: Partial<SellDraft> };

const KEY_PREFIX = "dj_sell_draft:";
// 예전(2026-09-30~10-07) 탭 단위 보관 키 — 회원 ID 확정 뒤 한 번 새 키로 옮기고 지움
export const LEGACY_SELL_DRAFT_KEY = "dj_sell_draft";
// 제출이 401로 막혀 로그인을 다녀오는 길 표시(탭 단위) — 돌아오면 창 없이 바로 복원
const RESUME_KEY = "dj_sell_draft_resume";
const RESUME_TTL_MS = 60 * 60 * 1000;
export const SELL_DRAFT_TTL_MS = 72 * 60 * 60 * 1000; // 3일 지나면 읽을 때 지움

const keyOf = (owner: string) => `${KEY_PREFIX}${owner}`;

export function readSellDraft(owner: string, now = Date.now()): StoredSellDraft | null {
  try {
    const raw = window.localStorage.getItem(keyOf(owner));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<StoredSellDraft> | null;
    if (!d || d.v !== 1 || typeof d.savedAt !== "number" || !d.data || typeof d.data !== "object") {
      window.localStorage.removeItem(keyOf(owner));
      return null;
    }
    if (now - d.savedAt > SELL_DRAFT_TTL_MS) {
      window.localStorage.removeItem(keyOf(owner));
      return null;
    }
    return d as StoredSellDraft;
  } catch {
    return null;
  }
}

// 용량 초과면 매니페스트 표만 빼고 한 번 더, 그래도 안 되면 건너뜀
export function writeSellDraft(owner: string, data: SellDraft, now = Date.now()): void {
  const put = (d: Partial<SellDraft>) => window.localStorage.setItem(keyOf(owner), JSON.stringify({ v: 1, savedAt: now, data: d }));
  try {
    put(data);
  } catch {
    try {
      put({ ...data, manifestItems: [] });
    } catch {}
  }
}

export function clearSellDraft(owner: string): void {
  try {
    window.localStorage.removeItem(keyOf(owner));
  } catch {}
  try {
    window.sessionStorage.removeItem(LEGACY_SELL_DRAFT_KEY);
  } catch {}
}

// 옛 탭 단위 초안 → 새 키(새 키가 비어 있을 때만). 옛 키는 어느 경우든 지움
export function migrateLegacySellDraft(owner: string, now = Date.now()): void {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(LEGACY_SELL_DRAFT_KEY);
    if (raw === null) return;
    window.sessionStorage.removeItem(LEGACY_SELL_DRAFT_KEY);
  } catch {
    return;
  }
  try {
    const data = JSON.parse(raw) as Partial<SellDraft> | null;
    if (!data || typeof data !== "object") return;
    if (window.localStorage.getItem(keyOf(owner)) !== null) return;
    window.localStorage.setItem(keyOf(owner), JSON.stringify({ v: 1, savedAt: now, data }));
  } catch {}
}

// "알맹이" — 상품명·수량·설명·사진 1장 이상 중 하나. 연락처만 있는 초안은 묻지 않고 무시
export function draftHasContent(d: Partial<SellDraft>): boolean {
  const filled = (v: unknown) => typeof v === "string" && v.trim() !== "";
  return filled(d.productName) || filled(d.quantity) || filled(d.description) || (Array.isArray(d.images) && d.images.length > 0);
}

export function markSellDraftResume(now = Date.now()): void {
  try {
    window.sessionStorage.setItem(RESUME_KEY, String(now));
  } catch {}
}

// 표시를 읽고 바로 지움(한 번만) — 1시간 안에 돌아온 경우만 인정
export function takeSellDraftResume(now = Date.now()): boolean {
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    if (raw === null) return false;
    window.sessionStorage.removeItem(RESUME_KEY);
    const at = Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at <= RESUME_TTL_MS;
  } catch {
    return false;
  }
}

// "10월 7일 오후 3:05"
export function formatDraftTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? "오전" : "오후"} ${h12}:${String(d.getMinutes()).padStart(2, "0")}`;
}
