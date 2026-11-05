-- 2026-11-05 운영 SQL Editor 실행 완료(대표). 확인 조회: has_table 1 · rls true · anon_priv 0 · auth_priv 0 · rows 0 · service_role 권한 7종.
-- 코드: src/app/api/business-check/route.ts, src/lib/memberBusinessCheck.ts (브랜치 feat/member-business-self-check)

-- 1단계: 회원 사업자 셀프 확인 기록 (2026-11-05)
create table if not exists public.member_business_checks (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members(id) on delete cascade,
  method          text not null default 'nts' check (method in ('nts','manual')),
  b_no            text not null check (b_no ~ '^[0-9]{10}$'),
  rep_name        text not null check (char_length(rep_name) between 1 and 50),
  open_date       date not null,
  company_name    text check (company_name is null or char_length(company_name) <= 100),
  validate_result text not null check (validate_result in ('01','02','error')),
  status_code     text check (status_code is null or status_code in ('01','02','03')),
  status_text     text,
  tax_type        text,
  error_kind      text,
  created_at      timestamptz not null default now()
);

create index if not exists member_business_checks_member_idx
  on public.member_business_checks (member_id, created_at desc);
create index if not exists member_business_checks_created_idx
  on public.member_business_checks (created_at);
create index if not exists member_business_checks_bno_idx
  on public.member_business_checks (b_no);

alter table public.member_business_checks enable row level security;
revoke all on public.member_business_checks from anon, authenticated;

comment on table public.member_business_checks is
  '회원 사업자 셀프 확인(국세청 validate+status) 기록. service role만 접근. 호출 횟수 제한 집계 겸용. 2026-11-05';
