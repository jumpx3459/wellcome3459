-- ============================================================================
-- 2026-10-05 /sell 판매 신청 "가격 협의" — seller_requests.price_mode 추가 (더하기만, 기존 행은 전부 fixed)
-- 코드: src/lib/priceMode.ts(resolveSellerRequestPrice), src/app/api/seller-requests/route.ts, src/app/sell/page.tsx, 관리자 신청 목록·승인 폼 (브랜치 feat/sell-price-negotiable)
--
-- 모델(매물 deals.price_mode 와 같은 개념): 'fixed' = 희망가(hope_price) 필수 / 'negotiable' = 희망가·정상가 둘 다 null.
--   hope_price·original_price 는 이미 NULL 허용 칸이라 NOT NULL 해제는 필요 없음.
--   CHECK seller_requests_price_by_mode_check: (fixed 이고 hope_price not null) 또는 (negotiable 이고 hope_price·original_price null).
--   fixed 의 original_price 는 예전처럼 선택(null 허용).
-- 권한: seller_requests 는 공개 조회·직접 insert 권한이 없고 서버 service role 만 읽고 씀(신청 저장·관리자 목록) → 새 칸 grant 불필요.
-- 영향: 기존 행은 default 'fixed' 로 채워짐. 희망가가 비어 있는 예전 신청이 있으면 CHECK 가 실패하므로 0) 확인에서 먼저 확인.
--   실패하면 ALTER 전체가 취소돼 아무것도 바뀌지 않음.
--
-- 운영 순서(대표): ① 0) 실행 전 확인 → ② 이 파일 1~2 실행 → ③ 확인 조회(기대값 일치) → ④ PR merge·배포.
--   ④ 전에 ②를 해야 함 — 새 코드는 신청 저장 때 price_mode 칸에 값을 넣으므로 칸이 없으면 판매 신청이 실패함.
--   ② 뒤 ④ 전: 기존 코드는 이 칸을 안 쓰므로 영향 없음(신청은 default 'fixed').
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (has_col = 0, null_hope_rows = 0 이어야 함. null_hope_rows > 0 이면 그 신청의 hope_price 를 채우거나 정리한 뒤 실행)
--   select (select count(*) from information_schema.columns
--            where table_schema = 'public' and table_name = 'seller_requests' and column_name = 'price_mode') as has_col,
--          (select count(*) from public.seller_requests where hope_price is null) as null_hope_rows,
--          (select count(*) from public.seller_requests) as reqs;

-- 1) 가격 방식 칸 (기존 행은 fixed)
alter table public.seller_requests add column if not exists price_mode text not null default 'fixed';
alter table public.seller_requests drop constraint if exists seller_requests_price_mode_check;
alter table public.seller_requests add constraint seller_requests_price_mode_check check (price_mode in ('fixed', 'negotiable'));

-- 2) 방식과 가격이 어긋나지 않게 — fixed 는 희망가 필수, negotiable 은 희망가·정상가 모두 없음
alter table public.seller_requests drop constraint if exists seller_requests_price_by_mode_check;
alter table public.seller_requests add constraint seller_requests_price_by_mode_check
  check (
    (price_mode = 'fixed' and hope_price is not null)
    or (price_mode = 'negotiable' and hope_price is null and original_price is null)
  );
notify pgrst, 'reload schema';

-- ============================================================================
-- 확인 — 한 행. 기대값: has_col = 1, default_fixed = true, mode_check = 1, by_mode_check = 1, not_fixed = 0,
--   reqs = 0)에서 본 신청 수와 같음
--   select (select count(*) from information_schema.columns
--            where table_schema = 'public' and table_name = 'seller_requests' and column_name = 'price_mode') as has_col,
--          (select column_default like '''fixed''%' from information_schema.columns
--            where table_schema = 'public' and table_name = 'seller_requests' and column_name = 'price_mode') as default_fixed,
--          (select count(*) from pg_constraint where conrelid = 'public.seller_requests'::regclass and conname = 'seller_requests_price_mode_check') as mode_check,
--          (select count(*) from pg_constraint where conrelid = 'public.seller_requests'::regclass and conname = 'seller_requests_price_by_mode_check') as by_mode_check,
--          (select count(*) from public.seller_requests where price_mode <> 'fixed') as not_fixed,
--          (select count(*) from public.seller_requests) as reqs;
--
-- CHECK 동작 확인(선택, 행이 남지 않음 — 실패해야 정상, "OK" 알림이 나오면 통과)
--   do $$
--   begin
--     begin
--       insert into public.seller_requests (contact_phone, product_name, quantity, price_mode, hope_price)
--         values ('000', 'check-test', 1, 'negotiable', 1000);
--       raise exception 'CHECK 가 안 걸림';
--     exception when check_violation then
--       raise notice 'OK: negotiable + 희망가 있음 → 거절됨';
--     end;
--     begin
--       insert into public.seller_requests (contact_phone, product_name, quantity, price_mode, hope_price)
--         values ('000', 'check-test', 1, 'fixed', null);
--       raise exception 'CHECK 가 안 걸림';
--     exception when check_violation then
--       raise notice 'OK: fixed + 희망가 없음 → 거절됨';
--     end;
--   end $$;
--
-- 되돌리기 (negotiable 신청이 하나도 없을 때만 — 있으면 먼저 희망가를 채우거나 그 신청을 삭제. 아래 조회가 0이어야 함):
--   select count(*) as negotiable_rows from public.seller_requests where price_mode = 'negotiable';
--   alter table public.seller_requests drop constraint if exists seller_requests_price_by_mode_check;
--   alter table public.seller_requests drop constraint if exists seller_requests_price_mode_check;
--   alter table public.seller_requests drop column if exists price_mode;
-- ============================================================================
