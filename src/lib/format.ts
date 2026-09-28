export function formatCountdown(closesAt: string): { label: string; urgent: boolean } {
  const diffMs = new Date(closesAt).getTime() - Date.now();
  if (diffMs <= 0) return { label: "마감", urgent: true };

  const totalMin = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  const seconds = Math.floor((diffMs % 60000) / 1000);

  const urgent = diffMs < 1000 * 60 * 60 * 3; // 3시간 미만이면 긴급

  if (days >= 1) {
    return { label: `${days}일 ${hours}:${String(minutes).padStart(2, "0")}`, urgent };
  }
  return {
    label: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`,
    urgent,
  };
}

// closesAt 기준 마감 여부/긴급 여부만 필요할 때(카운트다운 숫자 자체는 필요 없을 때) 사용.
// Date.now() 호출을 이 함수 안에 가둬서, 호출부(렌더 본문)에서 impure 함수를 직접 쓰지 않게 함.
export function dealUrgencyState(closesAt: string): { closed: boolean; urgent: boolean } {
  const diffMs = new Date(closesAt).getTime() - Date.now();
  return { closed: diffMs <= 0, urgent: diffMs > 0 && diffMs < 1000 * 60 * 60 * 3 };
}

export function formatPrice(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export function percentOff(original: number, deal: number) {
  return Math.round(((original - deal) / original) * 100);
}

// 가격 입력창용: 숫자만 남기고 천단위 콤마를 붙여서 보여줍니다.
export function formatPriceInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

// 콤마가 섞인 입력값에서 순수 숫자만 추출합니다 (제출 시 사용).
export function parsePriceInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : undefined;
}

// 가입 순서 회원번호를 "JX-00042" 형식으로 표시합니다.
export function formatMemberNo(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  return `JX-${String(n).padStart(5, "0")}`;
}

// OTP 재전송 남은 시간을 "02:59" 형태로 표시 — signup/login 양쪽에서 재사용.
export function fmtLeft(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// "3시간 전" · "방금" 형태의 상대 시각 — 등록 시각/알림 발송 시각 등 여러 화면에서 재사용.
export function formatRelativeTime(iso?: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  return `${day}일 전`;
}

// 2026-09-29: 가격 기준 단위 — 구매 희망 단가(buy_requests.hope_price_unit) 등.
// 값은 수량 단위 그대로("개"/"박스"/"kg"/"팔레트"/"톤"/"세트") 또는 "총액".
export const PRICE_UNITS = ["개", "박스", "kg", "팔레트", "톤", "세트", "총액"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

// 선택지 라벨: "개당", "kg당" … / "총액"
export function priceUnitLabel(unit: string): string {
  return unit === "총액" ? "총액" : `${unit}당`;
}

// "30,000원/kg", "30,000원(총액)", 단위 없으면 "30,000원"
export function formatPriceWithUnit(price: number, unit?: string | null): string {
  const base = `${price.toLocaleString()}원`;
  if (!unit) return base;
  return unit === "총액" ? `${base}(총액)` : `${base}/${unit}`;
}

// 매물 가격(deal_price·original_price)은 단가 — 판매신청 "희망 단가"가 그대로 deal_price가 됨.
// 기준 단위(quantity_unit)를 붙여 "2,000원/kg"으로 표시 (2026-09-29, 예전엔 "2,000원"만 보였음).
// quantity_unit이 비어 있으면 등록 기본값("개").
export function formatDealPrice(price: number, quantityUnit?: string | null): string {
  return formatPriceWithUnit(price, quantityUnit || "개");
}
