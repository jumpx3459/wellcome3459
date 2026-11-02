// 판매 등록·매물 수정 폼의 수량·단가 단위 (2026-11-02 feat/unit-custom).
// 목록 + "기타(직접 입력)" — 직접 입력한 글자는 그대로 quantity_unit / price_unit 칸에 저장한다(별도 칸 없음).
// DB: deals·seller_requests 의 *_quantity_unit_len / *_price_unit_len 이 1~6자만 허용(운영 SQL 실행 완료). 목록 check 는 제거됨.
// 다른 모듈 import 없음(단위 시험용). 찾습니다(/buy)는 이 목록을 쓰지 않는다 — 그쪽 목록은 mockData.quantityUnits·format.PRICE_UNITS(값 불변).

/** 총수량·단가 단위 기본 목록(기존 값, 찾습니다 목록과 같은 값) */
export const BASE_QUANTITY_UNITS = ["개", "박스", "kg", "톤", "파렛트", "세트", "L"] as const;
/** 이번에 목록에 추가한 단위 — 기존 목록 끝, "기타(직접 입력)" 바로 앞 */
export const ADDED_UNITS = ["톤백", "드럼", "평", "㎡"] as const;
/** 전체 가격을 한 가격에 — 단가 단위 전용(수량 단위로는 쓰지 않음) */
export const LUMP_SUM_UNIT = "일괄" as const;

/** 기존 단가 단위 8종 — 찾습니다(format.PRICE_UNITS)가 쓰는 목록, 값 변경 없음 */
export const LEGACY_PRICE_UNITS = [...BASE_QUANTITY_UNITS, LUMP_SUM_UNIT] as const;

/** 판매·수정 폼 총수량 단위 목록(기타 제외) */
export const SELL_QUANTITY_UNITS: readonly string[] = [...BASE_QUANTITY_UNITS, ...ADDED_UNITS];
/** 판매·수정 폼 단가 단위 목록(기타 제외) — 기존 8종(…L, 일괄) 끝에 추가 4종 */
export const SELL_PRICE_UNITS: readonly string[] = [...BASE_QUANTITY_UNITS, LUMP_SUM_UNIT, ...ADDED_UNITS];

/** 목록 맨 끝 선택지 — 고르면 글 입력칸이 나타남 */
export const CUSTOM_UNIT_LABEL = "기타(직접 입력)";
export const CUSTOM_UNIT_MAX = 6;

export type UnitCheck = { ok: true; value: string } | { ok: false; error: string };

const LETTER_RE = /\p{L}/u;
const BREAK_RE = /[\r\n\u2028\u2029\u0085]/;
const CONTROL_RE = /\p{Cc}/u;

/** 직접 입력 규칙: 앞뒤 공백 제거 · 1~6자 · 줄바꿈 불가 · 숫자·기호만으로는 불가(글자 1개 이상) */
export function checkCustomUnit(raw: unknown): UnitCheck {
  if (typeof raw !== "string") return { ok: false, error: "단위를 입력해주세요." };
  if (BREAK_RE.test(raw)) return { ok: false, error: "단위에는 줄바꿈을 쓸 수 없어요." };
  const v = raw.trim();
  if (!v) return { ok: false, error: "단위를 입력해주세요." };
  if ([...v].length > CUSTOM_UNIT_MAX) return { ok: false, error: `단위는 ${CUSTOM_UNIT_MAX}자까지 적을 수 있어요.` };
  if (CONTROL_RE.test(v)) return { ok: false, error: "단위에 쓸 수 없는 문자가 있어요." };
  if (!LETTER_RE.test(v)) return { ok: false, error: "단위에는 글자가 들어가야 해요. 숫자·기호만은 안 돼요." };
  return { ok: true, value: v };
}

/** 저장·표시용 총수량 단위: 목록 값이면 그대로, 아니면 직접 입력 규칙. "일괄"은 수량 단위로 쓸 수 없음 */
export function checkQuantityUnit(raw: unknown): UnitCheck {
  if (typeof raw === "string" && raw.trim() === LUMP_SUM_UNIT) return { ok: false, error: "수량 단위로는 \"일괄\"을 쓸 수 없어요." };
  if (typeof raw === "string" && SELL_QUANTITY_UNITS.includes(raw.trim())) return { ok: true, value: raw.trim() };
  return checkCustomUnit(raw);
}

/** 저장·표시용 단가 단위: 목록 값(일괄 포함)이면 그대로, 아니면 직접 입력 규칙 */
export function checkPriceUnitValue(raw: unknown): UnitCheck {
  if (typeof raw === "string" && SELL_PRICE_UNITS.includes(raw.trim())) return { ok: true, value: raw.trim() };
  return checkCustomUnit(raw);
}

/** 서버용: 비어 있음(undefined·null·"")은 기본 "개", 값이 있으면 검사 */
export function normalizeQuantityUnit(raw: unknown): UnitCheck {
  if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) return { ok: true, value: "개" };
  return checkQuantityUnit(raw);
}

// ───── 폼 상태 도우미: 한 칸의 상태 = { unit: 저장될 글자, other: "기타" 선택 여부 }
export type UnitState = { unit: string; other: boolean };

/** 처음 상태 — 저장된 값이 목록에 없으면 "기타" 선택 + 그 값이 입력칸에 채워진 채로 */
export function initUnitState(saved: string | null | undefined, options: readonly string[], fallback: string): UnitState {
  const v = (saved ?? "").trim();
  if (!v) return { unit: fallback, other: false };
  return { unit: v, other: !options.includes(v) };
}

/** 선택 상자를 바꿨을 때. "기타"를 고르면 입력칸을 열고 값은 비움(이미 기타였으면 입력 중인 글 유지) */
export function pickUnit(next: string, prev: UnitState): UnitState {
  if (next === CUSTOM_UNIT_LABEL) return { unit: prev.other ? prev.unit : "", other: true };
  return { unit: next, other: false };
}

/** 입력칸에 글을 쳤을 때. 목록에 있는 단어(예: "박스")면 목록 값으로 자동 전환 */
export function typeUnit(text: string, options: readonly string[]): UnitState {
  const t = text.trim();
  if (t && options.includes(t)) return { unit: t, other: false };
  return { unit: text, other: true };
}

/** 선택 상자에 보일 값 */
export const unitSelectValue = (s: UnitState): string => (s.other ? CUSTOM_UNIT_LABEL : s.unit);

/** J(단가·수량 단위 맞춤): 둘 중 하나라도 직접 입력이면 자동 맞춤을 끔 */
export const canAutoMatchUnits = (a: UnitState, b: UnitState): boolean => !a.other && !b.other;
