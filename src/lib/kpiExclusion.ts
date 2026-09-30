import type { SupabaseClient } from "@supabase/supabase-js";

// KPI에서 뺄 회원 (2026-09-30, 커밋 K) — 관리자·테스트 계정. 서버(service role) 전용.
// 기준은 DB 뷰 kpi_excluded_members(schema.sql 커밋 K 블록): members.is_test, admin_users 번호, kpi_excluded_phones(설립자 등).
// 뷰가 아직 없으면(SQL 실행 전) admin_users 번호와 같은 회원만 빼는 것으로 대신한다.
export const normalizePhone = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/[^0-9]/g, "");
  return d.startsWith("82") ? `0${d.slice(2)}` : d;
};

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

// PostgREST in() 목록 — 비어 있으면 필터를 걸지 않는다
export const inList = (ids: string[]) => `(${ids.join(",")})`;

// 테스트 매물: 제목에 "[테스트]" (src/lib/categoryAvg.ts isTestTitle와 같은 기준)
export const TEST_TITLE_PATTERN = "%[테스트]%";
