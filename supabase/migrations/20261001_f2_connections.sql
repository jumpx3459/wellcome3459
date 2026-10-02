-- ============================================================================
-- 2026-10-01 F-2 거래 연결 DB — 운영 DB 미실행 (대표 실행). 확인 조회: 20261001_f2_connections_check.sql
-- 블록 순서대로 하나씩 실행하고, 블록마다 확인 파일의 같은 번호 조회로 기대값을 본 뒤 다음 블록으로.
--   A deal_connections → B deal_connection_events → C deal_seller_private → D 권한(A·B·C 공통)
--   → E1 members 번호 고정(함수·트리거) → E2-backup 번호 백업 → E2 기존 행 번호 형식 통일(따로, 영향 행 수 먼저)
--   → F 마감 매물 관심 차단(interests 정책) → G seller_requests.linked_deal_id 삭제 동작(set null)
-- 전제: 연결 기록(deal_connections·deal_connection_events)은 지우지 않는다 — 매물은 삭제 대신 마감, 이력은 수정·삭제 불가.
-- 앱 코드는 아직 이 표들을 쓰지 않음(F-3·F-4에서 사용). E·F는 지금 코드와 바로 맞물림(아래 각 블록 설명).
-- 되돌리기 SQL은 파일 맨 아래.
-- ============================================================================

-- 공용: updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- ----------------------------------------------------------------------------
-- A. deal_connections — 연결 1건 = 1행(현재 상태). 단계 이력은 B.
--   · deal_id: on delete restrict — 연결 기록이 있는 매물은 삭제 못 하고 마감만(관리자 삭제 API가 23503을 안내 문구로 바꿈).
--     관리자 매물 삭제는 실제 행 삭제(최고관리자, deals/manage DELETE)라, 기록 보관(3년)을 위해 삭제 자체를 막음. 제목 스냅샷은 그대로 저장
--   · buyer: 회원이면 buyer_member_id(탈퇴 시 set null), 비회원이면 buyer_phone(010… 숫자만)
--     "둘 중 하나는 있음"은 check 대신 insert 트리거로 — check면 회원 탈퇴 때 set null이 막혀 탈퇴가 실패함
--   · 판매자에게 구매자 정보를 넘긴 단계(contact_sent_at)는 7-1 동의(consent_at)가 있어야 함
-- ----------------------------------------------------------------------------
create table if not exists public.deal_connections (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete restrict,
  deal_title_snapshot text not null,
  buyer_member_id uuid references public.members(id) on delete set null,
  buyer_phone text,
  source text not null check (source in ('interest', 'quick_lead', 'admin')),
  source_id uuid,                                  -- interests.id / quick_leads.id (FK 없음 — 원본이 지워져도 기록 유지)
  consent_at timestamptz,                          -- 7-1 거래 상담 제3자 제공 동의
  consent_version text,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'seller_confirmed', 'buyer_confirmed', 'contact_sent', 'closed')),
  result text check (result in ('success', 'failed', 'cancelled')),
  result_amount bigint check (result_amount is null or result_amount >= 0),
  result_reason text,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  seller_confirmed_at timestamptz,
  buyer_confirmed_at timestamptz,
  contact_sent_at timestamptz,
  closed_at timestamptz,
  assigned_admin_id uuid references public.admin_users(id) on delete set null,
  retention_until timestamptz,                     -- 보관 기한 칸만 (값 채우기·삭제 작업은 아직 없음)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_connections_closed_result check ((status = 'closed') = (result is not null)),
  constraint deal_connections_buyer_phone_format check (buyer_phone is null or buyer_phone ~ '^01[016789][0-9]{7,8}$'),
  constraint deal_connections_consent_before_contact check (contact_sent_at is null or consent_at is not null),
  constraint deal_connections_consent_pair check ((consent_at is null) = (consent_version is null))
);

-- 진행 중(closed 아님) 연결은 같은 매물·같은 구매자 1건만
create unique index if not exists deal_connections_open_member_uniq
  on public.deal_connections (deal_id, buyer_member_id)
  where status <> 'closed' and buyer_member_id is not null;
create unique index if not exists deal_connections_open_phone_uniq
  on public.deal_connections (deal_id, buyer_phone)
  where status <> 'closed' and buyer_phone is not null;
create index if not exists deal_connections_status_updated_idx on public.deal_connections (status, updated_at);  -- "멈춘 연결"
create index if not exists deal_connections_assigned_idx on public.deal_connections (assigned_admin_id);
create index if not exists deal_connections_deal_idx on public.deal_connections (deal_id);

create or replace function public.deal_connections_require_buyer()
returns trigger as $$
begin
  if new.buyer_member_id is null and new.buyer_phone is null then
    raise exception 'deal_connections: 구매자(회원 또는 비회원 번호)가 필요해요' using errcode = '23514';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;
drop trigger if exists deal_connections_require_buyer on public.deal_connections;
create trigger deal_connections_require_buyer before insert on public.deal_connections
  for each row execute function public.deal_connections_require_buyer();

drop trigger if exists deal_connections_touch on public.deal_connections;
create trigger deal_connections_touch before update on public.deal_connections
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- B. deal_connection_events — 단계 이력 (사람·시스템, 나중 자동화 대비)
--   · 이력은 추가만: service role 포함 누구도 UPDATE·DELETE 못 함(트리거 예외). 연결 행 삭제도 이력이 있으면 막힘(restrict).
--     보관 기한이 지나 지워야 할 때는 별도 작업에서 트리거를 잠시 끄고 지움(그 작업은 아직 없음).
-- ----------------------------------------------------------------------------
create table if not exists public.deal_connection_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.deal_connections(id) on delete restrict,
  step text not null
    check (step in ('requested', 'accepted', 'seller_confirmed', 'buyer_confirmed', 'contact_sent', 'closed')),
  method text not null check (method in ('phone', 'sms', 'kakao', 'app', 'alimtalk', 'system')),
  actor_type text not null check (actor_type in ('person', 'system')),
  actor_admin_id uuid references public.admin_users(id) on delete set null,
  template_key text,
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists deal_connection_events_conn_idx on public.deal_connection_events (connection_id, created_at);

create or replace function public.deal_connection_events_immutable()
returns trigger as $$
begin
  raise exception 'deal_connection_events: 단계 이력은 수정·삭제할 수 없어요 (%)', tg_op using errcode = '42501';
end;
$$ language plpgsql set search_path = public;
drop trigger if exists deal_connection_events_immutable on public.deal_connection_events;
create trigger deal_connection_events_immutable before update or delete on public.deal_connection_events
  for each row execute function public.deal_connection_events_immutable();

-- ----------------------------------------------------------------------------
-- C. deal_seller_private — 매물 1개당 판매자 비공개 정보 1행 (관리자 직접 등록 매물은 지금 판매자 정보가 DB 어디에도 없음)
--   · seller_request_id: 판매 신청 승인 매물은 seller_requests.linked_deal_id로 이어져 있음 → 그 신청 행 (신청 삭제 시 set null)
--   · contact_phone: 숫자만(판매자는 사무실·대표번호도 허용 — isValidContactPhone과 같은 범위라 01x로 제한하지 않음)
-- ----------------------------------------------------------------------------
create table if not exists public.deal_seller_private (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  seller_request_id uuid references public.seller_requests(id) on delete set null,
  source text not null check (source in ('seller_request', 'admin_direct')),
  company_name text,
  contact_name text,
  contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9]{8,11}$'),
  memo text,
  name_disclosure_ok boolean not null default false,   -- 상호를 구매자에게 안내해도 된다는 판매자 허락
  name_disclosure_at timestamptz,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_until timestamptz,
  constraint deal_seller_private_disclosure_at check (name_disclosure_ok = false or name_disclosure_at is not null)
);
create unique index if not exists deal_seller_private_request_uniq
  on public.deal_seller_private (seller_request_id) where seller_request_id is not null;
drop trigger if exists deal_seller_private_touch on public.deal_seller_private;
create trigger deal_seller_private_touch before update on public.deal_seller_private
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- D. 권한 — 서버(service role) 전용. RLS 켜고 정책 없음 + anon·authenticated 권한 회수 (관리자 API는 service role로 접근)
-- ----------------------------------------------------------------------------
alter table public.deal_connections enable row level security;
alter table public.deal_connection_events enable row level security;
alter table public.deal_seller_private enable row level security;
revoke all on public.deal_connections from anon, authenticated;
revoke all on public.deal_connection_events from anon, authenticated;
revoke all on public.deal_seller_private from anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.deal_connections_require_buyer() from public, anon, authenticated;
revoke all on function public.deal_connection_events_immutable() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- E1. members.phone 고정 — 회원(authenticated·anon)이 넣거나 바꿀 때 phone = 인증 번호(auth.users.phone) 정규화 값
--   형식: kpi_norm_phone과 같은 "010…" 숫자만 (앱 toLocalPhone·normalizeKoreanPhone 결과와 같음. auth.users.phone은 "8210…")
--   · 가입(insert): 새 트리거 members_enforce_phone — 클라이언트가 보낸 phone 대신 인증 번호로 덮어씀. 인증 번호가 없으면 거부(예외)
--     근거: 가입은 휴대폰 문자 인증(signInWithOtp phone → verifyOtp sms) 뒤에만 members를 upsert(signup/page.tsx) — 인증 번호가 없는
--     회원 행이 생길 정상 경로가 없음. null로 두면 phone not null 제약에 막히거나 번호 없는 회원이 생김 → 예외가 맞음
--   · 수정(update): 기존 protect_member_columns가 phone := old.phone으로 막던 줄을 "인증 번호(없으면 기존 값)"로 바꿈
--     (함수 전체를 그대로 옮기고 이 한 줄만 다름 — 실행 전 확인 파일 E1-0으로 운영 정의와 대조)
--   · service role·SQL 편집기(auth.role() 없음)는 그대로 통과 — 탈퇴 마스킹 등 서버 작업 영향 없음
--   · BEFORE 트리거는 이름순 실행: members_enforce_phone(insert만) → grant_referral_bonus → protect_business_verified
--     → protect_columns → protect_is_test → protect_privileged. phone을 만지는 건 enforce_phone(insert)·protect_columns(update)뿐이라 충돌 없음
-- ----------------------------------------------------------------------------
create or replace function public.member_auth_phone(p_member_id uuid)
returns text as $$
  select nullif(public.kpi_norm_phone(u.phone), '') from auth.users u where u.id = p_member_id
$$ language sql stable security definer set search_path = public;
-- 다른 사람 번호를 RPC로 조회하지 못하게 — 트리거 안(security definer)에서만 씀
revoke all on function public.member_auth_phone(uuid) from public, anon, authenticated;

create or replace function public.enforce_member_phone()
returns trigger as $$
declare
  p text;
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    p := public.member_auth_phone(new.id);
    if p is null then
      raise exception 'members.phone: 인증된 휴대폰 번호가 없어요' using errcode = '23514';
    end if;
    new.phone := p;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function public.enforce_member_phone() from public, anon, authenticated;
drop trigger if exists members_enforce_phone on public.members;
create trigger members_enforce_phone before insert on public.members
  for each row execute function public.enforce_member_phone();

create or replace function public.protect_member_columns()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    new.referred_by := old.referred_by;
    new.member_no := old.member_no;
    new.phone := coalesce(public.member_auth_phone(new.id), old.phone);  -- 2026-10-01 F-2: 예전 new.phone := old.phone
    new.business_license_path := old.business_license_path;
    if old.ref_code is not null then new.ref_code := old.ref_code; end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- E2-backup. E2 직전 번호 백업 — E2 되돌리기용(아래 되돌리기 구역). 서버 전용(RLS·권한 회수). 공개 전 확인 후 삭제
-- ----------------------------------------------------------------------------
create table if not exists public.members_phone_backup_20261001 (
  id uuid primary key,
  phone text,
  backed_up_at timestamptz not null default now()
);
alter table public.members_phone_backup_20261001 enable row level security;
revoke all on public.members_phone_backup_20261001 from anon, authenticated;
insert into public.members_phone_backup_20261001 (id, phone)
select id, phone from public.members
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- E2. 기존 행 번호 형식 통일 — E1과 따로, 확인 파일 E2-0(영향 행 수·겹침 0) 먼저 본 뒤에만.
--   SQL 편집기 실행은 auth.role()이 없어 보호 트리거를 통과함(번호만 바뀌고 다른 칸은 그대로).
--   members.phone은 unique — 정규화 뒤 같은 번호가 되는 행이 있으면 이 update가 통째로 실패(아무것도 안 바뀜) → E2-0 dup_after가 0인지 먼저.
--   E2-backup 확인(backup = members 건수) 뒤에만.
-- ----------------------------------------------------------------------------
update public.members m
   set phone = public.kpi_norm_phone(u.phone)
  from auth.users u
 where u.id = m.id
   and coalesce(public.kpi_norm_phone(u.phone), '') <> ''
   and m.phone is distinct from public.kpi_norm_phone(u.phone);

-- ----------------------------------------------------------------------------
-- F. 마감 매물 관심 차단 — interests는 브라우저가 직접 insert(RLS). 하나였던 "interests_self"(for all)를 동작별로 나누고
--   insert에만 "진행 중 매물(status 'active' · 마감 시각 전)" 조건. 조회·수정·삭제는 예전과 같음(본인 행) — 마감 매물도 관심 취소(삭제) 가능.
--   deals.status 값은 active·closed 두 가지(deals_status_check). 관리자 처리(service role)는 영향 없음.
--   quick_leads(비회원)는 공개 insert 정책이 이미 없고(2026-09-29) /api/quick-interest가 같은 검사(F-1 #38) → 코드 수정 없음.
-- ----------------------------------------------------------------------------
drop policy if exists "interests_self" on public.interests;
drop policy if exists "interests_self_select" on public.interests;
drop policy if exists "interests_self_insert" on public.interests;
drop policy if exists "interests_self_update" on public.interests;
drop policy if exists "interests_self_delete" on public.interests;
create policy "interests_self_select" on public.interests
  for select using (auth.uid() = member_id);
create policy "interests_self_insert" on public.interests
  for insert with check (
    auth.uid() = member_id
    and exists (
      select 1 from public.deals d
       where d.id = deal_id and d.status = 'active' and d.closes_at > now()
    )
  );
create policy "interests_self_update" on public.interests
  for update using (auth.uid() = member_id) with check (auth.uid() = member_id);
create policy "interests_self_delete" on public.interests
  for delete using (auth.uid() = member_id);

-- ----------------------------------------------------------------------------
-- G. seller_requests.linked_deal_id — 승인된 매물을 지우면 신청 행의 연결만 비움(set null).
--   지금은 삭제 동작이 없어(no action) 판매 신청으로 승인된 매물은 최고관리자 삭제가 FK 오류로 실패함. 제약 이름은 실행 시 찾음
-- ----------------------------------------------------------------------------
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.seller_requests'::regclass and contype = 'f'
       and confrelid = 'public.deals'::regclass
       and conkey = array[(select attnum from pg_attribute where attrelid = 'public.seller_requests'::regclass and attname = 'linked_deal_id')]
  loop
    execute format('alter table public.seller_requests drop constraint %I', c);
  end loop;
end $$;
alter table public.seller_requests add constraint seller_requests_linked_deal_id_fkey
  foreign key (linked_deal_id) references public.deals(id) on delete set null;

-- ============================================================================
-- 되돌리기 (블록 역순, 필요한 블록만)
-- ============================================================================
-- G:
--   alter table public.seller_requests drop constraint if exists seller_requests_linked_deal_id_fkey;
--   alter table public.seller_requests add constraint seller_requests_linked_deal_id_fkey
--     foreign key (linked_deal_id) references public.deals(id);
-- F:
--   drop policy if exists "interests_self_select" on public.interests;
--   drop policy if exists "interests_self_insert" on public.interests;
--   drop policy if exists "interests_self_update" on public.interests;
--   drop policy if exists "interests_self_delete" on public.interests;
--   create policy "interests_self" on public.interests for all using (auth.uid() = member_id) with check (auth.uid() = member_id);
-- E2 (백업 표에서 복원 — SQL 편집기 실행은 보호 트리거를 통과):
--   update public.members m set phone = b.phone
--     from public.members_phone_backup_20261001 b
--    where b.id = m.id and m.phone is distinct from b.phone;
-- E2-backup (공개 전 확인 후 삭제 — 지금은 지우지 말 것):
--   -- drop table if exists public.members_phone_backup_20261001;
-- E1:
--   drop trigger if exists members_enforce_phone on public.members;
--   drop function if exists public.enforce_member_phone();
--   create or replace function public.protect_member_columns() returns trigger as $$
--   begin
--     if auth.role() <> 'service_role' then
--       new.referred_by := old.referred_by; new.member_no := old.member_no; new.phone := old.phone;
--       new.business_license_path := old.business_license_path;
--       if old.ref_code is not null then new.ref_code := old.ref_code; end if;
--     end if;
--     return new;
--   end; $$ language plpgsql security definer set search_path = public;
--   drop function if exists public.member_auth_phone(uuid);
-- A·B·C·D (데이터가 쌓인 뒤에는 지우지 말 것 — 연결 기록 3년 보관 목적):
--   drop table if exists public.deal_connection_events;   -- 이력 수정·삭제 금지 트리거는 표와 같이 사라짐
--   drop function if exists public.deal_connection_events_immutable();
--   drop table if exists public.deal_connections;
--   drop table if exists public.deal_seller_private;
--   drop function if exists public.deal_connections_require_buyer();
--   drop function if exists public.touch_updated_at();
