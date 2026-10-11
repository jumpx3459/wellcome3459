import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";

// KPI에서 뺄 회원 (2026-09-30, 커밋 K) — 관리자·테스트 계정. 서버(service role) 전용.
// 기준은 DB 뷰 kpi_excluded_members(schema.sql 커밋 K 블록): members.is_test, admin_users 번호, kpi_excluded_phones(설립자 등).
// 뷰가 아직 없으면(SQL 실행 전) admin_users 번호와 같은 회원만 빼는 것으로 대신한다.

export async function getKpiExcludedMemberIds(
  db: SupabaseClient
): Promise<{ ids: string[]; source: "view" | "admin_phones" }> {
  const view = await db.from("kpi_excluded_members").select("id");
  if (!view.error) return { ids: (view.data ?? []).map((r) => r.id as string), source: "view" };

  const [{ data: admins }, { data: members }] = await Promise.all([
    db.from("admin_users").select("phone"),
    db.from("members").select("id, phone").limit(20000),
  ]);
  const adminPhones = new Set((admins ?? []).map((a) => normalizePhone(a.phone)).filter(Boolean));
  const ids = (members ?? []).filter((m) => adminPhones.has(normalizePhone(m.phone))).map((m) => m.id as string);
  return { ids, source: "admin_phones" };
}

// 2026-10-11 거래 연결 보드: 테스트 건 표시용 — 구매자가 KPI 제외 대상인지.
//   회원: kpi_excluded_members 뷰(is_test·관리자 번호·제외 번호 표). 뷰 조회가 실패하면 members.is_test + 관리자 번호로 대신.
//   비회원(번호만): kpi_excluded_phones · admin_users 번호. 조회 실패는 "테스트 아님"으로(목록은 그대로 보여줌).
export async function getTestBuyerLookup(
  db: SupabaseClient,
  memberIds: string[]
): Promise<{ memberIds: Set<string>; phones: Set<string> }> {
  const ids = [...new Set(memberIds)];
  const [view, admins, excluded] = await Promise.all([
    ids.length ? db.from("kpi_excluded_members").select("id").in("id", ids) : Promise.resolve({ data: [], error: null }),
    db.from("admin_users").select("phone"),
    db.from("kpi_excluded_phones").select("phone"),
  ]);
  const phones = new Set(
    [...(admins.data ?? []), ...(excluded.data ?? [])].map((r) => normalizePhone((r as { phone: string | null }).phone)).filter(Boolean)
  );
  let testIds: string[] = [];
  if (!view.error) testIds = (view.data ?? []).map((r) => (r as { id: string }).id);
  else if (ids.length) {
    const { data } = await db.from("members").select("id, phone, is_test").in("id", ids);
    testIds = (data ?? []).filter((m) => m.is_test || phones.has(normalizePhone(m.phone))).map((m) => m.id as string);
  }
  return { memberIds: new Set(testIds), phones };
}

// PostgREST in() 목록 — 비어 있으면 필터를 걸지 않는다
export const inList = (ids: string[]) => `(${ids.join(",")})`;

// 테스트 매물: 제목에 "[테스트]" (src/lib/categoryAvg.ts isTestTitle와 같은 기준)
export const TEST_TITLE_PATTERN = "%[테스트]%";
