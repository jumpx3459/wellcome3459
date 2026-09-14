-- ============================================================
-- 덤핑점핑 알림 MVP (JumpX) · Supabase 스키마
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.
-- ============================================================

-- 1. 회원 (휴대폰 인증 기반, Supabase Auth phone 사용)
create table if not exists public.members (
  id uuid primary key default auth.uid(),
  phone text unique not null,
  is_business boolean default false,
  business_verified boolean default false, -- 파트너 매니저가 수동으로 true 전환
  created_at timestamptz default now()
);

-- 2. 카테고리 마스터
create table if not exists public.categories (
  id serial primary key,
  name text unique not null,
  sort_order int default 0
);

insert into public.categories (name, sort_order) values
  ('냉동냉장식품', 1), ('농수축산물', 2), ('생활용품', 3), ('패션잡화', 4),
  ('화장품', 5), ('전자제품', 6), ('산업원자재', 7), ('기계설비', 8), ('기타', 9)
on conflict (name) do nothing;

-- 3. 지역 마스터 (전국 도 + 광역시)
create table if not exists public.regions (
  id serial primary key,
  name text unique not null,
  sort_order int default 0
);

insert into public.regions (name, sort_order) values
  ('서울', 1), ('부산', 2), ('대구', 3), ('인천', 4), ('광주', 5),
  ('대전', 6), ('울산', 7), ('세종', 8), ('경기', 9), ('강원', 10),
  ('충북', 11), ('충남', 12), ('전북', 13), ('전남', 14),
  ('경북', 15), ('경남', 16), ('제주', 17)
on conflict (name) do nothing;

-- 4. 회원 관심 카테고리 (다대다)
create table if not exists public.member_categories (
  member_id uuid references public.members(id) on delete cascade,
  category_id int references public.categories(id) on delete cascade,
  primary key (member_id, category_id)
);

-- 5. 회원 관심 지역 (다대다)
create table if not exists public.member_regions (
  member_id uuid references public.members(id) on delete cascade,
  region_id int references public.regions(id) on delete cascade,
  primary key (member_id, region_id)
);

-- 6. 매물 (덤핑 정보)
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id int references public.categories(id),
  region_id int references public.regions(id),
  original_price numeric not null,
  deal_price numeric not null,
  total_qty int not null,
  remaining_qty int not null,
  location text,
  closes_at timestamptz not null,
  status text default 'active', -- active | closed | sold_out
  images text[] default '{}', -- 매물 사진 URL 목록 (최대 4장 권장: 대표/실물/박스/라벨)
  description text, -- 소비기한, 보관상태 등 판매자가 남긴 상세 설명
  created_at timestamptz default now()
);

-- 7. 웹 푸시 구독 정보 (브라우저/기기별로 여러 개 가능)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now()
);

-- 8. 알림 발송 로그
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  channel text default 'webpush', -- webpush (기기 푸시 알림, 알라미와 동일한 방식)
  status text default 'sent', -- sent | failed | clicked
  sent_at timestamptz default now()
);

-- 9. 관심 표시 ("관심있어요 · 점핑매니저 연결" 클릭 로그)
create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  contacted boolean default false, -- 점핑매니저가 연락했는지 여부 (관리자 화면에서 체크)
  outcome text default 'pending', -- pending | completed | no_deal (카카오톡 채널에서의 실거래 결과)
  completed_amount numeric, -- 실제 거래 성사 금액 (매물 가격과 다를 수 있음)
  completed_at timestamptz, -- 거래 성사/불발 처리 시각
  created_at timestamptz default now(),
  unique (deal_id, member_id)
);

-- 10. 판매자 매물 등록 신청 (누구나 신청 가능, 관리자가 검토 후 승인해야 deals에 등록됨)
create table if not exists public.seller_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text, -- 선택 항목 (등록 마찰을 줄이기 위해 필수 해제)
  contact_name text, -- 선택 항목
  contact_phone text not null,
  category_id int references public.categories(id),
  region_id int references public.regions(id),
  product_name text not null,
  quantity int not null,
  hope_price numeric,
  description text,
  images text[] default '{}', -- 판매자가 첨부한 사진 URL 목록
  hope_duration_hours int, -- 판매자가 희망하는 마감까지 남은 시간 (관리자 승인 시 기본값으로 사용)
  status text default 'pending', -- pending | approved | rejected
  linked_deal_id uuid references public.deals(id),
  created_at timestamptz default now()
);

-- ---------------- 마이그레이션 (이미 위 스키마를 실행한 적이 있다면, 이 블록만 다시 실행해도 안전합니다) ----------------
alter table public.interests add column if not exists contacted boolean default false;
alter table public.interests add column if not exists outcome text default 'pending';
alter table public.interests add column if not exists completed_amount numeric;
alter table public.interests add column if not exists completed_at timestamptz;
alter table public.deals add column if not exists description text;
alter table public.seller_requests add column if not exists hope_duration_hours int;
update public.categories set name = '전자제품' where name = '전자부품';
alter table public.seller_requests alter column company_name drop not null;
alter table public.seller_requests alter column contact_name drop not null;

-- 매물 상세 스펙 (포장 단위·원산지·규격·보관조건) — 구매자 의사결정에 필요한 정보 보강
alter table public.deals add column if not exists package_unit text;
alter table public.deals add column if not exists origin text;
alter table public.deals add column if not exists spec text;
alter table public.deals add column if not exists storage_condition text;
alter table public.seller_requests add column if not exists package_unit text;
alter table public.seller_requests add column if not exists origin text;
alter table public.seller_requests add column if not exists spec text;
alter table public.seller_requests add column if not exists storage_condition text;

-- 수량 단위 명시 + 최소주문수량(MOQ)
alter table public.deals add column if not exists quantity_unit text default '개';
alter table public.deals add column if not exists min_order_qty int;
alter table public.seller_requests add column if not exists quantity_unit text default '개';
alter table public.seller_requests add column if not exists min_order_qty int;

-- 사업자 회원의 상호명 (관리자 화면 식별용)
alter table public.members add column if not exists company_name text;

-- ---------------- RLS (Row Level Security) ----------------
alter table public.members enable row level security;
alter table public.member_categories enable row level security;
alter table public.member_regions enable row level security;
alter table public.deals enable row level security;
alter table public.interests enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_self" on public.push_subscriptions
  for all using (auth.uid() = member_id) with check (auth.uid() = member_id);

-- 본인 정보만 읽기/쓰기
create policy "members_self_select" on public.members
  for select using (auth.uid() = id);
create policy "members_self_upsert" on public.members
  for insert with check (auth.uid() = id);
create policy "members_self_update" on public.members
  for update using (auth.uid() = id);

create policy "member_categories_self" on public.member_categories
  for all using (auth.uid() = member_id) with check (auth.uid() = member_id);

create policy "member_regions_self" on public.member_regions
  for all using (auth.uid() = member_id) with check (auth.uid() = member_id);

-- 매물은 로그인한 회원 누구나 조회 가능 (공개 알림 리스트)
create policy "deals_public_select" on public.deals
  for select using (true);

-- 관심 표시는 본인 것만 생성/조회
create policy "interests_self" on public.interests
  for all using (auth.uid() = member_id) with check (auth.uid() = member_id);

-- 판매자 등록 신청: 누구나(비회원 포함) 신청서는 제출 가능, 조회/승인은 관리자(서비스 키)만
alter table public.seller_requests enable row level security;
create policy "seller_requests_public_insert" on public.seller_requests
  for insert with check (true);

-- 매물/신청서에 짧은 소개 영상(최대 15초) 첨부 지원
alter table public.deals add column if not exists video_url text;
alter table public.seller_requests add column if not exists video_url text;

-- 비회원이 "관심있어요"를 누를 때 회원가입 없이 전화번호만으로 리드를 남길 수 있게 하는 테이블
create table if not exists public.quick_leads (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  phone text not null,
  contacted boolean default false,
  outcome text default 'pending', -- pending | completed | no_deal
  completed_amount numeric,
  completed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.quick_leads enable row level security;
create policy "quick_leads_public_insert" on public.quick_leads
  for insert with check (true);

-- "이런 재고 찾습니다" — 구매 희망(수요) 등록. 판매자 등록(seller_requests)의 반대편 짝입니다.
create table if not exists public.buy_requests (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category_id int references public.categories(id),
  region_id int references public.regions(id),
  quantity text, -- 자유 입력(예: "300박스", "5,000개")이라 숫자로 강제하지 않습니다
  hope_price numeric,
  contact_phone text not null,
  description text,
  contacted boolean default false,
  outcome text default 'pending', -- pending | matched | no_match
  created_at timestamptz default now()
);
alter table public.buy_requests enable row level security;
create policy "buy_requests_public_insert" on public.buy_requests
  for insert with check (true);

-- 점핑파트너(추천인) 기능 — 누가 누구를 추천해서 가입했는지 추적 (리워드 없는 트래킹 전용)
alter table public.members add column if not exists referred_by uuid references public.members(id);

-- 추천 링크에 UUID 대신 쓸 짧은 코드 (예: "7F3KQ9"). 공유하기 좋게 회원마다 하나씩 부여됩니다.
alter table public.members add column if not exists ref_code text unique;

-- 회원번호 — 가입 순서대로 자동 증가 (화면에는 "JX-" + 5자리로 표시, src/lib/format.ts의 formatMemberNo 참고)
create sequence if not exists members_member_no_seq;
alter table public.members add column if not exists member_no integer;
update public.members m
set member_no = sub.rn
from (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.members
  where member_no is null
) sub
where m.id = sub.id;
select setval('members_member_no_seq', coalesce((select max(member_no) from public.members), 0) + 1, false);
alter table public.members alter column member_no set default nextval('members_member_no_seq');
alter table public.members alter column member_no set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'members_member_no_unique') then
    alter table public.members add constraint members_member_no_unique unique (member_no);
  end if;
end $$;

-- 프로필 보강(마이페이지 "프로필 완성하기") — 전부 선택 입력, 가입 필수 아님
-- 상호명은 이미 company_name 컬럼을 사용하므로 여기선 성명·이메일만 추가합니다.
alter table public.members add column if not exists name text;
alter table public.members add column if not exists email text;

-- 사업자등록증 첨부 — 비공개 버킷(business-licenses)의 저장 경로만 기록합니다 (공개 URL 아님).
-- business_verified 컬럼은 위 1번 테이블 정의에 이미 있습니다 (기본 false, 관리자가 검토 후 true로 전환).
alter table public.members add column if not exists business_license_path text;

-- members_self_update 정책은 컬럼을 구분하지 않아서, 회원이 자기 브라우저에서 직접
-- Supabase 클라이언트를 호출하면 관리자 검토 없이 스스로 business_verified를 켤 수 있습니다.
-- "✓ 인증된 사업자" 배지는 반드시 관리자(service_role) 검토를 거쳐야 하므로,
-- service_role이 아닌 요청이 이 값을 바꾸려 하면 트리거가 조용히 원래 값으로 되돌립니다.
create or replace function public.protect_business_verified()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and new.business_verified is distinct from old.business_verified then
    new.business_verified := old.business_verified;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists members_protect_business_verified on public.members;
create trigger members_protect_business_verified
  before update on public.members
  for each row execute function public.protect_business_verified();

-- ---------------- 카카오 로그인 → 휴대폰 SMS 인증 전환 (OTP 요청 제한) ----------------
-- 카카오 로그인을 걷어내고 휴대폰 OTP만 쓰기로 하면서(1번 섹션 주석에 적힌 원래
-- 설계로 복귀), 점프엑스(jumpx-luxury-redesign) schema.sql의 동일 패턴을 이
-- 프로젝트에 맞게 이식. src/lib/auth.ts의 sendOtp()/verifyOtp()가 사용합니다.
create table if not exists public.otp_request_log (
  id uuid primary key default gen_random_uuid(),
  phone text not null, -- E.164 정규화 형태 (src/lib/auth.ts의 toE164Phone 결과와 동일 규칙)
  event_type text not null check (event_type in ('REQUEST', 'VERIFY_FAIL', 'VERIFY_SUCCESS')),
  created_at timestamptz not null default now()
);

create index if not exists otp_request_log_phone_event_time_idx
  on public.otp_request_log (phone, event_type, created_at desc);

alter table public.otp_request_log enable row level security;
-- 관리자 화면(/admin)은 service_role 키를 써서 RLS를 우회하므로, 여기서는 일반
-- 회원(anon/authenticated)에게 아예 노출하지 않습니다 — select 정책을 두지 않음
-- (다른 신청서 테이블들의 "public_insert만 있고 select 없음" 패턴과 동일).

-- 로그인 전 상태(anon)에서도 호출해야 하므로 grant 대상에 anon 포함.
-- 정책: 같은 번호로 1분 이내 재요청 금지(COOLDOWN), 최근 1시간 이내 5회 초과
-- 요청 금지(HOURLY_LIMIT). 두 조건 모두 통과해야 REQUEST 기록을 남기고
-- allowed=true를 반환합니다 — "검사 통과 = 요청 1건 기록"이 한 트랜잭션에서 원자적으로 일어남.
create or replace function public.check_and_log_otp_request(p_phone text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_cooldown constant interval := interval '1 minute';
  v_window constant interval := interval '1 hour';
  v_max_per_window constant int := 5;
  v_last_request timestamptz;
  v_window_count int;
  v_oldest_in_window timestamptz;
begin
  select max(created_at) into v_last_request
    from public.otp_request_log
    where phone = p_phone and event_type = 'REQUEST';

  if v_last_request is not null and now() - v_last_request < v_cooldown then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'COOLDOWN',
      'retry_after_seconds', ceil(extract(epoch from (v_last_request + v_cooldown - now())))
    );
  end if;

  select count(*), min(created_at) into v_window_count, v_oldest_in_window
    from public.otp_request_log
    where phone = p_phone and event_type = 'REQUEST' and created_at > now() - v_window;

  if v_window_count >= v_max_per_window then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'HOURLY_LIMIT',
      'retry_after_seconds', greatest(ceil(extract(epoch from (v_oldest_in_window + v_window - now()))), 0)
    );
  end if;

  insert into public.otp_request_log (phone, event_type) values (p_phone, 'REQUEST');

  return jsonb_build_object('allowed', true);
end;
$$;

grant execute on function public.check_and_log_otp_request(text) to anon, authenticated;

-- OTP 검증 성공/실패 기록 전용(차단 로직 없음, 이력만 남김). 인증 실패 시점의
-- 호출자는 아직 로그인 상태가 아닐 수 있어 anon도 호출 가능해야 합니다.
create or replace function public.log_otp_verify_result(p_phone text, p_success boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.otp_request_log (phone, event_type)
  values (p_phone, case when p_success then 'VERIFY_SUCCESS' else 'VERIFY_FAIL' end);
end;
$$;

grant execute on function public.log_otp_verify_result(text, boolean) to anon, authenticated;

-- ---------------- 공식 점핑파트너 신청 ----------------
-- 마이페이지(src/app/mypage/page.tsx)에서 회원이 직접 신청 → 관리자(src/app/api/admin/partner-requests/route.ts)가
-- 승인/반려. 승인 시에만 members.is_official_partner가 true로 바뀝니다(그 API가 유일한 기록 경로).
create table if not exists partner_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  business_type text not null,
  channel_info text not null,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table members add column if not exists is_official_partner boolean not null default false;

alter table partner_requests enable row level security;

create policy partner_requests_self_insert on partner_requests
  for insert to authenticated
  with check (auth.uid() = member_id);

create policy partner_requests_self_select on partner_requests
  for select to authenticated
  using (auth.uid() = member_id);
-- 관리자 조회/승인은 서버(service role) API로만 처리 -> 별도 admin 정책 불필요

-- ---------------- 관리자 다중 계정 인증 (기존 단일 공유 비밀번호 대체) ----------------
-- 이전에는 ADMIN_PASSWORD 환경변수 하나를 모든 admin API가 그대로 비교했습니다.
-- 이제는 admin_users 테이블에 계정별로 해시된 비밀번호를 저장하고, 로그인 성공 시
-- src/lib/adminAuth.ts가 HMAC 서명된 세션 토큰(x-admin-key 헤더)을 발급합니다 —
-- 그 세션 토큰만 검증하면 되므로 각 admin API 라우트는 더 이상 비밀번호 자체를
-- 알 필요가 없습니다. src/app/api/admin/login/route.ts 참고.
create extension if not exists pgcrypto;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '관리자' check (role in ('최고관리자','관리자')),
  password_hash text not null,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;
-- 정책 없음 = anon/authenticated 완전 차단, service role만 접근 (서버 API에서만 사용)

create or replace function verify_admin_login(p_password text)
returns table (id uuid, name text, role text)
language sql
security definer
as $$
  select id, name, role from admin_users
  where password_hash = crypt(p_password, password_hash)
  limit 1;
$$;

alter table partner_requests add column if not exists reviewed_by text;
alter table seller_requests add column if not exists reviewed_by text;

-- 최초 관리자 계정은 위 마이그레이션 실행 후 Supabase SQL Editor에서 직접,
-- 한 번만 수동으로 등록하세요 (반복 실행 시 중복 계정이 생기므로 여기 그대로
-- 두지 않습니다):
--   insert into admin_users (name, role, password_hash)
--   values ('담당자 이름', '최고관리자', crypt('원하는 비밀번호', gen_salt('bf')));

-- 관리자 인증(admin_users, 비밀번호)과 회원 인증(휴대폰 인증)이 분리돼 있어서
-- 마이페이지에서 "이 회원이 관리자인지" 판별할 방법이 없었습니다. admin_users에
-- phone을 연결해서 회원 로그인 상태로도 관리자 여부를 조회할 수 있게 합니다
-- (src/app/api/is-admin/route.ts 참고). 조회는 항상 service role로만 이루어지므로
-- RLS 정책은 추가하지 않습니다.
alter table admin_users add column if not exists phone text unique;

-- 기존 관리자 계정에 phone을 채워 넣으세요 (SQL Editor에서 한 번만, 본인 계정에 맞게 값 수정):
--   update admin_users set phone = '01012345678' where name = '담당자 이름';

-- 지금까지는 관리자를 추가하려면 SQL Editor에서 insert문을 직접 실행해야 했는데,
-- placeholder 값을 그대로 실행하는 사고가 실제로 있었습니다. 이제 관리자 대시보드
-- UI(회원 목록 → "관리자로 임명")에서 처리하도록, 비밀번호 해싱을 DB 함수로 옮깁니다.
-- 두 함수 모두 service_role에서만 호출하므로(anon/authenticated에게는 EXECUTE 권한을
-- 아예 주지 않음) verify_admin_login처럼 세션 토큰만으로 신원을 이미 검증한 API 라우트
-- (src/app/api/admin/admins/route.ts, src/app/api/admin/change-password/route.ts)를
-- 거쳐야만 실행됩니다.
create or replace function create_admin_user(p_name text, p_phone text, p_role text, p_password text)
returns table (id uuid, name text, role text)
language sql
security definer
as $$
  insert into admin_users (name, phone, role, password_hash)
  values (p_name, p_phone, p_role, crypt(p_password, gen_salt('bf')))
  returning id, name, role;
$$;
revoke all on function create_admin_user(text, text, text, text) from public;

create or replace function update_admin_password(p_id uuid, p_old_password text, p_new_password text)
returns boolean
language plpgsql
security definer
as $$
declare
  matched boolean;
begin
  select exists(
    select 1 from admin_users
    where id = p_id and password_hash = crypt(p_old_password, password_hash)
  ) into matched;

  if not matched then
    return false;
  end if;

  update admin_users set password_hash = crypt(p_new_password, gen_salt('bf')) where id = p_id;
  return true;
end;
$$;
revoke all on function update_admin_password(uuid, text, text) from public;

-- ---------------- Storage (매물 사진 저장용) ----------------
-- 아래는 SQL Editor가 아니라 Supabase 대시보드 → Storage 메뉴에서 수동으로 설정하세요:
-- 1. "New bucket" → 이름: deal-images, Public bucket 체크 (누구나 읽기 가능하게)
-- 2. 업로드는 서버(API 라우트, service_role 키)를 통해서만 이루어지므로 별도 정책 설정은 필요 없습니다.
-- 3. 짧은 소개 영상도 같은 deal-images 버킷에 함께 저장됩니다 (별도 버킷 생성 불필요).

-- ---------------- Storage (사업자등록증 저장용 — 반드시 비공개) ----------------
-- 아래도 SQL Editor가 아니라 Supabase 대시보드 → Storage 메뉴에서 수동으로 설정하세요:
-- 1. "New bucket" → 이름: business-licenses, Public bucket 체크는 반드시 해제(비공개 유지)
-- 2. 업로드·조회 모두 서버(API 라우트, service_role 키)를 통해서만 이루어집니다.
--    service_role 키는 RLS를 우회하므로 별도 Storage 정책 설정은 필요 없습니다.
--    (다만 이 버킷은 절대 "Public bucket"으로 만들지 마세요 — 공개로 설정하면 누구나 URL로 접근할 수 있습니다.)
-- 3. 조회는 관리자 화면에서 요청할 때마다 만료 시간이 짧은 서명된 URL(signed URL)을 그때그때 생성해서 사용합니다.
