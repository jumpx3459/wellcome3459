// 관리자 회원 검색어 해석 (순수 함수 — 화면과 서버 로더가 같은 규칙을 씀)
//
// 규칙(대표 결정 2026-11-07):
//   · 'JX'/'jx' 접두어 → member_no 일치만 (JX-00013, jx-00013, jx13)
//   · 숫자만(하이픈·공백 허용) → member_no 일치 OR 전화번호 부분 일치, 둘 다 결과에 나옴
//     (회원번호 7001과 전화 뒷자리 7001이 겹쳐도 둘 다 보임. 숫자 자릿수로 가르지 않음)
//   · 그 밖의 문자 → 상호·닉네임 부분 일치 — 현행대로 화면에서 최근 가입 목록을 거름(닉네임은 Auth 메타데이터라 DB로 못 찾음)
// 서버 검색은 code·digits만 쓴다. text·none은 서버에 q를 보내지 않는다.

export type MemberSearch =
  | { kind: "none" }
  | { kind: "code"; no: number | null } // no null = 'JX' 뒤가 번호 모양이 아님 → 결과 없음
  | { kind: "digits"; digits: string; no: number | null } // no null = 회원번호로 쓰기엔 너무 긴 숫자 → 전화번호만
  | { kind: "text"; text: string };

const MAX_MEMBER_NO_DIGITS = 9; // members.member_no는 정수(int) — 9자리까지만 번호로 취급

function toMemberNo(digits: string): number | null {
  if (!digits || digits.length > MAX_MEMBER_NO_DIGITS) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function parseMemberSearch(raw: string | null | undefined): MemberSearch {
  const q = (raw ?? "").trim();
  if (!q) return { kind: "none" };

  if (/^jx/i.test(q)) {
    const rest = q.slice(2);
    if (/^[-\s]*\d+$/.test(rest)) return { kind: "code", no: toMemberNo(rest.replace(/\D/g, "")) };
    return { kind: "code", no: null };
  }

  if (/^[\d\s-]+$/.test(q)) {
    const digits = q.replace(/\D/g, "");
    if (!digits) return { kind: "text", text: q }; // "-" 같은 입력은 숫자 검색이 아님
    return { kind: "digits", digits, no: toMemberNo(digits) };
  }

  return { kind: "text", text: q };
}

// 서버에 보낼 검색어인가 (code·digits만)
export function isServerSearch(s: MemberSearch): boolean {
  return s.kind === "code" || s.kind === "digits";
}
