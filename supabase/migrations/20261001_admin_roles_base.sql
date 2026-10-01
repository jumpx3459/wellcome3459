-- ============================================================================
-- 2026-10-01 ① 관리자 역할 기반 최소판 — 운영 DB 미실행 (대표 실행)
-- 코드: src/lib/adminAuth.ts, src/lib/adminAudit.ts, src/app/api/admin/login/route.ts 외 (브랜치 feat/admin-roles-base)
--
-- 배포 순서
--   ① 대표가 이 파일의 1~5 실행 (SQL Editor, 위에서부터 한 블록씩)
--   ② 각 블록 아래 확인 조회(한 행) 실행 → 전부 기대값
--   ③ PR merge → 배포 (새 로그인 = 번호 + 비밀번호, 새 verify_admin_login(p_phone, p_password) 사용)
--   ④ 대표가 /admin에서 번호 + 비밀번호로 로그인 확인 → 감사 로그에 login_success 1줄
--   ⑤ 맨 아래 "6. 배포 후" 블록으로 예전 비밀번호만 받는 함수 삭제
-- 되돌리기: ③ 전이면 이 SQL은 기존 코드에 영향 없음(예전 함수·역할 값 그대로 동작). ③ 후 문제면 PR revert → 예전 함수가 ⑤ 전까지 남아 있음.
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (admins = 4, phone_missing = 0, pgcrypto = true)
--   select (select count(*) from public.admin_users) as admins,
--          (select count(*) from public.admin_users where phone is null or btrim(phone) = '') as phone_missing,
--          (select count(*) = 1 from pg_extension where extname = 'pgcrypto') as pgcrypto,
--          (select string_agg(conname, ',') from pg_constraint where conrelid = 'public.admin_users'::regclass and contype = 'c') as checks;

-- 1) 역할 허용값에 점핑매니저 추가 (점핑매니저는 F(거래 연결) 전까지 아무에게도 지정하지 않음)
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check
  check (role in ('최고관리자', '관리자', '점핑매니저'));
-- 확인 — 한 행 (true):
--   select pg_get_constraintdef(oid) like '%점핑매니저%' as role_ok from pg_constraint where conname = 'admin_users_role_check';

-- 2) 번호 + 비밀번호 로그인 함수 (같은 이름, 인자 2개 — 예전 verify_admin_login(text)는 ⑤에서 삭제)
--    번호는 형식이 섞여 있어 kpi_norm_phone(커밋 K)으로 맞춰 비교, 그 번호의 계정 1건만 검증
create or replace function public.verify_admin_login(p_phone text, p_password text)
returns table (id uuid, name text, role text)
language sql
security definer
set search_path = public
as $$
  select a.id, a.name, a.role
    from public.admin_users a
   where public.kpi_norm_phone(a.phone) = public.kpi_norm_phone(p_phone)
     and a.password_hash = crypt(p_password, a.password_hash)
   limit 1;
$$;
-- 회수 대상은 public·anon·authenticated만. service_role(서버 API — 운영 main의 로그인도 service_role로 예전 함수를 부름)은
-- 아래 grant로 명시해 유지 → 이 SQL을 실행한 뒤 ① 배포 전까지도 운영 관리자 로그인은 끊기지 않음.
revoke execute on function public.verify_admin_login(text, text) from public, anon, authenticated;
grant execute on function public.verify_admin_login(text, text) to service_role;
-- 예전 함수는 실행 권한 회수 표시가 없어 공개 키로도 호출될 수 있었음 → 삭제 전까지 서버(service role)만
revoke execute on function public.verify_admin_login(text) from public, anon, authenticated;
grant execute on function public.verify_admin_login(text) to service_role;
-- 확인 — 한 행 (new_fn = true, anon_new = false, anon_old = false, auth_old = false, svc_new = true, svc_old = true):
--   select to_regprocedure('public.verify_admin_login(text, text)') is not null as new_fn,
--          has_function_privilege('anon', 'public.verify_admin_login(text, text)', 'execute') as anon_new,
--          has_function_privilege('anon', 'public.verify_admin_login(text)', 'execute') as anon_old,
--          has_function_privilege('authenticated', 'public.verify_admin_login(text)', 'execute') as auth_old,
--          has_function_privilege('service_role', 'public.verify_admin_login(text, text)', 'execute') as svc_new,
--          has_function_privilege('service_role', 'public.verify_admin_login(text)', 'execute') as svc_old;

-- 3) 로그인 실패 기록 (같은 번호 15분 안에 5회 실패 → 15분 잠금, 성공하면 그 번호 기록 삭제). 서버만
create table if not exists public.admin_login_failures (
  id bigint generated always as identity primary key,
  phone text not null,          -- normalizeKoreanPhone 형식(01012345678)
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists admin_login_failures_phone_created_idx on public.admin_login_failures (phone, created_at desc);
alter table public.admin_login_failures enable row level security;   -- 정책 없음 = service role만
revoke all on public.admin_login_failures from anon, authenticated;
-- 확인 — 한 행 (rls = true, anon_select = false):
--   select relrowsecurity as rls, has_table_privilege('anon', 'public.admin_login_failures', 'select') as anon_select
--     from pg_class where oid = 'public.admin_login_failures'::regclass;

-- 4) 관리자 감사 로그. detail에 비밀번호·토큰·전체 휴대폰 번호 금지(번호는 뒤 4자리). 서버만
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,                 -- 로그인 실패·잠금은 null
  admin_name text,
  admin_role text,
  action text not null,          -- login_success·login_fail·login_locked·deal_delete·partner_approve·partner_reject·
                                 -- notice_send·admin_appoint·admin_remove·admin_role_change·members_list_view·interests_list_view
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs (admin_id, created_at desc);
alter table public.admin_audit_logs enable row level security;       -- 정책 없음 = service role만
revoke all on public.admin_audit_logs from anon, authenticated;
-- 확인 — 한 행 (rls = true, anon_select = false, rows = 0):
--   select relrowsecurity as rls, has_table_privilege('anon', 'public.admin_audit_logs', 'select') as anon_select,
--          (select count(*) from public.admin_audit_logs) as rows
--     from pg_class where oid = 'public.admin_audit_logs'::regclass;

-- 5) 전체 확인 — 한 행 (모두 true)
--   select pg_get_constraintdef((select oid from pg_constraint where conname = 'admin_users_role_check')) like '%점핑매니저%' as role_ok,
--          to_regprocedure('public.verify_admin_login(text, text)') is not null as new_fn,
--          not has_function_privilege('anon', 'public.verify_admin_login(text, text)', 'execute') as new_fn_closed,
--          has_function_privilege('service_role', 'public.verify_admin_login(text)', 'execute') as old_fn_server_ok,
--          to_regclass('public.admin_login_failures') is not null as failures_tbl,
--          to_regclass('public.admin_audit_logs') is not null as audit_tbl;

-- ============================================================================
-- 6. 배포 후 (④ 대표 로그인 확인 뒤) — 예전 비밀번호만 받는 함수 삭제
-- ============================================================================
--   drop function if exists public.verify_admin_login(text);
--   확인 — 한 행 (old_fn = false, new_fn = true):
--   select to_regprocedure('public.verify_admin_login(text)') is not null as old_fn,
--          to_regprocedure('public.verify_admin_login(text, text)') is not null as new_fn;
--
-- 감사 로그 보기 (최근 20건):
--   select created_at, admin_name, admin_role, action, target_type, target_id, detail, ip
--     from public.admin_audit_logs order by created_at desc limit 20;
