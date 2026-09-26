// 2026-09-26: 혼합매물(리퀴데이션/반품 팔레트) 매니페스트 CSV를 구조화 매핑 없이
// 그대로 테이블로 보여주기 위한 최소 파서. 서드파티 의존성 없음 — 표준 라이브러리인
// xlsx(SheetJS)의 npm 배포판은 알려진 취약점(Prototype Pollution/ReDoS)이 패치 안 돼
// 있고, 패치된 버전은 SheetJS 자체 CDN(cdn.sheetjs.com)에서만 배포되는데 이 개발
// 환경에서는 그 호스트 접근이 막혀 있어 받아올 수 없었음 — 그래서 스코프를 CSV로
// 좁히고 파서를 직접 구현함. 업로드는 항상 브라우저(판매자/관리자 자신의 파일)에서만
// 일어나고 서버는 파싱된 JSON만 받으므로, 서버 쪽엔 파일 파싱 공격면 자체가 없음.
//
// 헤더 자동 매핑(품목/수량/가격 등 추정)은 하지 않음 — 리퀴데이션 매니페스트마다
// 컬럼명이 제각각이라 억지로 매핑하면 오탐이 더 위험함. 대신 CSV의 헤더 행을 그대로
// 컬럼명으로 써서 원본 그대로 테이블로 보여줌.

export type ManifestRow = Record<string, string>;

const MAX_ROWS = 500;
const MAX_COLS = 30;

export function parseCsv(text: string): { headers: string[]; rows: ManifestRow[]; truncated: boolean } {
  const cells: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    cells.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      pushField();
      continue;
    }
    if (c === "\n") {
      pushRow();
      continue;
    }
    if (c === "\r") continue;
    field += c;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmpty = cells.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [], truncated: false };

  const headers = nonEmpty[0].slice(0, MAX_COLS).map((h, i) => h.trim() || `열${i + 1}`);
  const dataRows = nonEmpty.slice(1);
  const truncated = dataRows.length > MAX_ROWS;
  const rows: ManifestRow[] = dataRows.slice(0, MAX_ROWS).map((r) => {
    const obj: ManifestRow = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });

  return { headers, rows, truncated };
}

// 서버(API)용 — 브라우저의 2MB/500행 제한은 클라이언트에서만 걸려서, 공개 API
// (/api/seller-requests)에 직접 요청하면 거대한 JSON이나 문자열이 아닌 값(객체 등)을
// 그대로 저장할 수 있었음. 객체 값은 상세 페이지 표 렌더링에서 React 에러로 페이지를
// 깨뜨리므로, 저장 전에 모양/크기를 강제함.
const MAX_KEY_LEN = 100;
const MAX_VALUE_LEN = 500;

export function sanitizeManifest(input: unknown): ManifestRow[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const rows: ManifestRow[] = [];
  for (const raw of input.slice(0, MAX_ROWS)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row: ManifestRow = {};
    for (const [k, v] of Object.entries(raw).slice(0, MAX_COLS)) {
      if (typeof v !== "string" && typeof v !== "number") continue;
      row[String(k).slice(0, MAX_KEY_LEN)] = String(v).slice(0, MAX_VALUE_LEN);
    }
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows.length ? rows : null;
}

export function sanitizePid(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, 100) : null;
}
