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
  ('수산·축산물', 1), ('농산물', 2), ('생활용품', 3), ('패션잡화', 4),
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
  images text[] default '{}', -- 매물 사진 URL 목록 (기본 최대 6장 권장: 대표/실물/박스/라벨 + 여유 2장, 추천 리워드로 더 늘어날 수 있음)
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
  sent_at timestamptz default now(),
  clicked_at timestamptz -- 알림 클릭 시각 (전환율 측정용, sw.js → /api/notification-click)
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

-- 11. "JUMP X에서 입찰 참여하기" 클릭 수요 신호 — 거래 플랫폼 오픈 전까지는 실제
-- 브릿지로 보내지 않고 클릭 자체만 기록해서 니치별 수요를 가늠하는 용도.
create table if not exists public.bridge_interests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.bridge_interests enable row level security;
-- 정책 없음 = anon/authenticated 완전 차단, service role만 접근 (src/app/api/bridge-interest/route.ts)

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

-- 알림 발송 기록: 마이페이지에서 본인이 받은 알림 개수/목록을 보여주려면 조회가 필요함.
-- 기록 자체는 항상 service_role(sendPush.ts)이 남기므로 별도 insert 정책은 불필요 —
-- RLS 없이 방치돼 있던 걸 마이페이지에서 처음 조회하게 되면서 함께 잠갔다.
alter table public.notification_logs enable row level security;
create policy "notification_logs_self_select" on public.notification_logs
  for select using (auth.uid() = member_id);

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

-- ---------------- 추천 리워드(사진 슬롯 +2) — 2026-09-23 ----------------
-- bonus_photo_slots/referral_bonus_granted는 protect_business_verified와 같은 이유로
-- 클라이언트가 upsert()로 직접 값을 써 넣을 수 없게 막아야 합니다(그렇지 않으면 아무나
-- 브라우저 콘솔에서 bonus_photo_slots를 마음대로 올릴 수 있음). 지급 로직 자체를 이
-- 트리거 안(서버 사이드)에서 계산하는 방식으로 막습니다 — signup/page.tsx는 손대지 않고
-- referred_by만 기존처럼 넘기면, 신규 회원 본인 +2 · 추천인 +2가 트리거에서 처리됩니다.
-- 2026-09-27: 마이페이지 프로필 사진. 본인 행에만 쓰는 값이라 기존
-- members_self_update 정책(auth.uid() = id)으로 충분 — 별도 RLS 불필요.
alter table public.members add column if not exists avatar_url text;

alter table public.members add column if not exists bonus_photo_slots integer not null default 0;
alter table public.members add column if not exists referral_bonus_granted boolean not null default false;

create or replace function public.grant_referral_bonus()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.bonus_photo_slots := 0;
    new.referral_bonus_granted := false;
    if new.referred_by is not null then
      new.bonus_photo_slots := 2;
      new.referral_bonus_granted := true;
      update public.members
      set bonus_photo_slots = coalesce(bonus_photo_slots, 0) + 2
      where id = new.referred_by;
    end if;
  elsif tg_op = 'UPDATE' then
    new.bonus_photo_slots := old.bonus_photo_slots;
    new.referral_bonus_granted := old.referral_bonus_granted;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists members_grant_referral_bonus on public.members;
create trigger members_grant_referral_bonus
  before insert or update on public.members
  for each row execute function public.grant_referral_bonus();

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

-- ---------------- 쪽지(회원간 메시지) + 매물 등록 시 업체명 비공개 옵션 (2026-09-23) ----------------
alter table public.seller_requests add column if not exists seller_member_id uuid references public.members(id);
alter table public.seller_requests add column if not exists is_anonymous boolean default false;

alter table public.deals add column if not exists seller_member_id uuid references public.members(id);
alter table public.deals add column if not exists is_anonymous boolean default false;
alter table public.deals add column if not exists seller_display_name text;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  sender_id uuid references public.members(id) on delete cascade,
  receiver_id uuid references public.members(id) on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);
alter table public.messages enable row level security;

create policy "messages_select_own" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "messages_insert_own" on public.messages
  for insert with check (auth.uid() = sender_id);
-- 3. 조회는 관리자 화면에서 요청할 때마다 만료 시간이 짧은 서명된 URL(signed URL)을 그때그때 생성해서 사용합니다.

-- 카테고리 이름-실제 쓰임 불일치 정리: '농수축산물'(이름은 농/수/축산 다 포함하는데 실제로는
-- 농산물만 담당)과 '냉동냉장식품'(이름은 보관상태인데 실제로는 수산물+축산물 전체를 담당)을
-- 품목 유형 기준으로 재정리. 보관 상태(냉동/건조/활 등)는 deals.storage_condition에서 다룸.
update public.categories set name = '농산물' where name = '농수축산물';
update public.categories set name = '수산·축산물' where name = '냉동냉장식품';

-- 2026-09-26: 매물 카드/상세에 "관심 표시" 개수를 공개로 노출하기 위한 비정규화 카운터.
-- interests(회원 관심표시)+quick_leads(비회원 원클릭 리드) 둘 다 사용자 입장에선 동일한
-- "관심있어요" 액션이라 합산해서 센다. interests는 RLS(interests_self)로 본인 것만 조회
-- 가능해 클라이언트에서 직접 count(*) 못 하므로, deals 테이블에 카운터 컬럼을 두고
-- insert/delete 시점에 트리거로 증감시키는 방식을 씀 — deals_public_select(select using
-- true)로 이미 누구나 조회 가능해서 추가 RLS 정책 없이 그대로 노출됨.
alter table public.deals add column if not exists interest_count int not null default 0;

update public.deals d
set interest_count = (
  coalesce((select count(*) from public.interests i where i.deal_id = d.id), 0)
  + coalesce((select count(*) from public.quick_leads q where q.deal_id = d.id), 0)
);

-- SECURITY DEFINER 필수: 일반 회원 세션으로 실행돼도(RLS엔 deals UPDATE 정책이 없음)
-- 카운터 갱신은 통과시키기 위함. search_path 고정은 함수 하이재킹 방지용 관례.
create or replace function public.sync_deal_interest_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.deals set interest_count = interest_count + 1 where id = new.deal_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.deals set interest_count = greatest(interest_count - 1, 0) where id = old.deal_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_interests_sync_interest_count on public.interests;
create trigger trg_interests_sync_interest_count
  after insert or delete on public.interests
  for each row execute function public.sync_deal_interest_count();

drop trigger if exists trg_quick_leads_sync_interest_count on public.quick_leads;
create trigger trg_quick_leads_sync_interest_count
  after insert or delete on public.quick_leads
  for each row execute function public.sync_deal_interest_count();

-- 2026-09-28: interest_count는 회원(interests)+비회원(quick_leads) 합산이라 관리자가
-- 비회원 비중을 구분할 수 없었음. quick_lead_count를 별도로 둬서 회원 수는
-- (interest_count - quick_lead_count)로 화면에서 바로 계산, 비회원 수는 quick_lead_count
-- 그대로 노출. 기존 interest_count 트리거/컬럼은 그대로 두고 quick_leads에 트리거 하나만 추가.
alter table public.deals add column if not exists quick_lead_count int not null default 0;

update public.deals d
set quick_lead_count = coalesce((select count(*) from public.quick_leads q where q.deal_id = d.id), 0);

create or replace function public.sync_deal_quick_lead_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.deals set quick_lead_count = quick_lead_count + 1 where id = new.deal_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.deals set quick_lead_count = greatest(quick_lead_count - 1, 0) where id = old.deal_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_quick_leads_sync_quick_lead_count on public.quick_leads;
create trigger trg_quick_leads_sync_quick_lead_count
  after insert or delete on public.quick_leads
  for each row execute function public.sync_deal_quick_lead_count();

-- 2026-09-26: 혼합매물(리퀴데이션/반품 팔레트) 대응 — 개별 상품 사진 없이 PID#(매니페스트
-- 번호)와 구성품 CSV 목록만으로도 매물을 등록할 수 있게. manifest_items는 CSV 헤더를 그대로
-- 컬럼명으로 쓴 Record<string,string>[] — 헤더 자동매핑 없이 원본 그대로 저장/노출함
-- (src/lib/parseCsv.ts 참고). seller_requests(신청서)와 deals(실제 매물) 둘 다 필요 —
-- 승인 시 seller_requests → deals로 admin이 그대로 복사해 넘김.
alter table public.seller_requests add column if not exists pid text;
alter table public.seller_requests add column if not exists manifest_items jsonb;
alter table public.deals add column if not exists pid text;
alter table public.deals add column if not exists manifest_items jsonb;

-- 2026-09-27 → 2026-09-27 수정: 점핑파트너 "내 추천 회원" 대시보드(표시+컨택메모).
-- 처음엔 members.referral_note 컬럼으로 만들었는데, members_self_select/
-- members_self_update 정책(auth.uid() = id, "본인 행"은 자유롭게 읽고 쓸 수 있음) 때문에
-- 추천받은 회원 본인이 Supabase를 직접 호출하면 추천인이 자신에 대해 적은 메모를
-- 읽거나 고칠 수 있는 문제가 있었음 — members 테이블에는 손대지 않는 별도 테이블로 분리.
-- RLS는 켜두되 정책을 하나도 만들지 않아 anon/authenticated 키로는 어떤 행도 접근할
-- 수 없고, service_role 키를 쓰는 /api/my-referrals 라우트(요청자 id = 대상 회원의
-- referred_by 수동 검증)를 통해서만 읽고 쓸 수 있음.
create table if not exists public.referral_notes (
  referrer_id uuid not null references public.members(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now(),
  primary key (referrer_id, member_id)
);
alter table public.referral_notes enable row level security;

-- 이미 배포돼 있던 members.referral_note에 데이터가 있으면 새 테이블로 옮기고 비움.
-- (컬럼 자체는 당장 drop하지 않음 — 다른 데서 참조가 없는 걸 한 번 더 확인한 뒤 별도로 제거)
insert into public.referral_notes (referrer_id, member_id, note)
select referred_by, id, referral_note
from public.members
where referral_note is not null and referred_by is not null
on conflict (referrer_id, member_id) do nothing;

update public.members set referral_note = null where referral_note is not null;

-- 2026-09-27: 점핑파트너 실적 집계(/api/admin/partners-overview)를 애플리케이션
-- 코드에서 "모든 추천 회원 행을 한 번에 select"로 계산했더니 두 가지 문제가 지적됨 —
-- (1) Supabase 기본 응답 한도(1,000행)를 넘으면 실적이 실제보다 적게 잡힘,
-- (2) "이번 달" 판정을 서버(UTC) 기준으로 해서 매달 1일 00~09시(KST)에 가입한
-- 회원이 지난달로 잘못 집계됨. DB에서 파트너별로 직접 group by해서 both 해결 —
-- 결과 행 수가 "추천 회원 수"가 아니라 "파트너 수"라 한도 문제가 원천적으로 없고,
-- KST 기준으로 월을 비교함.
create or replace function admin_partner_referral_stats()
returns table (
  partner_id uuid,
  total_referrals bigint,
  this_month_referrals bigint,
  business_verified_referrals bigint
)
language sql
security definer
set search_path = public
as $$
  select
    m.referred_by as partner_id,
    count(*) as total_referrals,
    count(*) filter (
      where date_trunc('month', m.created_at at time zone 'Asia/Seoul')
          = date_trunc('month', now() at time zone 'Asia/Seoul')
    ) as this_month_referrals,
    count(*) filter (where m.business_verified) as business_verified_referrals
  from public.members m
  where m.referred_by is not null
  group by m.referred_by;
$$;
revoke all on function admin_partner_referral_stats() from public;
-- 2026-09-27: "from public"만으로는 Supabase가 anon/authenticated에 따로 주는 EXECUTE
-- 기본 권한이 남아, 공개 anon 키로 /rest/v1/rpc/...를 호출하면 관리자 집계가 그대로
-- 반환되는 것을 실측으로 확인함 — 두 역할에서도 명시적으로 회수(service_role만 호출).
revoke execute on function admin_partner_referral_stats() from anon, authenticated;

-- 2026-09-27: /api/admin/category-kpis도 partners-overview와 같은 1,000행 응답
-- 한도 문제가 있었음 — interests/quick_leads/buy_requests/seller_requests 전체를
-- 무제한 select해서 JS로 카테고리별 집계했는데, 이 중 하나라도 누적 1,000행을
-- 넘으면 leads/완료율/액티브 지표가 전부 실제보다 적게 잡힘(심지어 "이번 달"이
-- 아니라 전체 누적 수치라 문제가 더 빨리 드러남). DB에서 카테고리별로 직접
-- group by해서 해결 — 결과 행 수가 "카테고리 수"(현재 9개)라 한도 문제가 없음.
create or replace function admin_category_kpis()
returns table (
  category_id int,
  leads bigint,
  completed bigint,
  no_match bigint,
  active_suppliers_7d bigint,
  active_demanders_7d bigint
)
language sql
security definer
set search_path = public
as $$
  with leads_union as (
    select
      d.category_id,
      case i.outcome when 'completed' then 'completed' when 'no_deal' then 'no_deal' else 'pending' end as outcome,
      i.created_at,
      'm:' || i.member_id::text as actor_key
    from public.interests i
    join public.deals d on d.id = i.deal_id
    where i.member_id is not null

    union all

    select
      d.category_id,
      case q.outcome when 'completed' then 'completed' when 'no_deal' then 'no_deal' else 'pending' end,
      q.created_at,
      'q:' || q.phone
    from public.quick_leads q
    join public.deals d on d.id = q.deal_id

    union all

    select
      b.category_id,
      case b.outcome when 'matched' then 'completed' when 'no_match' then 'no_deal' else 'pending' end,
      b.created_at,
      'b:' || b.contact_phone
    from public.buy_requests b
  ),
  lead_stats as (
    select
      category_id,
      count(*) as leads,
      count(*) filter (where outcome = 'completed') as completed,
      count(*) filter (where outcome = 'no_deal') as no_match,
      count(distinct actor_key) filter (where created_at >= now() - interval '7 days') as active_demanders_7d
    from leads_union
    where category_id is not null
    group by category_id
  ),
  supplier_stats as (
    select
      s.category_id,
      count(distinct s.contact_phone) filter (where s.created_at >= now() - interval '7 days') as active_suppliers_7d
    from public.seller_requests s
    where s.category_id is not null
    group by s.category_id
  )
  select
    coalesce(l.category_id, sup.category_id) as category_id,
    coalesce(l.leads, 0) as leads,
    coalesce(l.completed, 0) as completed,
    coalesce(l.no_match, 0) as no_match,
    coalesce(sup.active_suppliers_7d, 0) as active_suppliers_7d,
    coalesce(l.active_demanders_7d, 0) as active_demanders_7d
  from lead_stats l
  full outer join supplier_stats sup on sup.category_id = l.category_id;
$$;
revoke all on function admin_category_kpis() from public;
-- 2026-09-27: "from public"만으로는 Supabase가 anon/authenticated에 따로 주는 EXECUTE
-- 기본 권한이 남아, 공개 anon 키로 /rest/v1/rpc/...를 호출하면 관리자 집계가 그대로
-- 반환되는 것을 실측으로 확인함 — 두 역할에서도 명시적으로 회수(service_role만 호출).
revoke execute on function admin_category_kpis() from anon, authenticated;

-- 2026-09-27: 회원/리드 10만 규모 대비 — admin_partner_referral_stats(),
-- admin_category_kpis() 둘 다 group by/join 하는 컬럼(FK)에 인덱스가 하나도
-- 없었음. 지금(초기 리드 검증 단계) 데이터량에선 순차 스캔으로도 체감 차이가
-- 없지만, 각 테이블이 수만~수십만 행으로 커지면 이 RPC들과 관리자 화면의
-- 다른 조회(파트너별 추천 회원, 카테고리별 매물 등)가 전부 풀스캔을 타게 됨.
-- 지금 미리 걸어두면 비용이 거의 0이고 나중에 걸면 운영 중 락 이슈가 생길 수
-- 있어 먼저 반영.
create index if not exists interests_deal_id_idx on public.interests (deal_id);
create index if not exists interests_member_id_idx on public.interests (member_id);
create index if not exists quick_leads_deal_id_idx on public.quick_leads (deal_id);
create index if not exists members_referred_by_idx on public.members (referred_by);
create index if not exists buy_requests_category_id_idx on public.buy_requests (category_id);
create index if not exists seller_requests_category_id_idx on public.seller_requests (category_id);
create index if not exists deals_category_id_idx on public.deals (category_id);

-- ============================================================
-- 2026-09-28: 긴급 공지 (부동산·설비 등 처분 매물)
-- 재고 매물(deals)과 별개의 가벼운 공지판. 카카오 채널에서 자연 유입되는
-- 부동산/설비 처분 소식을 구조화된 수량/가격 없이 텍스트+사진+연락처만으로
-- 올린다. 구인/구직은 직업안정법상 구인·구직 정보 제공/중개 사업 신고 요건이
-- 부동산보다 훨씬 엄격해서, 법률 검토 전까지 카테고리에서 의도적으로 제외
-- (project memory: roadmap.md 참고). 알림도 기존 카테고리/지역 알림과 섞이지
-- 않도록 회원이 별도로 동의(opt-in)해야만 받는다 — 무분별한 전체발송으로
-- 알림 피로도가 올라가 정작 중요한 재고 알림 클릭률(North Star)이 깎이는 걸
-- 막기 위함.
create table if not exists public.urgent_notices (
  id uuid primary key default gen_random_uuid(),
  category text not null default '부동산', -- 부동산 | 설비 | 기타 (구인·구직 제외)
  title text not null,
  body text not null,
  region_id int references public.regions(id), -- null = 전국(지역 무관 알림 대상)
  contact_name text,
  contact_phone text,
  images text[] default '{}',
  status text default 'active', -- active | closed
  created_at timestamptz default now(),
  closed_at timestamptz
);

alter table public.urgent_notices enable row level security;
create policy "urgent_notices_public_select" on public.urgent_notices
  for select using (true);
-- 등록/수정은 관리자(service_role, /api/admin/notices)만 — deals와 동일하게
-- 별도 insert/update 정책 없이 서비스 키 경로로만 씀.

create index if not exists urgent_notices_status_idx on public.urgent_notices (status);
create index if not exists urgent_notices_region_id_idx on public.urgent_notices (region_id);

-- 긴급 공지 알림 opt-in — 기존 member_categories/member_regions(재고 매물 매칭)와는
-- 완전히 별개. 기본값 false로, 회원이 마이페이지에서 직접 켜야만 대상이 된다.
alter table public.members add column if not exists notice_alerts_opt_in boolean not null default false;

-- 2026-09-28: 푸시 알림 끄기 존중 — /unsubscribe "알림만 끄기"가 서버 구독만 지우면
-- 다른 기기에 남은 브라우저 구독을 마이페이지 알림 카드가 조용히 재저장해 알림이 되살아남.
-- true면 조용한 재저장(/api/push/subscribe, explicit 없음)은 건너뛰고, 사용자가 [알림 켜기]를
-- 직접 누를 때(explicit=true)만 false로 되돌린다. sendDealPush/sendNoticePush도 이 회원을 제외.
alter table public.members add column if not exists push_opt_out boolean not null default false;

-- 2026-09-28: otp_request_log 30일 경과 행 자동 정리 (pg_cron, 매일 03:00 KST = UTC 18:00).
-- 발송 제한 함수(check_and_log_otp_request)는 최근 1분/1시간만 보므로 영향 없음.
-- Supabase SQL Editor에서 실행 완료 (2026-09-28): extension 생성 성공, jobid 1, cron.job active = true.
-- 탈퇴 시 해당 번호 행은 /api/unsubscribe(withdraw)가 즉시 삭제한다.
create extension if not exists pg_cron;
select cron.schedule(
  'purge-otp-request-log',
  '0 18 * * *',
  $$ delete from public.otp_request_log where created_at < now() - interval '30 days' $$
);
-- 확인: select jobname, schedule, active from cron.job;
-- 해제: select cron.unschedule('purge-otp-request-log');

-- 2026-09-28: 쪽지 기능 당분간 숨김 (messages 0건, 사용 이력 없음 — src/lib/features.ts의
-- MESSAGES_ENABLED = false). 새 쪽지 저장을 막기 위해 insert 정책을 전부 제거한다.
-- select 정책(messages_select_own)은 유지. Supabase SQL Editor 실행 대상:
drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_insert_valid" on public.messages;

-- [재오픈용 — 지금은 실행하지 말 것] 다시 열 때 할 일:
--   1) 아래 messages_insert_valid 정책 생성
--   2) read_at update 정책 추가 (받은 사람만, read_at 컬럼만 — 안 읽음 표시용)
--   3) 새 쪽지 알림(푸시 또는 배지) 추가
--   4) MESSAGES_ENABLED = true
-- 기존 messages_insert_own은 sender_id = auth.uid()만 봐서 아무 회원 id·아무 매물로나
-- 쪽지를 보낼 수 있었음. 아래 정책은 허용 경우를 둘로 제한:
--   (a) 첫 쪽지/후속 문의: 받는 사람이 그 매물의 판매자(deals.seller_member_id)
--   (b) 답장: 같은 매물에서 받는 사람이 먼저 나에게 보낸 쪽지가 있음
-- 공통: 보낸 사람 = 나, 나 자신에게는 불가, 본문은 공백 아닌 글자 포함 1~1000자.
-- 서브쿼리의 messages 조회는 messages_select_own, deals 조회는 deals_public_select로 통과.
--
-- create policy "messages_insert_valid" on public.messages
--   for insert with check (
--     sender_id = auth.uid()
--     and receiver_id is not null
--     and sender_id <> receiver_id
--     and deal_id is not null
--     and char_length(body) between 1 and 1000
--     and body ~ '\S'
--     and (
--       exists (
--         select 1 from public.deals d
--         where d.id = messages.deal_id and d.seller_member_id = messages.receiver_id
--       )
--       or exists (
--         select 1 from public.messages prev
--         where prev.deal_id = messages.deal_id
--           and prev.sender_id = messages.receiver_id
--           and prev.receiver_id = messages.sender_id
--       )
--     )
--   );

-- 2026-09-29: 기능 오픈 알림 신청 (현재 "quotes" = 내 견적함 예고 카드). 회원당 기능별 1회,
-- role = 어떻게 쓸지(받은 견적 보관 receiver / 보낸 견적 관리 sender).
-- 관리자 집계는 service_role(/api/admin/feature-waitlist).
-- Supabase SQL Editor 실행 완료 (2026-09-29, member_id not null로). buy_requests.hope_price_unit도 같은 날 실행.
create table if not exists public.feature_waitlist (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  feature text not null,
  role text check (role in ('receiver', 'sender')), -- 내 견적함: 받은 견적 보관 / 보낸 견적 관리
  created_at timestamptz default now(),
  unique (member_id, feature)
);
alter table public.feature_waitlist enable row level security;
drop policy if exists "feature_waitlist_self_insert" on public.feature_waitlist;
create policy "feature_waitlist_self_insert" on public.feature_waitlist
  for insert with check (auth.uid() = member_id);
drop policy if exists "feature_waitlist_self_select" on public.feature_waitlist;
create policy "feature_waitlist_self_select" on public.feature_waitlist
  for select using (auth.uid() = member_id);

-- 2026-09-29: 구매 희망 단가의 기준 단위 — 예전엔 "원"만 있어 개당/kg당/총액을 알 수 없었음.
-- 값: 수량 단위("개"/"박스"/"kg"/"팔레트"/"톤"/"세트") 또는 "총액" (src/lib/format.ts PRICE_UNITS).
alter table public.buy_requests add column if not exists hope_price_unit text;

-- 2026-09-29: 구매 희망 요청 회원 연결 — 로그인 회원이 등록하면 /api/buy-requests가 access token에서
-- member_id를 넣는다(body 값은 신뢰 안 함). 연락처를 다른 번호로 바꿔도 연결 유지. 탈퇴 시 연결은
-- set null, 연락처는 /api/unsubscribe가 마스킹. Supabase SQL Editor 실행 완료 (2026-09-29).
alter table public.buy_requests add column if not exists member_id uuid references public.members(id) on delete set null;
create index if not exists buy_requests_member_id_idx on public.buy_requests (member_id);
