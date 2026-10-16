-- 2026-10-15 members UTM 컬럼 — 실행 전·후 확인 조회 (읽기 전용, 각각 한 번에 한 쿼리씩 실행)
-- 짝 파일: 20261015_members_utm.sql

-- U-0) 실행 전 — 운영의 protect_member_columns 정의 (한 행). 20261001_f2_connections.sql의 F-2 정의
--      (referred_by·member_no·phone·business_license_path·ref_code 5줄, phone은 member_auth_phone 사용)와 같은지 눈으로 대조.
--      다르면(다른 줄이 있으면) 실행하지 말고 보고 — 새 정의가 그 줄을 지워 버림.
select pg_get_functiondef('public.protect_member_columns()'::regprocedure) as protect_member_columns_def;

-- U-1) 실행 전 — utm 컬럼이 아직 없는지 (기대: 0행)
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'members' and column_name in ('utm_source', 'utm_medium', 'utm_campaign');

-- U-2) 실행 후 — 컬럼 3개·text·null 허용 (기대: 3행, data_type text, is_nullable YES)
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'members' and column_name in ('utm_source', 'utm_medium', 'utm_campaign')
 order by column_name;

-- U-3) 실행 후 — 길이 32 check 3개 (기대: 3행)
select conname, pg_get_constraintdef(oid) as def from pg_constraint
 where conrelid = 'public.members'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%utm_%';

-- U-4) 실행 후 — 트리거 함수가 utm 3개를 보호하고 F-2 줄도 그대로인지 (한 행, 기대: 모두 true)
select
  (select pg_get_functiondef('public.protect_member_columns()'::regprocedure) like '%new.utm_source := old.utm_source%') as protects_source,
  (select pg_get_functiondef('public.protect_member_columns()'::regprocedure) like '%new.utm_medium := old.utm_medium%') as protects_medium,
  (select pg_get_functiondef('public.protect_member_columns()'::regprocedure) like '%new.utm_campaign := old.utm_campaign%') as protects_campaign,
  (select pg_get_functiondef('public.protect_member_columns()'::regprocedure) like '%member_auth_phone%') as keeps_f2_phone,
  (select pg_get_functiondef('public.protect_member_columns()'::regprocedure) like '%new.referred_by := old.referred_by%') as keeps_referred_by,
  (select count(*) from pg_trigger where tgrelid = 'public.members'::regclass and not tgisinternal) as members_triggers; -- 기대 6(변화 없음)

-- U-5) 가입 몇 건 뒤 — 채널별 가입 수 (읽기 전용, 관리자 화면은 아직 없음)
select coalesce(utm_source, '(없음)') as utm_source, count(*) as members
  from public.members where coalesce(is_test, false) = false group by 1 order by 2 desc;
