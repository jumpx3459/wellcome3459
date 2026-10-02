-- ============================================================================
-- 2026-10-01 F-2 확인 조회 — 20261001_f2_connections.sql과 짝. 모두 읽기만(마지막 F-test만 begin…rollback).
-- 각 조회는 결과 한 행. 번호는 실행 파일 블록과 같음.
-- ============================================================================

-- 0) 실행 전 — 지금 상태 (한 행)
--    deals_status: active·closed 외 값 0 / interests_policies: 1(interests_self) / new_tables: 0
select
  (select count(*) from public.deals where status not in ('active', 'closed') or status is null) as deals_other_status,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'interests') as interests_policies,
  (select count(*) from information_schema.tables where table_schema = 'public'
     and table_name in ('deal_connections', 'deal_connection_events', 'deal_seller_private')) as new_tables,
  (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'admin_users' and column_name = 'id') as admin_id_type,
  (select count(*) from public.seller_requests where linked_deal_id is not null) as linked_requests;

-- A·B·C) 표·컬럼·check·FK·인덱스 (한 행)
--    기대: tables 3 · conn_cols 23 · event_cols 9 · private_cols 13 · checks 14 · fks 8 · uniq_open 2 · idx_status 1
select
  (select count(*) from information_schema.tables where table_schema = 'public'
     and table_name in ('deal_connections', 'deal_connection_events', 'deal_seller_private')) as tables,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'deal_connections') as conn_cols,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'deal_connection_events') as event_cols,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'deal_seller_private') as private_cols,
  (select count(*) from pg_constraint where contype = 'c' and conrelid in
     ('public.deal_connections'::regclass, 'public.deal_connection_events'::regclass, 'public.deal_seller_private'::regclass)) as checks,
  (select count(*) from pg_constraint where contype = 'f' and conrelid in
     ('public.deal_connections'::regclass, 'public.deal_connection_events'::regclass, 'public.deal_seller_private'::regclass)) as fks,
  (select count(*) from pg_indexes where schemaname = 'public'
     and indexname in ('deal_connections_open_member_uniq', 'deal_connections_open_phone_uniq')) as uniq_open,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'deal_connections_status_updated_idx') as idx_status;

-- A) FK 삭제 동작 (한 행) — 기대: deal restrict(r) · buyer set null(n) · admin set null(n) · events restrict(r) · private cascade(c) · private_request set null(n)
select
  (select confdeltype from pg_constraint where conrelid = 'public.deal_connections'::regclass and contype = 'f'
     and confrelid = 'public.deals'::regclass) as conn_deal,
  (select confdeltype from pg_constraint where conrelid = 'public.deal_connections'::regclass and contype = 'f'
     and confrelid = 'public.members'::regclass) as conn_buyer,
  (select confdeltype from pg_constraint where conrelid = 'public.deal_connections'::regclass and contype = 'f'
     and confrelid = 'public.admin_users'::regclass) as conn_admin,
  (select confdeltype from pg_constraint where conrelid = 'public.deal_connection_events'::regclass and contype = 'f'
     and confrelid = 'public.deal_connections'::regclass) as events_conn,
  (select confdeltype from pg_constraint where conrelid = 'public.deal_seller_private'::regclass and contype = 'f'
     and confrelid = 'public.deals'::regclass) as private_deal,
  (select confdeltype from pg_constraint where conrelid = 'public.deal_seller_private'::regclass and contype = 'f'
     and confrelid = 'public.seller_requests'::regclass) as private_request;

-- B) 이력 수정·삭제 금지 트리거 (한 행) — 기대: immutable_trigger 1 · deal_id_not_null true
select
  (select count(*) from pg_trigger where tgrelid = 'public.deal_connection_events'::regclass
     and tgname = 'deal_connection_events_immutable' and not tgisinternal) as immutable_trigger,
  (select is_nullable = 'NO' from information_schema.columns where table_schema = 'public'
     and table_name = 'deal_connections' and column_name = 'deal_id') as deal_id_not_null;

-- D) 권한 (한 행) — 기대: rls 3 · policies 0 · anon_auth_grants 0 · fn_public_exec 0
--   실행 순서: E1 뒤에 (fn_public_exec가 E1에서 만드는 member_auth_phone을 조회 — D 직후엔 함수가 없어 오류)
select
  (select count(*) from pg_class where relrowsecurity and oid in
     ('public.deal_connections'::regclass, 'public.deal_connection_events'::regclass, 'public.deal_seller_private'::regclass)) as rls,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('deal_connections', 'deal_connection_events', 'deal_seller_private')) as policies,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and table_name in ('deal_connections', 'deal_connection_events', 'deal_seller_private')
     and grantee in ('anon', 'authenticated')) as anon_auth_grants,
  (select count(*) from (values ('anon'), ('authenticated')) r(role)
     where has_function_privilege(r.role, 'public.member_auth_phone(uuid)', 'execute')) as fn_public_exec;

-- E1-0) 실행 전 — 운영의 protect_member_columns 정의 (실행 파일 E1의 "예전" 본문과 같은지 눈으로 대조, 한 행)
select pg_get_functiondef('public.protect_member_columns()'::regprocedure) as protect_member_columns_def;

-- E1) 트리거·함수 (한 행) — 기대: enforce_trigger 1 · members_triggers 6 · search_path 모두 public(4) · columns_uses_auth true
select
  (select count(*) from pg_trigger where tgrelid = 'public.members'::regclass and tgname = 'members_enforce_phone' and not tgisinternal) as enforce_trigger,
  (select count(*) from pg_trigger where tgrelid = 'public.members'::regclass and not tgisinternal) as members_triggers,
  (select string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid = 'public.members'::regclass and not tgisinternal) as trigger_order,
  (select count(*) from pg_proc where proname in ('member_auth_phone', 'enforce_member_phone', 'protect_member_columns', 'touch_updated_at')
     and pronamespace = 'public'::regnamespace and proconfig @> array['search_path=public']) as search_path_public,
  (select pg_get_functiondef('public.protect_member_columns()'::regprocedure) like '%member_auth_phone%') as columns_uses_auth;

-- E2-backup) 백업 (한 행) — 기대: backup = members · backup_rls true · backup_anon_grants 0
-- E2 생략 시 실행 안 함 (백업 표가 없어 오류) — 2026-10-02 운영은 E2-0 mismatch 0으로 E2-backup·E2 생략
select
  (select count(*) from public.members_phone_backup_20261001) as backup,
  (select count(*) from public.members) as members,
  (select relrowsecurity from pg_class where oid = 'public.members_phone_backup_20261001'::regclass) as backup_rls,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and table_name = 'members_phone_backup_20261001' and grantee in ('anon', 'authenticated')) as backup_anon_grants;

-- E2-0) 형식 통일 전 — 영향 행 수 (한 행). dup_after가 0이 아니면 E2 실행 금지(unique 충돌로 통째 실패) → 해당 회원 정리 먼저
--   fmt_*: 지금 members.phone 형식 분포 / mismatch: 인증 번호와 다른 행(형식 차이 포함) / no_auth_phone: 인증 번호 없는 회원
select
  (select count(*) from public.members) as members,
  (select count(*) from public.members where phone ~ '^01[0-9]{8,9}$') as fmt_local_digits,
  (select count(*) from public.members where phone ~ '-') as fmt_hyphen,
  (select count(*) from public.members where phone ~ '^\+?82') as fmt_82,
  (select count(*) from public.members m join auth.users u on u.id = m.id
     where m.phone is distinct from public.kpi_norm_phone(u.phone)) as mismatch,
  (select count(*) from public.members m join auth.users u on u.id = m.id
     where public.kpi_norm_phone(m.phone) <> public.kpi_norm_phone(u.phone)) as mismatch_real_number,
  (select count(*) from public.members m left join auth.users u on u.id = m.id
     where coalesce(public.kpi_norm_phone(u.phone), '') = '') as no_auth_phone,
  (select count(*) from (
     select public.kpi_norm_phone(u.phone) p from public.members m join auth.users u on u.id = m.id
      where coalesce(public.kpi_norm_phone(u.phone), '') <> ''
      group by 1 having count(*) > 1) d) as dup_after,
  (select string_agg(distinct left(regexp_replace(coalesce(phone, ''), '[0-9]', '9', 'g'), 16), ' | ') from auth.users) as auth_phone_shapes;

-- E2) 형식 통일 후 (한 행) — 기대: mismatch 0 · fmt_hyphen 0 · fmt_82 0
-- E2 생략 시 실행 안 함
select
  (select count(*) from public.members m join auth.users u on u.id = m.id
     where coalesce(public.kpi_norm_phone(u.phone), '') <> '' and m.phone is distinct from public.kpi_norm_phone(u.phone)) as mismatch,
  (select count(*) from public.members where phone ~ '-') as fmt_hyphen,
  (select count(*) from public.members where phone ~ '^\+?82') as fmt_82;

-- 참고(E2 뒤) — 관리자 번호 형식: 관리자 지정 화면(/api/admin/admins)은 admin_users.phone = members.phone을 그대로 비교함.
--   형식이 달라지면 "이미 관리자" 중복 확인을 놓칠 수 있어 다음 코드 PR에서 정규화 비교로 바꿀 예정 (로그인은 kpi_norm_phone 비교라 영향 없음)
--   → 완료(2026-10-02, feat/phone-display): /api/admin/admins 중복 확인을 normalizePhone(src/lib/phone.ts) 비교로 바꿈
select count(*) as admin_phone_not_local from public.admin_users where phone !~ '^01[0-9]{8,9}$';

-- F) interests 정책 (한 행) — 기대: policies 4 · old_policy 0 · insert_check에 status = 'active' 포함
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'interests') as policies,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'interests' and policyname = 'interests_self') as old_policy,
  (select with_check from pg_policies where schemaname = 'public' and tablename = 'interests' and policyname = 'interests_self_insert') as insert_check;

-- F-test) 마감 매물 관심 insert 실패 / 진행 중 매물 성공 — 둘 다 rollback이라 데이터는 안 남음.
--   테스트 회원(is_test) 한 명의 권한으로 흉내. 한 덩어리씩 따로 실행(첫 번째는 오류가 정상).
-- (1) 마감 매물 — 기대: ERROR new row violates row-level security policy for table "interests"
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.members where is_test order by created_at limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.interests (deal_id, member_id)
  values ((select id from public.deals where status = 'closed' order by created_at desc limit 1), auth.uid());
rollback;
-- (2) 진행 중 매물(이 회원이 아직 관심 안 누른 것) — 기대: INSERT 0 1 → rollback으로 취소
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.members where is_test order by created_at limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.interests (deal_id, member_id)
  values ((select d.id from public.deals d where d.status = 'active' and d.closes_at > now()
            and not exists (select 1 from public.interests i where i.deal_id = d.id and i.member_id = auth.uid())
           order by d.created_at desc limit 1), auth.uid());
rollback;
-- (3) 마감 매물 관심 취소 — 기대: DELETE 1 → rollback으로 취소. 관리자 권한(SQL 편집기)으로 마감 매물 관심을 하나 만든 뒤 회원 권한으로 지움
begin;
insert into public.interests (deal_id, member_id)
  values ((select id from public.deals where status = 'closed' order by created_at desc limit 1),
          (select id from public.members where is_test order by created_at limit 1))
  on conflict (deal_id, member_id) do nothing;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.members where is_test order by created_at limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
delete from public.interests
 where member_id = auth.uid()
   and deal_id = (select id from public.deals where status = 'closed' order by created_at desc limit 1);
rollback;

-- G) seller_requests.linked_deal_id 삭제 동작 (한 행) — 기대: linked_fk 1 · on_delete n(set null)
select
  (select count(*) from pg_constraint where conrelid = 'public.seller_requests'::regclass and contype = 'f'
     and confrelid = 'public.deals'::regclass) as linked_fk,
  (select confdeltype from pg_constraint where conname = 'seller_requests_linked_deal_id_fkey') as on_delete;
