-- ============================================================================
-- 2026-10-27 브랜드 보호 1단계(PR 1) — deals 4칸 + 안전판 제약 + 화면 grant 2칸 + 비공개 버킷 — 운영 적용 2026-10-27(대표)
-- 확인 결과: has_cols 4 / anon_flag true / anon_count true / anon_paths false / auth_paths false / anon_brand false / bucket_public false / protected_rows 0 / chk 1
-- 의미: brand_protected = 켜면 공개 사진(images)은 대표 1장만, 나머지 사진(protected_images = 버킷 경로)·브랜드명(brand_name)은 가입 회원에게만(서버 API가 서명 URL로).
--   protected_images·brand_name 은 anon·authenticated에 select 권한을 주지 않음 — 화면 코드(브라우저)는 이 두 칸을 절대 select하지 말 것(요청 전체 42501), 서버(service role)만 읽음.
--   deals는 칸 단위 권한 구조(2026-09-30 ③)라 새 칸은 따로 grant하지 않으면 anon·authenticated가 못 읽음 — 그래서 아래 grant는 두 칸만.
-- 제약 deals_brand_protected_chk(보호 행만): 공개 사진 ≤ 1장 · video_url 없음 · brand_name 필수. 기존 행은 모두 false라 영향 없음. 서버 검증이 먼저 나가고 23514는 같은 문구로 변환.
-- seller_requests 칸은 PR 2(/sell).
-- ============================================================================
alter table public.deals add column if not exists brand_protected boolean not null default false;
alter table public.deals add column if not exists protected_images text[] not null default '{}';
alter table public.deals add column if not exists brand_name text;
alter table public.deals add column if not exists protected_image_count int
  generated always as (cardinality(protected_images)) stored;

alter table public.deals add constraint deals_brand_protected_chk
  check (not brand_protected
         or (coalesce(cardinality(images), 0) <= 1 and video_url is null and nullif(btrim(brand_name), '') is not null));

grant select (brand_protected, protected_image_count) on public.deals to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-images-protected', 'deal-images-protected', false, 20971520,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- 확인 조회 (결과: 4 / t / t / f / f / f / f / 0 / 1)
-- select (select count(*) from information_schema.columns
--          where table_schema='public' and table_name='deals'
--            and column_name in ('brand_protected','protected_images','brand_name','protected_image_count')) as has_cols,
--        has_column_privilege('anon','public.deals','brand_protected','select') as anon_flag,
--        has_column_privilege('anon','public.deals','protected_image_count','select') as anon_count,
--        has_column_privilege('anon','public.deals','protected_images','select') as anon_paths,
--        has_column_privilege('authenticated','public.deals','protected_images','select') as auth_paths,
--        has_column_privilege('anon','public.deals','brand_name','select') as anon_brand,
--        (select public from storage.buckets where id='deal-images-protected') as bucket_public,
--        (select count(*) from public.deals where brand_protected) as protected_rows,
--        (select count(*) from pg_constraint where conname='deals_brand_protected_chk') as has_chk;
-- 되돌리기 (보호 매물 0건일 때만):
--   alter table public.deals drop constraint if exists deals_brand_protected_chk;
--   alter table public.deals drop column if exists protected_image_count, drop column if exists protected_images,
--     drop column if exists brand_name, drop column if exists brand_protected;
--   delete from storage.buckets where id = 'deal-images-protected';   -- 버킷 안 파일을 먼저 비워야 함
