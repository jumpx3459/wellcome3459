// 매물명·설명 검사 (2026-10-01 PR-A [11]) — 관리자 매물 등록 폼과 /sell 판매 신청이 같은 규칙. 서버 API도 이 파일로 다시 검사.
//   정리: 앞뒤 공백 제거, 연속 공백 1칸, 관리자 "[테스트]" 뒤 공백 1칸
//   막기(400 field "title"): 2자 미만 / 60자 초과 / 숫자·기호만 / 연락처·링크 / 회원 폼의 "[테스트]"
//   확인 후 저장(경고 → "그대로 저장"): 단독 자음·모음 / 같은 글자 4번 이상 / 이모지 3개 이상 / 과장 표현 / 같은 판매자의 같은 이름 진행 중 매물(서버)
//   설명: 연락처·링크는 경고만
export const TITLE_MIN = 2;
export const TITLE_MAX = 60;
export const TEST_TAG = "[테스트]";

// 과장 표현 — 목록은 여기 한 곳에서만 관리
export const EXAGGERATION_WORDS = ["최저가", "100%", "무조건", "최고", "역대급", "파격", "초특가", "대박", "완판", "1등"];

const PHONE_RE = /(01[016789]|0[2-6]\d?|070)[\s.-]?\d{3,4}[\s.-]?\d{4}|1[568]\d{2}[\s.-]?\d{4}/;
const LINK_RE = /https?:\/\/|www\.|\.(com|kr|net|org|io|me|shop|kr\b)/i;
const CONTACT_WORD_RE = /카톡|카카오톡|오픈\s?채팅|오픈톡|텔레그램|라인\s?ID|(?:^|\s)ID\s*[:：]|아이디\s*[:：]/i;
const LONE_JAMO_RE = /[ㄱ-ㅎㅏ-ㅣ]/;
const REPEAT_RE = /(.)\1{3,}/u;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function normalizeTitle(raw: unknown, opts: { admin?: boolean } = {}): string {
  let t = typeof raw === "string" ? raw : "";
  t = t.replace(/\s+/g, " ").trim();
  if (opts.admin && t.includes(TEST_TAG)) t = t.replace(/\[테스트\]\s*/g, `${TEST_TAG} `).trim();
  return t;
}

export const hasContactOrLink = (text: string) => PHONE_RE.test(text) || LINK_RE.test(text) || CONTACT_WORD_RE.test(text);

export type TitleCheck = { block: string | null; warnings: string[] };

export function checkTitle(title: string, opts: { admin?: boolean } = {}): TitleCheck {
  const len = [...title].length;
  if (len < TITLE_MIN) return { block: `매물명은 ${TITLE_MIN}자 이상으로 적어주세요.`, warnings: [] };
  if (len > TITLE_MAX) return { block: `매물명은 ${TITLE_MAX}자 이하로 적어주세요. (지금 ${len}자)`, warnings: [] };
  if (!/[가-힣a-zA-Z]/.test(title)) return { block: "매물명에 상품 이름(글자)을 넣어주세요. 숫자·기호만으로는 등록할 수 없어요.", warnings: [] };
  if (hasContactOrLink(title)) return { block: "매물명에 연락처·링크·메신저 ID는 넣을 수 없어요. 연락은 점핑매니저가 이어드려요.", warnings: [] };
  if (!opts.admin && title.includes(TEST_TAG)) return { block: `"${TEST_TAG}"는 관리자만 쓸 수 있어요.`, warnings: [] };

  const warnings: string[] = [];
  if (LONE_JAMO_RE.test(title)) warnings.push("자음·모음만 있는 글자가 있어요 (예: ㅋㅋ, ㅠㅠ).");
  if (REPEAT_RE.test(title)) warnings.push("같은 글자가 4번 이상 반복돼요.");
  if ((title.match(EMOJI_RE) ?? []).length >= 3) warnings.push("이모지가 3개 이상이에요.");
  const hype = EXAGGERATION_WORDS.filter((w) => title.includes(w));
  if (hype.length) warnings.push(`과장 표현이 있어요: ${hype.join(", ")} — 사실과 다르면 신뢰도가 떨어질 수 있어요.`);
  return { block: null, warnings };
}

export function checkDescription(text: unknown): string[] {
  const t = typeof text === "string" ? text : "";
  return t && hasContactOrLink(t) ? ["설명에 연락처·링크·메신저 ID가 있어요. 연락은 점핑매니저가 이어드려요 — 그대로 둘지 확인해주세요."] : [];
}

export const DUPLICATE_TITLE_WARNING = "같은 판매자의 같은 이름 매물이 이미 진행 중이에요.";
