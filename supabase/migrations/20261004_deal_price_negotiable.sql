-- ============================================================================
-- 2026-10-04 "가격 협의" 매물 지원 — deals.price_mode 추가 + 가격 칸 NOT NULL 해제 (더하기·완화만, 기존 행은 전부 fixed)
-- 코드: src/lib/priceMode.ts, src/lib/dealPriceAccess.ts, src/lib/sendPush.ts, src/app/api/admin/deals/**, 관리자 폼 (브랜치 feat/deal-price-negotiable)
--
-- 모델: price_mode 'fixed' = 지금까지와 같음(판매가·정상가 둘 다 있음) / 'negotiable' = 가격 협의(판매가·정상가 둘 다 null).
--   CHECK deals_price_by_mode_check 가 이 둘만 허용 — (fixed 이고 두 가격 not null) 또는 (negotiable 이고 두 가격 null).
--   기존 행은 default 'fixed' 로 채워지고 가격이 모두 있어 통과해야 함(아래 0·확인 조회로 검증).
-- 그대로인 것: discount_pct(생성 칸 — 가격이 null 이면 이미 null), price_unit(제약 그대로, 협의 매물에도 저장될 수 있고 화면은 안 보임),
--   비회원(anon)의 deal_price·original_price 읽기 금지(2026-10-03 B). 새 칸 price_mode 만 anon·authenticated 가 읽을 수 있게 칸 단위 grant
--   (deals 는 칸 단위 select 권한이라 새 칸은 따로 줘야 함).
-- 영향: deals 표를 한 번 다시 쓸 수 있음(행 수가 적어 짧음). 배포 전 실행해도 지금 코드는 이 칸을 안 읽어 화면 영향 없음.
--
-- 운영 순서(대표): ① 0) 실행 전 확인 → ② 이 파일 1~4 실행 → ③ 확인 조회(기대값 일치) → ④ PR merge·배포.
--   ④ 전에 ②를 해야 함 — 새 코드는 price_mode 칸을 select 하므로 칸이 없으면 매물 목록·상세가 오류.
--   ② 뒤 ④ 전: 기존 코드는 이 칸을 안 쓰고, 가격은 기존 행이 모두 있어 영향 없음.
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (has_col = 0, deal_price_nullable = false, deals = 현재 매물 수, with_pct = 지금 discount_pct 있는 매물 수 → 기억해 두기)
--   select (select count(*) from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'price_mode') as has_col,
--          (select is_nullable = 'YES' from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'deal_price') as deal_price_nullable,
--          (select count(*) from public.deals) as deals,
--          (select count(*) from public.deals where deal_price is null or original_price is null) as null_price_rows,
--          (select count(*) from public.deals where discount_pct is not null) as with_pct;

-- 1) 가격 방식 칸 (기존 행은 fixed)
alter table public.deals add column if not exists price_mode text not null default 'fixed';
alter table public.deals drop constraint if exists deals_price_mode_check;
alter table public.deals add constraint deals_price_mode_check check (price_mode in ('fixed', 'negotiable'));

-- 2) 가격 칸 NOT NULL 해제
alter table public.deals alter column deal_price drop not null;
alter table public.deals alter column original_price drop not null;

-- 3) 방식과 가격이 어긋나지 않게 — fixed 는 두 가격 모두 필요, negotiable 은 두 가격 모두 없음
alter table public.deals drop constraint if exists deals_price_by_mode_check;
alter table public.deals add constraint deals_price_by_mode_check
  check (
    (price_mode = 'fixed' and deal_price is not null and original_price is not null)
    or (price_mode = 'negotiable' and deal_price is null and original_price is null)
  );

-- 4) 공개 화면(anon·authenticated)이 방식 칸을 읽을 수 있게 + PostgREST 스키마 다시 읽기
grant select (price_mode) on public.deals to anon, authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- 확인 — 한 행. 기대값: has_col = 1, default_fixed = true, mode_check = 1, by_mode_check = 1, deal_price_nullable = true,
--   original_price_nullable = true, anon_mode = true, auth_mode = true, anon_price = false(2026-10-03 B 실행 상태 그대로),
--   not_fixed = 0, null_price_rows = 0, deals = 0)에서 본 매물 수와 같음, with_pct = 0)에서 본 값과 같음(discount_pct 영향 없음)
--   select (select count(*) from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'price_mode') as has_col,
--          (select column_default like '''fixed''%' from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'price_mode') as default_fixed,
--          (select count(*) from pg_constraint where conrelid = 'public.deals'::regclass and conname = 'deals_price_mode_check') as mode_check,
--          (select count(*) from pg_constraint where conrelid = 'public.deals'::regclass and conname = 'deals_price_by_mode_check') as by_mode_check,
--          (select is_nullable = 'YES' from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'deal_price') as deal_price_nullable,
--          (select is_nullable = 'YES' from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'original_price') as original_price_nullable,
--          has_column_privilege('anon', 'public.deals', 'price_mode', 'select') as anon_mode,
--          has_column_privilege('authenticated', 'public.deals', 'price_mode', 'select') as auth_mode,
--          has_column_privilege('anon', 'public.deals', 'deal_price', 'select') as anon_price,
--          (select count(*) from public.deals where price_mode <> 'fixed') as not_fixed,
--          (select count(*) from public.deals where deal_price is null or original_price is null) as null_price_rows,
--          (select count(*) from public.deals) as deals,
--          (select count(*) from public.deals where discount_pct is not null) as with_pct;
--
-- CHECK 동작 확인(선택, 행이 남지 않음) — "OK" 알림이 나오면 정상. (fixed 매물을 가격 그대로 negotiable 로 바꾸려는 시도는 CHECK 에 걸려야 함)
--   do $$
--   declare v_id uuid := (select id from public.deals limit 1);
--   begin
--     begin
--       update public.deals set price_mode = 'negotiable' where id = v_id;
--       raise exception 'CHECK 가 안 걸림';
--     exception when check_violation then
--       raise notice 'OK: fixed + 가격 있음 → negotiable 거절됨';
--     end;
--   end $$;
--
-- 되돌리기 (negotiable 매물이 하나도 없을 때만 — 있으면 먼저 가격을 채우거나 삭제):
--   alter table public.deals drop constraint if exists deals_price_by_mode_check;
--   alter table public.deals alter column deal_price set not null;
--   alter table public.deals alter column original_price set not null;
--   alter table public.deals drop constraint if exists deals_price_mode_check;
--   alter table public.deals drop column if exists price_mode;
-- ============================================================================
