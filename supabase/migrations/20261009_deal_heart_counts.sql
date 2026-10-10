-- ============================================================================
-- 2026-10-09 PR 4a — 공개 하트 수 읽기 함수 deal_heart_counts  ** 운영 DB 미실행 (대표 실행) **
--
-- 왜: 화면의 하트(❤️ N)는 deals.interest_count(트리거로 쌓는 누계: 회원 interests + 비회원 quick_leads, 기간·내부 회원 구분 없음)를
--     그대로 보여줬음. 공개(10/19) 이후 실제 관심만 보이게 — 집계 시작 시각 이후 + 테스트 회원(members.is_test) 제외.
-- 무엇: deal id 목록을 받아 deal별 하트 수만 돌려줌(회원·번호 등 다른 값 없음).
--   · p_since: 집계 시작 시각 — 앱 코드 상수 하나(src/lib/heartCount.ts HEART_COUNT_START = 2026-10-18T15:00:00Z
--     = 2026-10-19 00:00 KST)가 넘김. 시작일을 바꿀 때 SQL을 다시 실행할 필요 없음.
--   · 회원 관심(interests): p_since 이후 생성 + 그 회원이 is_test 아님(null도 일반 회원으로 — coalesce)
--   · 비회원 리드(quick_leads): p_since 이후 생성 + 번호가 테스트 회원 번호와 같지 않음(kpi_norm_phone 비교).
--     (2026-10-04 4.5부터 화면에서 quick_leads를 새로 만들지 않아 실제로는 0에 가까움. 90일 지나 번호가 지워진 행은 비교 없이 셈)
--   · 한 번에 최대 200개(그 뒤는 무시) — 목록 화면 1회 조회 분량
--   · security definer(일반 회원은 interests 본인 행만 읽힘 → 남의 관심을 셀 수 없어서) + search_path 고정. anon·authenticated 실행 허용.
-- 기존 deals.interest_count 컬럼·트리거는 그대로(관리자 화면 숫자·KPI가 씀).
-- 전제(운영에 이미 있음): members.is_test, public.kpi_norm_phone(text) — schema.sql 커밋 K 블록(2026-09-30 실행 완료).
-- 되돌리기는 파일 맨 아래.
-- ============================================================================

create or replace function public.deal_heart_counts(p_deal_ids uuid[], p_since timestamptz)
returns table (deal_id uuid, heart_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select distinct x.id
      from unnest((coalesce(p_deal_ids, '{}'::uuid[]))[1:200]) as x(id)
     where x.id is not null
  ),
  member_hearts as (
    select i.deal_id, count(*)::integer as n
      from public.interests i
      join public.members m on m.id = i.member_id
     where i.deal_id in (select id from ids)
       and i.created_at >= p_since
       and not coalesce(m.is_test, false)
     group by i.deal_id
  ),
  guest_hearts as (
    select q.deal_id, count(*)::integer as n
      from public.quick_leads q
     where q.deal_id in (select id from ids)
       and q.created_at >= p_since
       and not exists (
         select 1 from public.members t
          where coalesce(t.is_test, false)
            and q.phone is not null
            and public.kpi_norm_phone(t.phone) = public.kpi_norm_phone(q.phone)
       )
     group by q.deal_id
  )
  select ids.id as deal_id,
         (coalesce(mh.n, 0) + coalesce(gh.n, 0))::integer as heart_count
    from ids
    left join member_hearts mh on mh.deal_id = ids.id
    left join guest_hearts gh on gh.deal_id = ids.id;
$$;

revoke all on function public.deal_heart_counts(uuid[], timestamptz) from public;
grant execute on function public.deal_heart_counts(uuid[], timestamptz) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 확인 (실행 뒤, 읽기만)
-- ----------------------------------------------------------------------------
-- (1) 함수·권한 — 기대: security_definer true · anon_exec true · auth_exec true
-- select p.prosecdef as security_definer,
--        has_function_privilege('anon', 'public.deal_heart_counts(uuid[], timestamptz)', 'execute') as anon_exec,
--        has_function_privilege('authenticated', 'public.deal_heart_counts(uuid[], timestamptz)', 'execute') as auth_exec
--   from pg_proc p where p.proname = 'deal_heart_counts';
-- (2) 진행 중 매물 하트 — 시작일 전에는 모두 0이 정상. 시작일을 과거로 넣어 기존 관심과 비교(테스트 회원 빠진 수 = 화면 값)
-- select d.id, d.title, d.interest_count as old_total, h.heart_count as since_start,
--        (select heart_count from public.deal_heart_counts(array[d.id], '2000-01-01T00:00:00Z')) as all_time_without_test
--   from public.deals d
--   join public.deal_heart_counts((select array_agg(id) from public.deals where status = 'active'), '2026-10-18T15:00:00Z') h on h.deal_id = d.id
--  order by d.interest_count desc limit 20;

-- ----------------------------------------------------------------------------
-- 되돌리기
-- ----------------------------------------------------------------------------
-- drop function if exists public.deal_heart_counts(uuid[], timestamptz);
