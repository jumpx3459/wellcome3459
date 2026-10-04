// 국세청 사업자등록정보 진위확인·상태조회 (2026-10-04 판매자 신원 확인) — 서버 전용(API 라우트에서만 import).
// 공식 명세: 공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스"(data.go.kr/data/15081808),
//   Swagger https://infuser.odcloud.kr/api/stages/28493/api-docs (v1.1, 2026-10-04 확인)
//   · POST {base}/validate · POST {base}/status, base = https://api.odcloud.kr/api/nts-businessman/v1
//   · serviceKey는 URL 쿼리, 나머지는 JSON body. 1회 최대 100건
//   · validate body {businesses:[{b_no, start_dt, p_nm, p_nm2?, b_nm?, ...}]} → data[].valid "01"(일치)/"02"(확인할 수 없습니다),
//     일치면 data[].status에 상태조회 결과가 같이 옴
//   · status body {b_no:[...]} → data[].b_stt_cd "01" 계속 / "02" 휴업 / "03" 폐업, 미등록·삭제면 b_stt_cd ""이고
//     tax_type = "국세청에 등록되지 않은 사업자등록번호입니다"
//   · 오류는 HTTP 400·411·413·500 + {status_code: "BAD_JSON_REQUEST" 등}
// 이 모듈은 예외를 밖으로 던지지 않음 — 5xx·4xx·타임아웃·잘못된 JSON·키 없음은 result "error"(= 확인 대기).
// 사업자번호·서비스키는 로그에 남기지 않음(오류는 종류만 console에).

export const NTS_DEFAULT_BASE_URL = "https://api.odcloud.kr/api/nts-businessman/v1";
const TIMEOUT_MS = 5000;

export type NtsErrorKind = "no_key" | "timeout" | "http_5xx" | "http_4xx" | "bad_json" | "network";

export type NtsStatus = {
  /** b_stt_cd: "01" 계속 / "02" 휴업 / "03" 폐업 / "" 미등록 */
  code: string;
  /** b_stt(명칭), 미등록이면 tax_type 안내문 */
  text: string | null;
  taxType: string | null;
};

export type NtsValidateResult =
  | { result: "01"; status: NtsStatus | null }
  | { result: "02" }
  | { result: "error"; errorKind: NtsErrorKind };

export type NtsStatusResult = { result: "ok"; status: NtsStatus } | { result: "error"; errorKind: NtsErrorKind };

/** 사업자번호 → 숫자 10자리(하이픈·공백 제거). 10자리가 아니면 null */
export function normalizeBizNo(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = String(v).replace(/[^0-9]/g, "");
  return /^[0-9]{10}$/.test(d) ? d : null;
}

/** 개업일자 → YYYYMMDD("2020-01-02"·"2020.01.02"·"20200102" 허용). 실제 날짜가 아니면 null */
export function normalizeOpenDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = v.replace(/[^0-9]/g, "");
  if (!/^[0-9]{8}$/.test(d)) return null;
  const y = +d.slice(0, 4), m = +d.slice(4, 6), day = +d.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, day));
  if (y < 1900 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== day) return null;
  return d;
}

/** 감사 로그·화면용 마스킹: "123-45-*****" */
export function maskBizNo(bNo: string | null | undefined): string | null {
  const d = (bNo ?? "").replace(/[^0-9]/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-*****` : null;
}

function baseUrl() {
  return (process.env.NTS_API_BASE_URL || NTS_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

// 공공데이터포털 인증키는 "Encoding"(URL 인코딩된 값)과 "Decoding"(원문) 두 가지로 보여줌.
// 권장은 Decoding 키 — 여기서 encodeURIComponent로 한 번 인코딩해 붙임.
// Encoding 키를 넣었으면(% 포함) 이미 인코딩된 값이라 그대로 붙여 이중 인코딩을 막음 → 어느 쪽을 넣어도 동작.
function serviceKeyParam(): string | null {
  const key = process.env.NTS_API_KEY?.trim();
  if (!key) return null;
  return /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
}

type PostResult = { ok: true; json: unknown } | { ok: false; errorKind: NtsErrorKind };

async function post(path: "/validate" | "/status", body: unknown): Promise<PostResult> {
  const key = serviceKeyParam();
  if (!key) return { ok: false, errorKind: "no_key" };
  const url = `${baseUrl()}${path}?serviceKey=${key}&returnType=JSON`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[nts] HTTP", path, res.status);
      return { ok: false, errorKind: res.status >= 500 ? "http_5xx" : "http_4xx" };
    }
    try {
      return { ok: true, json: JSON.parse(text) };
    } catch {
      console.error("[nts] bad json", path);
      return { ok: false, errorKind: "bad_json" };
    }
  } catch (e) {
    const timeout = ctrl.signal.aborted || (e instanceof Error && e.name === "AbortError");
    console.error("[nts]", timeout ? "timeout" : "network", path);
    return { ok: false, errorKind: timeout ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : null);

function parseStatus(s: unknown): NtsStatus | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const code = str(o.b_stt_cd);
  if (code == null) return null;
  const taxType = str(o.tax_type) || null;
  return { code, text: str(o.b_stt) || (code === "" ? taxType : null), taxType };
}

/** 첫 data 항목 — 형식이 다르면 null(= bad_json으로 처리) */
function firstData(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const data = (json as { data?: unknown }).data;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") return null;
  return data[0] as Record<string, unknown>;
}

/** 상태조회 — 사업자번호 1건 */
export async function ntsStatus(bNo: string): Promise<NtsStatusResult> {
  const r = await post("/status", { b_no: [bNo] });
  if (!r.ok) return { result: "error", errorKind: r.errorKind };
  const status = parseStatus(firstData(r.json));
  return status ? { result: "ok", status } : { result: "error", errorKind: "bad_json" };
}

/** 진위확인 — 일치(01)면 응답에 같이 온 상태를 쓰고, 없으면 상태조회를 한 번 더(실패해도 진위 결과는 유지, status null) */
export async function ntsValidate(input: { bNo: string; repName: string; openDate: string; companyName?: string | null }): Promise<NtsValidateResult> {
  const biz: Record<string, string> = { b_no: input.bNo, start_dt: input.openDate, p_nm: input.repName };
  // 상호는 선택 — 빈 값이면 아예 안 보냄(명세: 빈 값으로 검색하려면 ""를 넣어야 하고, 넣으면 그 값까지 비교함)
  if (input.companyName && input.companyName.trim()) biz.b_nm = input.companyName.trim();
  const r = await post("/validate", { businesses: [biz] });
  if (!r.ok) return { result: "error", errorKind: r.errorKind };
  const item = firstData(r.json);
  const valid = item ? str(item.valid) : null;
  if (valid === "02") return { result: "02" };
  if (valid !== "01") return { result: "error", errorKind: "bad_json" };
  let status = parseStatus(item!.status);
  if (!status) {
    const s = await ntsStatus(input.bNo);
    status = s.result === "ok" ? s.status : null;
  }
  return { result: "01", status };
}
