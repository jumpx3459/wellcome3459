// 제휴·소개 칸(슬롯) 정의와 입력 검증 (2026-10-30 feat/stats-foundation) — 노출·클릭 일별 합계(ad_daily_stats) 기록용.
// 이름·경로에 ad·banner·sponsor를 쓰지 않음(광고 차단 도구 회피). 다른 모듈 import 없음(단위 시험용).
// 화면 칸은 PR 2부터 붙임 — 여기서는 칸 이름 목록과 값 검증만.
export const SLOT_IDS = [
  "connect_done", // 연결 요청 완료
  "sell_done", // 판매 신청 완료
  "supply_done", // 공급 제안 완료
  "logistics_shipping", // 점핑 도구함 탭별
  "logistics_pallet",
  "logistics_weather",
  "logistics_fx",
  "home_board_member", // 알림판 (회원 홈)
  "home_board_guest", // 알림판 (비회원 홈)
  "deals_board", // 알림판 (/deals)
] as const;

export type SlotId = (typeof SLOT_IDS)[number];
export type MetricKind = "impression" | "click";

const SLOT_RE = /^[a-z0-9_]{1,40}$/;
const PARTNER_ID_RE = /^[a-z0-9_-]{1,60}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSlot(v: unknown): v is SlotId {
  return typeof v === "string" && SLOT_RE.test(v) && (SLOT_IDS as readonly string[]).includes(v);
}
export function isValidPartnerId(v: unknown): v is string {
  return typeof v === "string" && PARTNER_ID_RE.test(v);
}
export function isValidKind(v: unknown): v is MetricKind {
  return v === "impression" || v === "click";
}
export function isValidDealId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** /api/metrics/slot 본문 검증 — 통과하면 정리된 값, 아니면 null */
export function parseSlotBody(body: unknown): { slot: SlotId; partnerId: string; kind: MetricKind } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isValidSlot(b.slot) || !isValidPartnerId(b.partnerId) || !isValidKind(b.kind)) return null;
  return { slot: b.slot, partnerId: b.partnerId, kind: b.kind };
}

/** /api/metrics/deal-view 본문 검증 */
export function parseDealViewBody(body: unknown): { dealId: string } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  return isValidDealId(b.dealId) ? { dealId: b.dealId } : null;
}

// ── 칸에 돌려 보여줄 항목 (2026-11-01 feat/partner-card-slots) — 지금은 자사 안내만. 외부 업체는 이 상수에 chip "external"로 추가.
export type PartnerAudience = "member" | "guest";
export type PartnerAction = { type: "link"; href: string } | { type: "kakao" } | { type: "waitlist" };
export type PartnerItem = {
  id: string; // partnerId(집계 키) — isValidPartnerId 규칙
  chip: "notice" | "external"; // 칩 문구는 항목에서 결정
  icon: string; // 제목 앞 이모지(알림판·카드 공통, 2026-11-02)
  title: string;
  desc: string;
  cta: string;
  audience: PartnerAudience;
  action: PartnerAction;
};
export const PARTNER_CHIP_LABEL = { notice: "덤핑점핑 안내", external: "광고" } as const;
export const JUMPX_WAITLIST_ID = "jumpx_waitlist";
// 카카오 항목은 채널 "친구 추가" 주소(소식 받기). 문의용 채팅 주소(BUSINESS_INFO.kakaoChannel)와 다름 — 그쪽은 바꾸지 않음.
export const PARTNER_KAKAO_FRIEND_URL = "https://pf.kakao.com/_xcFZrX/friend";

// 점프엑스 항목은 "오픈 알림 받기"만 — 경매·결제 등 아직 열리지 않은 기능은 적지 않는다.
export const PARTNER_ITEMS: readonly PartnerItem[] = [
  { id: "sell", icon: "📦", chip: "notice", audience: "member", action: { type: "link", href: "/sell" }, title: "팔고 싶은 재고가 있으세요?", desc: "등록하면 점핑매니저가 검토 후 연락드려요", cta: "판매 등록하기" },
  { id: "buy", icon: "🔎", chip: "notice", audience: "member", action: { type: "link", href: "/buy" }, title: "찾는 상품이 있으세요?", desc: "구매 요청을 남기면 공급 제안을 점핑매니저가 전해 드려요", cta: "찾습니다 등록하기" },
  { id: "partner", icon: "🤝", chip: "notice", audience: "member", action: { type: "link", href: "/share" }, title: "점핑파트너", desc: "추천 링크를 공유하고 공식 점핑파트너도 신청할 수 있어요", cta: "자세히 보기" },
  { id: "kakao", icon: "💬", chip: "notice", audience: "member", action: { type: "kakao" }, title: "카카오 채널 추가", desc: "새 매물 소식을 카카오톡으로 받아보세요", cta: "채널 추가하기" },
  { id: JUMPX_WAITLIST_ID, icon: "🔔", chip: "notice", audience: "member", action: { type: "waitlist" }, title: "점프엑스 오픈 알림", desc: "점프엑스가 열리면 가장 먼저 알려드려요", cta: "오픈 알림 받기" },
  { id: "signup", icon: "✍️", chip: "notice", audience: "guest", action: { type: "link", href: "/signup" }, title: "가입하면 새 매물을 알림으로 받아요", desc: "관심 카테고리만 골라 두면 돼요", cta: "가입하기" },
  { id: "sell_guest", icon: "📦", chip: "notice", audience: "guest", action: { type: "link", href: "/sell" }, title: "팔고 싶은 재고가 있으세요?", desc: "등록하면 점핑매니저가 검토 후 연락드려요", cta: "판매 등록하기" },
];

/** 이 사용자에게 돌릴 항목 — 점프엑스 항목은 플래그(JUMPX_WAITLIST_SLOT_ENABLED)가 켜져 있을 때만, excludeIds는 지금 화면과 겹치는 항목 */
export function partnerRotation(audience: PartnerAudience, jumpxWaitlistEnabled: boolean, excludeIds: readonly string[] = []): PartnerItem[] {
  return PARTNER_ITEMS.filter(
    (it) => it.audience === audience && (jumpxWaitlistEnabled || it.action.type !== "waitlist") && !excludeIds.includes(it.id)
  );
}

// ── 알림판 회전 순서 (2026-11-02 feat/partner-board-rotation)
// "찾습니다" 요약 알림(집계 id buy_notice)은 항목 목록(PARTNER_ITEMS)과 별개 — 알림판에서만 쓰는 0번 항목.
export const BUY_NOTICE_ID = "buy_notice";
export const BOARD_ROTATE_MS = 6000;

/**
 * 알림판이 돌 순서(항목 id) — "찾습니다"(buy_notice)와 안내 항목을 번갈아 끼워 넣음(찾습니다 비중 50%), 항상 buy_notice에서 시작.
 * 안내 항목은 PR 2 목록에서 "찾습니다 등록하기"(buy — 알림판의 찾습니다와 겹침)와 점프엑스 오픈 알림(칸 한 줄에 상태를 담기 어려움)을 뺀 것.
 * 회원: buy_notice, sell, buy_notice, partner, buy_notice, kakao / 비회원: buy_notice, signup, buy_notice, sell_guest
 */
export function boardSequence(audience: PartnerAudience): string[] {
  const others = partnerRotation(audience, false, ["buy"]).map((i) => i.id);
  if (others.length === 0) return [BUY_NOTICE_ID];
  return others.flatMap((id) => [BUY_NOTICE_ID, id]);
}
