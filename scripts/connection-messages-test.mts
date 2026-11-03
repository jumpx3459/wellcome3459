// 거래 연결 안내 문구 단위 시험 — src/lib/connectionMessages.ts (2026-11-02 feat/closed-connection-contact-view).
// 실행: node --experimental-strip-types scripts/connection-messages-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const M = await import(pathToFileURL(join(root, "src/lib/connectionMessages.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) {
    failed++;
    console.error(`FAIL ${msg}\n  got : ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
  } else console.log(`ok   ${msg}`);
};

const T = "냉동 삼겹살 10kg";

// ── 네 문구 전체(줄바꿈 유지) — 대표 확정 문구 그대로
eq(
  M.sellerStockMessage(T),
  `[덤핑점핑] 구매 문의 안내

안녕하세요, 덤핑점핑 점핑매니저입니다.
등록하신 '냉동 삼겹살 10kg'에 구매 문의가 들어왔습니다.

아래 두 가지만 이 문자에 답장 주세요.
1. 지금도 판매 가능한가요? (남은 수량, 가격 변동 있으면 함께)
2. 구매자에게 상호를 안내해도 될까요? (네 / 비공개)

판매 가능하시면 구매자 확인 후 구매자 연락처를 전달해 드리고, 거래 조건은 직접 협의하시면 됩니다.

문의 070-4006-0890`,
  "① 재고 확인(판매자) — 상품명 치환"
);
eq(
  M.buyerConfirmMessage(T),
  `[덤핑점핑] 안녕하세요, 덤핑점핑 점핑매니저입니다.
문의하신 '냉동 삼겹살 10kg' 판매자분께 재고 확인을 마쳤습니다.

아직 구매를 원하시면 아래 두 가지만 이 문자에 답장 주세요.
1) 필요 수량
2) 희망 입고 시기

확인되면 판매자분께 고객님 연락처를 전달해 드립니다. 거래 조건은 판매자분과 직접 협의하시면 됩니다.

구매 계획이 바뀌셨으면 '취소'라고만 답장 주셔도 됩니다.

문의 070-4006-0890`,
  "② 구매자 확인(구매자) — 상품명 치환 + 취소 안내 줄"
);
eq(
  M.contactSentMessage(T, "010-1234-5678"),
  `[덤핑점핑] 안녕하세요, 덤핑점핑 점핑매니저입니다.
'냉동 삼겹살 10kg' 구매 희망 고객 연락처를 전달드립니다.

구매자 번호: 010-1234-5678

거래 조건은 구매자분과 직접 협의해 주세요. 거래가 되면 덤핑점핑에 알려주시면 감사하겠습니다.

문의 070-4006-0890`,
  "③ 연락처 전달(판매자) — 상품명·구매자 번호 치환"
);
eq(
  M.soldOutMessage(T),
  `[덤핑점핑] 안녕하세요, 덤핑점핑 점핑매니저입니다.
문의하신 '냉동 삼겹살 10kg' 상품은 판매자분 확인 결과 아쉽게도 품절되었습니다. 기다려 주셨는데 죄송합니다.

비슷한 상품을 찾아봐 드릴까요? 아래만 이 문자에 답장 주시면 들어오는 대로 먼저 연락드리겠습니다.
1) 필요 수량
2) 희망 단가
3) 원하시는 조건(규격·용도 등)

문의 070-4006-0890`,
  "종료 — 품절 안내(구매자) — 상품명 치환(\"상품은\")"
);
eq(
  M.buyerCancelMessage(T),
  `[덤핑점핑] 안녕하세요, 덤핑점핑 점핑매니저입니다.
재고 확인해 주신 '냉동 삼겹살 10kg' 건은 구매자분 사정으로 이번에는 진행되지 않게 되었습니다.
바쁘신데 확인해 주셔서 감사합니다.

매물은 그대로 노출되고 있으며, 다른 구매 문의가 들어오면 다시 연락드리겠습니다.

문의 070-4006-0890`,
  "종료 — 취소 안내(판매자) — 상품명 치환"
);

// ── 치환 규칙
const all = (t: string) => [M.sellerStockMessage(t), M.buyerConfirmMessage(t), M.contactSentMessage(t, "010-0000-1111"), M.soldOutMessage(t), M.buyerCancelMessage(t)];
eq(all(T).every((s) => !/\{[^}]*\}/.test(s)), true, "자리표시({…})가 남지 않음");
eq(all("").every((s) => s.includes("'(매물명 없음)'")), true, "상품명이 비어 있으면 (매물명 없음)");
eq(M.contactSentMessage("  양파  ", "010-0000-1111").includes("'양파'"), true, "상품명 앞뒤 공백 제거");
eq(M.sellerStockMessage("{구매자번호} 특가").includes("'{구매자번호} 특가'"), true, "상품명 안의 {…} 글자는 다시 치환되지 않음");
eq(M.contactSentMessage("양파", "$& 010-0000-1111").includes("구매자 번호: $& 010-0000-1111"), true, "번호 값의 $ 기호도 그대로");
eq(M.sellerStockMessage(T).includes("구매자 번호"), false, "① 문구에는 구매자 번호 칸 없음");
eq(M.buyerConfirmMessage(T).includes("구매자 번호"), false, "② 문구에는 구매자 번호 칸 없음");
eq(M.soldOutMessage(T).includes("구매자 번호"), false, "품절 안내에는 구매자 번호 칸 없음");
eq(M.buyerCancelMessage(T).includes("구매자 번호"), false, "취소 안내에는 구매자 번호 칸 없음");
eq(M.buyerCancelMessage("").includes("'(매물명 없음)' 건은"), true, "취소 안내 — 상품명이 비면 (매물명 없음)");
eq(M.buyerCancelMessage("  양파  ").includes("'양파' 건은"), true, "취소 안내 — 상품명 앞뒤 공백 제거");

// ── 금지 표현 · 판매자 정보 미포함
const joined = all(T).join("\n");
eq(/경매|입찰|낙찰|검증|점프엑스|JumpX/i.test(joined), false, "금지 표현(경매·입찰·낙찰·검증·점프엑스) 0");
eq(/상호명|담당자|판매자 번호|판매자 연락처|연락처:/.test(joined), false, "판매자 상호·담당자·연락처 자리 없음");
eq(all(T).filter((s) => /01[0-9][-\s]?\d{3,4}[-\s]?\d{4}/.test(s)).length, 1, "휴대폰 번호 모양은 ③ 한 곳에만(구매자 번호)");
eq(/'취소'라고만 답장/.test(M.buyerConfirmMessage(T)) && all(T).filter((s) => s.includes("'취소'라고만 답장")).length === 1, true, "취소 답장 안내는 ② 한 곳에만")
eq(all(T).every((s) => s.endsWith("문의 070-4006-0890")), true, "모든 문구가 문의 번호로 끝남");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
