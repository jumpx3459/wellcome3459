// 거래 연결 단계별 안내 문구(문자 복사용) — 2026-11-02. 문구는 이 파일 한 곳에만 둠(화면에서 직접 문자열을 만들지 않음).
// 자동 채움: {상품명} = 매물 제목, {구매자번호} = 구매자 전체 번호(③만). 판매자 상호·연락처는 문구에 넣지 않음(상호 허락 여부와 무관하게 수동).
// 다른 모듈 import 없음(단위 시험용). 경매·입찰·낙찰·검증·점프엑스 표현 금지(시험으로 확인).
export const MESSAGE_INQUIRY_TEL = "070-4006-0890";
export const MESSAGE_TITLE_FALLBACK = "(매물명 없음)";

type Vars = { 상품명: string; 구매자번호?: string };

// 한 번에 치환 — 상품명 안에 "{구매자번호}" 같은 글자가 있어도 다시 치환되지 않음
function fill(template: string, vars: Vars): string {
  return template.replace(/\{(상품명|구매자번호)\}/g, (_m, k: keyof Vars) => vars[k] ?? "");
}
const title = (t: string) => (t.trim() ? t.trim() : MESSAGE_TITLE_FALLBACK);
const TEL_LINE = `문의 ${MESSAGE_INQUIRY_TEL}`;

/** ① 판매자 확인 카드 — 재고 확인 (판매자에게) */
const SELLER_STOCK = [
  "[덤핑점핑] 구매 문의 안내",
  "",
  "안녕하세요, 덤핑점핑 점핑매니저입니다.",
  "등록하신 '{상품명}'에 구매 문의가 들어왔습니다.",
  "",
  "아래 두 가지만 이 문자에 답장 주세요.",
  "1. 지금도 판매 가능한가요? (남은 수량, 가격 변동 있으면 함께)",
  "2. 구매자에게 상호를 안내해도 될까요? (네 / 비공개)",
  "",
  "판매 가능하시면 구매자 확인 후 구매자 연락처를 전달해 드리고, 거래 조건은 직접 협의하시면 됩니다.",
  "",
  TEL_LINE,
].join("\n");

/** ② 구매자 확인 카드 — 구매자 확인 (구매자에게) */
const BUYER_CONFIRM = [
  "[덤핑점핑] 안녕하세요, 덤핑점핑 점핑매니저입니다.",
  "문의하신 '{상품명}' 판매자분께 재고 확인을 마쳤습니다.",
  "",
  "아직 구매를 원하시면 아래 두 가지만 이 문자에 답장 주세요.",
  "1) 필요 수량",
  "2) 희망 입고 시기",
  "",
  "확인되면 판매자분께 고객님 연락처를 전달해 드립니다. 거래 조건은 판매자분과 직접 협의하시면 됩니다.",
  "",
  TEL_LINE,
].join("\n");

/** ③ 연락처 전달 카드 — 구매자 번호 전달 (판매자에게). 구매자 전체 번호가 들어가므로 복사할 때 서버가 번호 보기와 같은 권한 검사·감사 기록(copy=true) */
const CONTACT_SENT = [
  "[덤핑점핑] 안녕하세요, 덤핑점핑 점핑매니저입니다.",
  "'{상품명}' 구매 희망 고객 연락처를 전달드립니다.",
  "",
  "구매자 번호: {구매자번호}",
  "",
  "거래 조건은 구매자분과 직접 협의해 주세요. 거래가 되면 덤핑점핑에 알려주시면 감사하겠습니다.",
  "",
  TEL_LINE,
].join("\n");

/** 종료 카드(사유 "판매자 재고 없음") — 품절 안내 (구매자에게) */
const SOLD_OUT = [
  "[덤핑점핑] 안녕하세요, 덤핑점핑 점핑매니저입니다.",
  "문의하신 '{상품명}'는 판매자분 확인 결과 아쉽게도 품절되었습니다. 기다려 주셨는데 죄송합니다.",
  "",
  "비슷한 상품을 찾아봐 드릴까요? 아래만 이 문자에 답장 주시면 들어오는 대로 먼저 연락드리겠습니다.",
  "1) 필요 수량",
  "2) 희망 단가",
  "3) 원하시는 조건(규격·용도 등)",
  "",
  TEL_LINE,
].join("\n");

export const sellerStockMessage = (dealTitle: string) => fill(SELLER_STOCK, { 상품명: title(dealTitle) });
export const buyerConfirmMessage = (dealTitle: string) => fill(BUYER_CONFIRM, { 상품명: title(dealTitle) });
export const contactSentMessage = (dealTitle: string, buyerPhone: string) => fill(CONTACT_SENT, { 상품명: title(dealTitle), 구매자번호: buyerPhone });
export const soldOutMessage = (dealTitle: string) => fill(SOLD_OUT, { 상품명: title(dealTitle) });
