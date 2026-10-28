// 2026-10-28 관리자 새 매물 등록 폼 임시저장(PR-B F) — 이 탭의 sessionStorage에만 보관(새로고침엔 살고, 탭을 닫으면 사라짐. 공용 PC에 안 남김).
// 저장 제외: 판매자 비공개(상호·연락처·보조 연락처·담당자)·사업자 조회 기록 선택·브랜드 보호·올리는 중/실패한 사진. 사진·영상은 이미 올라간 주소만.
// 화면(page.tsx의 DealForm)과 시험이 같이 쓰는 순수 함수 모음 — 저장소 접근은 모두 try/catch(사생활 보호 창 등에서 막혀도 폼은 그대로 동작).

export const DEAL_DRAFT_VERSION = 1;
export const DEAL_DRAFT_DEBOUNCE_MS = 800;

export const dealDraftKey = (adminId: string) => `dj_admin_deal_draft:${adminId}`;

export type DealDraftFields = {
  title: string;
  stockType: string;
  category: string;
  region: string;
  priceMode: string;
  originalPrice: string;
  dealPrice: string;
  totalQty: string;
  quantityUnit: string;
  priceUnit: string;
  minOrderQty: string;
  closesChoice: string;
  closesCustom: string;
  images: string[];
  videoUrl: string | null;
  description: string;
  packageUnit: string;
  origin: string;
  spec: string;
  storageType: string;
  expiryDate: string;
  pid: string;
  manifestItems: unknown[];
  sellerPublic: boolean;
  sellerCompanyName: string;
  shippingFeeType: string;
  shippingNote: string;
  sourcedBy: string;
};

export type StoredDealDraft = { savedAt: number; fields: DealDraftFields };

const str = (v: unknown) => (typeof v === "string" ? v : "");
// 올라간 주소만 — 업로드 중(blob:)·data: 주소는 버림
const urls = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "" && !/^(blob|data):/i.test(x)) : [];

/** 저장된 값 정리 — 모르는 모양·이상한 타입은 빈 값으로(손상된 저장본이 폼을 깨지 않게) */
export function sanitizeDraft(raw: unknown): DealDraftFields | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  const video = typeof f.videoUrl === "string" && f.videoUrl && !/^(blob|data):/i.test(f.videoUrl) ? f.videoUrl : null;
  return {
    title: str(f.title),
    stockType: str(f.stockType),
    category: str(f.category),
    region: str(f.region),
    priceMode: str(f.priceMode),
    originalPrice: str(f.originalPrice),
    dealPrice: str(f.dealPrice),
    totalQty: str(f.totalQty),
    quantityUnit: str(f.quantityUnit),
    priceUnit: str(f.priceUnit),
    minOrderQty: str(f.minOrderQty),
    closesChoice: str(f.closesChoice),
    closesCustom: str(f.closesCustom),
    images: urls(f.images),
    videoUrl: video,
    description: str(f.description),
    packageUnit: str(f.packageUnit),
    origin: str(f.origin),
    spec: str(f.spec),
    storageType: str(f.storageType),
    expiryDate: str(f.expiryDate),
    pid: str(f.pid),
    manifestItems: Array.isArray(f.manifestItems) ? f.manifestItems.filter((x) => x && typeof x === "object") : [],
    sellerPublic: f.sellerPublic === true,
    sellerCompanyName: str(f.sellerCompanyName),
    shippingFeeType: str(f.shippingFeeType),
    shippingNote: str(f.shippingNote),
    sourcedBy: str(f.sourcedBy),
  };
}

export function readDealDraft(key: string | null | undefined): StoredDealDraft | null {
  if (!key) return null;
  try {
    const text = window.sessionStorage.getItem(key);
    if (!text) return null;
    const parsed = JSON.parse(text) as { v?: number; savedAt?: number; f?: unknown };
    if (parsed?.v !== DEAL_DRAFT_VERSION) return null;
    const fields = sanitizeDraft(parsed.f);
    return fields ? { savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0, fields } : null;
  } catch {
    return null;
  }
}

export function writeDealDraft(key: string | null | undefined, fields: DealDraftFields): void {
  if (!key) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ v: DEAL_DRAFT_VERSION, savedAt: Date.now(), f: fields }));
  } catch {
    /* 저장 공간 부족·차단 — 임시저장만 못 할 뿐 */
  }
}

export function clearDealDraft(key: string | null | undefined): void {
  if (!key) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
}

/** "13:05" 같은 저장 시각 표시(한국 시각) */
export function draftSavedLabel(savedAt: number): string {
  if (!savedAt) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(savedAt));
}
