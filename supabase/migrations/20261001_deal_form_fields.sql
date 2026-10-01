-- ============================================================================
-- 2026-10-01 PR-B 매물 등록 폼 — 보관 조건·소비기한 분리 + 판매 신청 정상 단가 — 2026-10-01 대표 운영 DB 실행 완료 (확인 new_cols 5 · checks 2 · anon_expiry/storage true · anon_seller false)
-- 지금: 보관조건·소비기한이 deals/seller_requests.storage_condition(text) 한 칸에 자유 입력("냉동 · 26.12").
-- 바뀜: storage_type(상온·냉장·냉동) + expiry_date(date) 따로. 예전 storage_condition은 지우지 않고 그대로 —
--       새 칸이 비어 있는 행은 화면에서 storage_condition을 보여줌(src/lib/dealFields.ts storageSummary). backfill 없음.
--       /sell에 정상 단가(선택) 칸이 생겨 seller_requests.original_price 추가 → 승인 시 관리자 폼 정상 단가로 이어받음.
-- 배포 순서: ① 아래 1~3 실행 → ② 확인 조회(한 행) → ③ PR merge·배포
--   (SQL 전에 배포돼도 동작: 화면 조회는 새 컬럼 빼고 다시 조회, 저장은 새 컬럼 빼고 다시 저장 + storage_condition에 "냉동 · ~2026.10.20까지"로 남김)
-- 기존 행 영향: 새 컬럼 5개 모두 null 허용·기본값 없음 → 기존 행은 전부 null, 행 다시 쓰기 없음(빠름). check는 null 허용.
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (new_cols = 0)
--   select (select count(*) from public.deals) as deals, (select count(*) from public.seller_requests) as reqs,
--          (select count(*) from information_schema.columns where table_schema = 'public'
--            and ((table_name in ('deals','seller_requests') and column_name in ('expiry_date','storage_type'))
--              or (table_name = 'seller_requests' and column_name = 'original_price'))) as new_cols;

-- 1) 매물
alter table public.deals add column if not exists expiry_date date;
alter table public.deals add column if not exists storage_type text
  check (storage_type is null or storage_type in ('상온','냉장','냉동'));

-- 2) 판매 신청
alter table public.seller_requests add column if not exists expiry_date date;
alter table public.seller_requests add column if not exists storage_type text
  check (storage_type is null or storage_type in ('상온','냉장','냉동'));
alter table public.seller_requests add column if not exists original_price numeric;

-- 3) 공개 화면(anon·authenticated)이 deals 새 컬럼을 읽을 수 있게 — deals는 컬럼 단위 select 권한(2026-09-30 ③)이라 새 컬럼은 따로 줘야 함
--    seller_requests는 공개 조회 없음(서버 service role만) → 권한 추가 없음
grant select (expiry_date, storage_type) on public.deals to anon, authenticated;

-- 확인 — 한 행 (new_cols = 5, checks = 2, anon_expiry = true, anon_storage = true, anon_seller = false)
--   select (select count(*) from information_schema.columns where table_schema = 'public'
--            and ((table_name in ('deals','seller_requests') and column_name in ('expiry_date','storage_type'))
--              or (table_name = 'seller_requests' and column_name = 'original_price'))) as new_cols,
--          (select count(*) from pg_constraint where contype = 'c' and conrelid in ('public.deals'::regclass, 'public.seller_requests'::regclass)
--            and pg_get_constraintdef(oid) like '%storage_type%') as checks,
--          has_column_privilege('anon', 'public.deals', 'expiry_date', 'select') as anon_expiry,
--          has_column_privilege('anon', 'public.deals', 'storage_type', 'select') as anon_storage,
--          has_column_privilege('anon', 'public.deals', 'seller_member_id', 'select') as anon_seller;
