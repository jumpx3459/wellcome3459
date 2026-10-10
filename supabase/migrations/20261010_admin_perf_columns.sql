-- ============================================================================
-- 2026-10-10 매니저 실적 기록 칼럼 5개 + 성사 건 담당자 채움 — **운영 DB 실행 완료(10/10, 대표)**. 다시 실행해도 같음(if not exists).
-- 이 파일은 기록용 — 칼럼 이름은 PR ①(feat/admin-roles) 코드가 쓰는 이름. 대표 실행본과 다르면 실행본이 기준(확인 조회 ①로 대조).
--   · deal_seller_private.sourced_by_admin_id·sourced_at — [발굴 매니저](매물 등록 폼 "판매자 정보")
--   · seller_requests.reviewed_by_admin_id·reviewed_at — 판매 신청 승인(매물 등록)·거절한 관리자 id·시각(reviewed_by 이름 글자는 그대로)
--   · deal_connections.closed_assignee_admin_id — 성사(closed + success) 시점 담당자. 나중에 담당을 넘겨도 그대로(실적 기준)
-- ============================================================================
alter table public.deal_seller_private
  add column if not exists sourced_by_admin_id uuid references public.admin_users(id) on delete set null,
  add column if not exists sourced_at timestamptz;
alter table public.seller_requests
  add column if not exists reviewed_by_admin_id uuid references public.admin_users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;
alter table public.deal_connections
  add column if not exists closed_assignee_admin_id uuid references public.admin_users(id) on delete set null;

-- 이미 성사로 끝난 연결은 지금 담당자로 채움(담당 변경 경로가 없었으므로 = 성사 시점 담당자)
update public.deal_connections
   set closed_assignee_admin_id = assigned_admin_id
 where status = 'closed' and result = 'success' and closed_assignee_admin_id is null and assigned_admin_id is not null;

-- 확인 ① 칸 5개 (기대: 5행)
-- select table_name, column_name from information_schema.columns
--  where table_schema = 'public'
--    and (table_name, column_name) in (('deal_seller_private','sourced_by_admin_id'), ('deal_seller_private','sourced_at'),
--         ('seller_requests','reviewed_by_admin_id'), ('seller_requests','reviewed_at'), ('deal_connections','closed_assignee_admin_id'));
-- 확인 ② 성사 건 중 담당자 빈 건 (기대: 0 — 담당자 없이 성사된 건만 남을 수 있음)
-- select count(*) filter (where closed_assignee_admin_id is null) as missing, count(*) as success
--   from public.deal_connections where status = 'closed' and result = 'success';
-- 확인 ③ 매니저별 이번 달 실적 — 등록(created_by) / 성사(closed_assignee) / 발굴(sourced_by, 사업자번호 첫 등장만).
--   [테스트] 제목 매물·테스트 계정(kpi_excluded_members) 구매자 연결 제외. 한국 날짜 기준 이번 달
-- with m as (select date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' as since),
-- reg as (
--   select p.created_by_admin_id as admin_id from public.deal_seller_private p join public.deals d on d.id = p.deal_id, m
--    where p.created_at >= m.since and d.title not like '[테스트]%'),
-- won as (
--   select c.closed_assignee_admin_id as admin_id from public.deal_connections c join public.deals d on d.id = c.deal_id, m
--    where c.status = 'closed' and c.result = 'success' and c.closed_at >= m.since and d.title not like '[테스트]%'
--      and (c.buyer_member_id is null or c.buyer_member_id not in (select id from public.kpi_excluded_members))),
-- firsts as (  -- 사업자번호별 첫 매물(통과한 조회 행이 붙은 매물 중 가장 이른 것)
--   select distinct on (b.b_no) b.b_no, b.deal_id from public.seller_business_checks b
--    where b.kind = 'validate' and b.deal_id is not null order by b.b_no, b.checked_at),
-- src as (
--   select p.sourced_by_admin_id as admin_id from public.deal_seller_private p join firsts f on f.deal_id = p.deal_id
--     join public.deals d on d.id = p.deal_id, m
--    where p.sourced_by_admin_id is not null and p.sourced_at >= m.since and d.title not like '[테스트]%')
-- select a.name, a.role,
--        (select count(*) from reg where reg.admin_id = a.id) as registered,
--        (select count(*) from won where won.admin_id = a.id) as success,
--        (select count(*) from src where src.admin_id = a.id) as sourced
--   from public.admin_users a order by a.name;

-- 되돌리기
-- alter table public.deal_connections drop column if exists closed_assignee_admin_id;
-- alter table public.seller_requests drop column if exists reviewed_by_admin_id, drop column if exists reviewed_at;
-- alter table public.deal_seller_private drop column if exists sourced_by_admin_id, drop column if exists sourced_at;
