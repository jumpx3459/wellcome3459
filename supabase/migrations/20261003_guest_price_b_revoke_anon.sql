-- ============================================================================
-- 2026-10-03 A안 비회원 가격 비공개 — B: 비회원(anon)의 판매가·정상가 읽기 권한 회수 (운영 순서: A 실행 → PR 배포 → B 실행)
-- 전제: deals는 2026-09-30 ③부터 표 단위 select 권한이 없고 칸 단위 권한만 있음(운영 확인 2026-10-03: anon_table_select = false,
--       anon·authenticated 각 32칸). 그래서 칸 단위 revoke로 이 두 칸만 막힘.
-- 영향: anon 키로 deal_price·original_price를 select하면 요청 전체가 42501(permission denied). PR 배포 뒤 화면 코드는
--       비회원이면 이 두 칸 대신 discount_pct를 조회(src/lib/dealPriceAccess.ts) → 배포 전에 실행하면 비회원 화면이 깨짐.
--   그대로인 것: authenticated(로그인 회원) 권한, service role(관리자 API·푸시·서버 라우트), RLS 정책 deals_public_select,
--   security definer 함수(sync_deal_*·admin_category_kpis·kpi_snapshot), 정책 안의 deals 참조(interests 마감 확인 — status·closes_at만).
--   deals를 참조하는 view 없음. 다른 표 embed deals(…)의 가격 칸(mypage 관심·알림 기록)은 로그인 회원 화면만.
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (has_pct = 1, anon_pct = true, anon_table = false, anon_price = true)
--   select (select count(*) from information_schema.columns
--            where table_schema = 'public' and table_name = 'deals' and column_name = 'discount_pct') as has_pct,
--          has_column_privilege('anon', 'public.deals', 'discount_pct', 'select') as anon_pct,
--          has_table_privilege('anon', 'public.deals', 'select') as anon_table,
--          has_column_privilege('anon', 'public.deals', 'deal_price', 'select') as anon_price;

revoke select (deal_price, original_price) on public.deals from anon;

-- 확인 — 한 행 (anon_deal = false, anon_orig = false, auth_deal = true, auth_orig = true, anon_pct = true, anon_title = true)
--   select has_column_privilege('anon', 'public.deals', 'deal_price', 'select') as anon_deal,
--          has_column_privilege('anon', 'public.deals', 'original_price', 'select') as anon_orig,
--          has_column_privilege('authenticated', 'public.deals', 'deal_price', 'select') as auth_deal,
--          has_column_privilege('authenticated', 'public.deals', 'original_price', 'select') as auth_orig,
--          has_column_privilege('anon', 'public.deals', 'discount_pct', 'select') as anon_pct,
--          has_column_privilege('anon', 'public.deals', 'title', 'select') as anon_title;

-- 되돌리기 (비회원 화면에서 deals 조회 오류가 나면 바로):
--   grant select (deal_price, original_price) on public.deals to anon;
