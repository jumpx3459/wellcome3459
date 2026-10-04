-- ============================================================================
-- 2026-10-04 F-4 거래 연결 보드 — interests 회원 수정 차단 (기록용)
-- ** 운영 실행 완료(10/4, 대표) ** — 다시 실행해도 결과는 같음(이미 회수된 권한 회수).
--
-- 왜: interests_self_update 정책(본인 행)이 칼럼 제한 없이 update를 허용 → 회원이 브라우저에서 자기 리드의
--     contacted·outcome·completed_amount(KPI 성사율·성사 금액의 근거)를 바꿀 수 있었음.
--     Supabase 기본 권한은 표 단위 UPDATE라 칼럼 단위 revoke만으로는 막히지 않음 → 표 단위 UPDATE 회수.
-- 영향 없음(2026-10-04 조사): 회원 화면은 insert(upsert ignoreDuplicates = on conflict do nothing)·select만 하고
--     update 호출이 없음. 관리자 쓰기(/api/admin/interests PATCH, /api/admin/connections 단계 전환)는 service role.
--     KPI 함수(admin_category_kpis·kpi_snapshot)는 security definer 읽기.
--     interests_self_update 정책은 남아 있지만 UPDATE 권한이 없어 쓰이지 않음(되돌리기 때 다시 살아남).
-- ============================================================================

revoke update on public.interests from anon, authenticated;

-- 확인 — 기대: anon_update false · auth_update false · auth_insert true · auth_select true
-- select has_table_privilege('anon', 'public.interests', 'UPDATE')          as anon_update,
--        has_table_privilege('authenticated', 'public.interests', 'UPDATE') as auth_update,
--        has_table_privilege('authenticated', 'public.interests', 'INSERT') as auth_insert,
--        has_table_privilege('authenticated', 'public.interests', 'SELECT') as auth_select;

-- ============================================================================
-- 되돌리기
-- ============================================================================
-- grant update on public.interests to anon, authenticated;
