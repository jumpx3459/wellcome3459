-- ============================================================================
-- 2026-10-26 찾습니다 공급 제안 A안 — seller_requests.buy_request_id (더하기만)
-- 운영 적용 2026-10-26 대표(SQL Editor), 확인 조회: col_type uuid / fk_count 1 / idx_count 1 / linked_rows 0
-- 코드: src/app/api/seller-requests/route.ts(저장), /sell?buyRef(공급 제안 모드), 관리자 찾습니다·판매 신청 카드 (브랜치 feat/buy-supply-proposal)
--
-- buy_request_id = 이 신청이 응답한 buy_requests.id. 서버가 buyRef가 uuid이고 buy_requests에 행이 있으면 노출 여부와 무관하게 연결,
-- 없거나 형식 불량·조회 실패면 null. 요청 글이 지워지면 연결만 비움(신청은 남음).
-- 되돌리기: drop index if exists public.seller_requests_buy_request_id_idx;
--          alter table public.seller_requests drop column if exists buy_request_id;
-- ============================================================================
alter table public.seller_requests
  add column if not exists buy_request_id uuid references public.buy_requests(id) on delete set null;
create index if not exists seller_requests_buy_request_id_idx
  on public.seller_requests (buy_request_id) where buy_request_id is not null;
comment on column public.seller_requests.buy_request_id is
  '찾습니다 공급 제안이면 연결된 buy_requests.id (buyRef가 uuid이고 행이 있으면 노출 여부와 무관하게 연결, 아니면 null)';
notify pgrst, 'reload schema';

-- 확인 조회 (결과: uuid / 1 / 1 / 0)
-- select
--   (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'seller_requests' and column_name = 'buy_request_id') as col_type,
--   (select count(*) from pg_constraint where conrelid = 'public.seller_requests'::regclass and contype = 'f' and confrelid = 'public.buy_requests'::regclass) as fk_count,
--   (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'seller_requests' and indexname = 'seller_requests_buy_request_id_idx') as idx_count,
--   (select count(*) from public.seller_requests where buy_request_id is not null) as linked_rows;
