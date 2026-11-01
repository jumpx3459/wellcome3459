import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getMemberFromToken } from "@/lib/photoLimitServer";
import { getTestBuyerLookup } from "@/lib/kpiExclusion";
import { overLimit } from "@/lib/rateLimit";
import { isBotUserAgent } from "@/lib/metricsCore";

// 일별 합계 기록 API 공통 처리 (2026-10-30 feat/stats-foundation) — /api/metrics/slot · /api/metrics/deal-view.
// 순서: 입력 검증(400) → 봇 UA(204) → 호출 폭주(429) → 토큰 회원 판정·KPI 제외(204) → service role로 rpc → 오류 포함 항상 204.
// 판정 결과(봇·제외·없는 매물)는 응답에 드러내지 않는다.
const NO_CONTENT = () => new NextResponse(null, { status: 204 });
const IP_LIMIT = 120; // 10분당 IP별 — 세션당 1회 기록이라 정상 사용은 이보다 훨씬 적음

// 관리자·테스트 회원 판정 캐시(인스턴스 메모리, 5분) — 요청마다 뷰를 읽지 않으려고
const excludedCache = new Map<string, { at: number; excluded: boolean }>();
const EXCLUDED_TTL_MS = 5 * 60 * 1000;

async function isExcludedMember(db: SupabaseClient, memberId: string): Promise<boolean> {
  const hit = excludedCache.get(memberId);
  if (hit && Date.now() - hit.at < EXCLUDED_TTL_MS) return hit.excluded;
  let excluded = false;
  try {
    excluded = (await getTestBuyerLookup(db, [memberId])).memberIds.has(memberId); // 뷰 → 실패 시 is_test + 관리자 번호
  } catch {
    excluded = false;
  }
  excludedCache.set(memberId, { at: Date.now(), excluded });
  return excluded;
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

type Handled<T> = {
  parse: (body: unknown) => T | null;
  /** 검증·판정을 통과한 요청의 기록 — isMember는 토큰으로 확인된 회원 여부 */
  record: (db: SupabaseClient, input: T, isMember: boolean) => PromiseLike<{ error: unknown }>;
  rateKey: string;
};

export async function handleMetric<T>(req: NextRequest, h: Handled<T>): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  const input = h.parse(body);
  if (!input) return NextResponse.json({ error: "bad request" }, { status: 400 });

  if (isBotUserAgent(req.headers.get("user-agent"))) return NO_CONTENT();

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (overLimit(`${h.rateKey}:${ip}`, IP_LIMIT)) return new NextResponse(null, { status: 429 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NO_CONTENT(); // 로컬 데모

  const db = createClient(supabaseUrl, serviceKey);
  let isMember = false;
  const token = bearer(req);
  if (token) {
    const member = await getMemberFromToken(db, token).catch(() => null);
    if (member) {
      if (await isExcludedMember(db, member.id)) return NO_CONTENT(); // 관리자·is_test는 기록 생략
      isMember = true;
    }
  }

  try {
    const { error } = await h.record(db, input, isMember);
    if (error) console.warn(`[metrics] ${h.rateKey} 기록 실패`, (error as { code?: string }).code ?? "");
  } catch {
    // 기록 실패는 화면과 무관 — 삼킴
  }
  return NO_CONTENT();
}
