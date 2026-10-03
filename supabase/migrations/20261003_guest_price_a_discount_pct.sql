-- ============================================================================
-- 2026-10-03 A안 비회원 가격 비공개 — A: 할인율 칸 deals.discount_pct 추가 (운영 순서: A 실행 → PR 배포 → B 실행)
-- 왜: 비회원(anon)은 B 이후 deal_price·original_price를 못 읽음. 카드 할인율 배지·"-N% · 회원가 보기"·평균 할인율·할인율순 정렬·
--     공유 미리보기 제목("매물명 · N% ↓")은 이 칸으로 계산.
-- 계산: 화면(src/lib/dealPriceAccess.ts cardDiscountPct = 카드 계산 Math.round(((정상가 - 판매가) / 정상가) * 100))와 같게 —
--       float8(= JS Number)로 같은 순서의 연산, Math.round와 같은 반올림(0.5는 올림) floor(x + 0.5).
--       null: 정상가 없음·0 이하, 판매가 없음, 판매가 ≥ 정상가 (화면은 이때 배지를 안 그림).
-- 기존 행 영향: stored generated 칸이라 추가할 때 표를 한 번 다시 씀(deals 전체 잠금 — 행 수가 적어 짧음). 값은 자동 계산, backfill 불필요.
--   이후 insert·update는 그대로(이 칸은 쓰지 않음 — 쓰면 오류. 코드에서 쓰는 곳 없음).
-- 배포 전 실행해도 화면 영향 없음(지금 코드는 이 칸을 안 읽음). PR 배포 뒤 비회원 화면은 이 칸을 읽으므로 반드시 배포 전에 실행.
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (has_col = 0)
--   select (select count(*) from public.deals) as deals,
--          (select count(*) from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'discount_pct') as has_col;

-- 1) 할인율 칸
alter table public.deals add column if not exists discount_pct int
  generated always as (
    case
      when original_price is null or original_price <= 0 or deal_price is null or deal_price >= original_price then null
      else floor(((original_price::float8 - deal_price::float8) / original_price::float8) * 100 + 0.5)::int
    end
  ) stored;

-- 2) 공개 화면(anon·authenticated)이 읽을 수 있게 — deals는 칸 단위 select 권한(2026-09-30 ③)이라 새 칸은 따로 줘야 함
grant select (discount_pct) on public.deals to anon, authenticated;

-- 3) PostgREST 스키마 다시 읽기 (보통 자동이지만 확실히)
notify pgrst, 'reload schema';

-- 확인 — 한 행 (has_col = 1, anon_pct = true, auth_pct = true, anon_price = true(B 전이라 아직 true), mismatched = 0)
--   select (select count(*) from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'discount_pct') as has_col,
--          has_column_privilege('anon', 'public.deals', 'discount_pct', 'select') as anon_pct,
--          has_column_privilege('authenticated', 'public.deals', 'discount_pct', 'select') as auth_pct,
--          has_column_privilege('anon', 'public.deals', 'deal_price', 'select') as anon_price,
--          (select count(*) from public.deals
--            where original_price > 0 and deal_price < original_price
--              and discount_pct is distinct from round((original_price - deal_price) / original_price * 100)::int) as mismatched;
--   (mismatched는 numeric 반올림과 비교 — 0이 아니면 해당 행을 보고 float/numeric 반올림 경계(xx.5)인지 확인)
-- 표본 눈으로 보기:
--   select title, original_price, deal_price, discount_pct from public.deals order by created_at desc limit 20;

-- 되돌리기 (B를 실행했다면 B부터 되돌린 뒤):
--   alter table public.deals drop column if exists discount_pct;
