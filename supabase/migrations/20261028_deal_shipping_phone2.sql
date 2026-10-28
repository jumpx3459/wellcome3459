-- ============================================================================
-- 2026-10-28 관리자 등록 폼 v2 PR-A — 배송비 안내(deals 2칸) + 보조 연락처(deal_seller_private 1칸) — 운영 적용 2026-10-28(대표)
-- 확인 결과: deals_cols 2 / anon_type true / auth_note true / non_default_rows 0 / priv_col 1 / anon_phone2 false / auth_phone2 false / chk 3
-- 의미: shipping_fee_type = 'separate'(배송비 별도, 기본·기존 표시 그대로) | 'included'(배송비 포함) | 'negotiable'(협의). shipping_note = 배송 메모(≤60자, 선택).
--   deals는 칸 단위 권한 구조라 상세 화면(브라우저)이 읽도록 두 칸만 grant. 회원에게만 표시(비회원 화면은 안 그림).
--   contact_phone_2 = 판매자 보조 연락처(선택, 주 연락처와 같은 형식). deal_seller_private는 RLS + anon·authenticated 권한 전부 회수 상태라 서버(service role) 전용 — 새 grant 없음.
-- ============================================================================
alter table public.deals add column if not exists shipping_fee_type text not null default 'separate';
alter table public.deals drop constraint if exists deals_shipping_fee_type_check;
alter table public.deals add constraint deals_shipping_fee_type_check
  check (shipping_fee_type in ('separate', 'included', 'negotiable'));
alter table public.deals add column if not exists shipping_note text;
alter table public.deals drop constraint if exists deals_shipping_note_len_check;
alter table public.deals add constraint deals_shipping_note_len_check
  check (shipping_note is null or char_length(shipping_note) <= 60);
grant select (shipping_fee_type, shipping_note) on public.deals to anon, authenticated;

alter table public.deal_seller_private add column if not exists contact_phone_2 text;
alter table public.deal_seller_private drop constraint if exists deal_seller_private_phone2_check;
alter table public.deal_seller_private add constraint deal_seller_private_phone2_check
  check (contact_phone_2 is null or contact_phone_2 ~ '^[0-9]{8,11}$');

notify pgrst, 'reload schema';

-- 확인 조회 (결과: 2 / t / t / 0 / 1 / f / f / 3)
-- select (select count(*) from information_schema.columns
--          where table_schema='public' and table_name='deals'
--            and column_name in ('shipping_fee_type','shipping_note')) as deals_cols,
--        has_column_privilege('anon','public.deals','shipping_fee_type','select') as anon_type,
--        has_column_privilege('authenticated','public.deals','shipping_note','select') as auth_note,
--        (select count(*) from public.deals where shipping_fee_type <> 'separate') as non_default_rows,
--        (select count(*) from information_schema.columns
--          where table_schema='public' and table_name='deal_seller_private' and column_name='contact_phone_2') as priv_col,
--        has_column_privilege('anon','public.deal_seller_private','contact_phone_2','select') as anon_phone2,
--        has_column_privilege('authenticated','public.deal_seller_private','contact_phone_2','select') as auth_phone2,
--        (select count(*) from pg_constraint
--          where conname in ('deals_shipping_fee_type_check','deals_shipping_note_len_check','deal_seller_private_phone2_check')) as chk;
-- 되돌리기 (사용 중인 값이 없을 때만):
--   alter table public.deal_seller_private drop constraint if exists deal_seller_private_phone2_check, drop column if exists contact_phone_2;
--   alter table public.deals drop constraint if exists deals_shipping_note_len_check, drop constraint if exists deals_shipping_fee_type_check,
--     drop column if exists shipping_note, drop column if exists shipping_fee_type;
