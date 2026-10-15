-- 2026-10-15 SNS 유입 경로 저장 1단계(feat/utm-signup) — members에 utm_source·utm_medium·utm_campaign
-- ★ 운영 DB 실행 전 — 대표가 Supabase SQL Editor에서 실행. 실행 순서는 PROGRESS "배포 순서" 참고(SQL 먼저 → 확인 조회 → PR merge).
--
-- · 가입(INSERT) 때만 앱이 값을 보냄(src/app/signup/page.tsx — 신규 가입일 때만, 기존 회원 재인증·수정은 안 보냄).
--   값 출처는 첫 방문 주소의 ?utm_*(src/lib/utmStore.ts가 기기에 30일 저장, 허용 값만).
-- · 가입 후 변경 차단 — protect_member_columns()(BEFORE UPDATE)에 3줄 추가(referred_by와 같은 방식).
--   upsert로 기존 회원 행에 utm을 보내도 old 값으로 되돌아감(null이면 null 유지 — 이미 가입한 회원은 채워지지 않음).
--   service_role(관리자 서버)·SQL 편집기(auth.role() 없음)는 그대로 통과.
-- · 길이 32자 check(null 허용). 허용 값 목록(blog·youtube·…)은 앱에서만 거름 — 새 채널이 생겨도 SQL 변경 없이 앱만 고치면 됨.
-- · protect_member_columns 본문은 "2026-10-01 F-2" 정의(schema.sql 1834줄, 20261001_f2_connections.sql)를 그대로 옮기고 아래 3줄만 추가.
--   실행 전 확인 파일(20261015_members_utm_check.sql)의 U-0으로 운영 정의가 F-2 정의와 같은지 먼저 대조할 것.
-- · 코드는 이 SQL이 아직 없어도 가입이 깨지지 않게 만들어 둠(컬럼 없음 오류 PGRST204/42703이면 utm 없이 다시 저장).

alter table public.members
  add column if not exists utm_source text check (utm_source is null or char_length(utm_source) <= 32),
  add column if not exists utm_medium text check (utm_medium is null or char_length(utm_medium) <= 32),
  add column if not exists utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 32);

create or replace function public.protect_member_columns()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    new.referred_by := old.referred_by;
    new.member_no := old.member_no;
    new.phone := coalesce(public.member_auth_phone(new.id), old.phone);  -- 2026-10-01 F-2: 예전 new.phone := old.phone
    new.business_license_path := old.business_license_path;
    if old.ref_code is not null then new.ref_code := old.ref_code; end if;
    new.utm_source := old.utm_source;      -- 2026-10-15: SNS 유입은 가입(INSERT) 때만 기록, 이후 변경 차단
    new.utm_medium := old.utm_medium;
    new.utm_campaign := old.utm_campaign;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 새 컬럼을 API(PostgREST)가 바로 알도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';

-- 되돌리기(필요할 때만 — 컬럼에 쌓인 값이 사라짐):
--   create or replace function public.protect_member_columns() ... (위에서 utm 3줄만 뺀 F-2 정의)
--   alter table public.members drop column if exists utm_source, drop column if exists utm_medium, drop column if exists utm_campaign;
