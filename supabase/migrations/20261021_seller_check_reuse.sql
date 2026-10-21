-- ============================================================================
-- 2026-10-21 확인된 판매자 재사용(B안) — seller_business_checks.reused_from_check_id + (b_no, checked_at) 인덱스 (더하기만)
-- 운영 실행 2026-10-21 대표, 확인 uuid/YES·n·1·rows 27·reused 0·rls true
-- 코드: src/lib/businessReuse.ts, src/app/api/admin/business-checks/reusable·reuse (브랜치 feat/seller-check-reuse)
--
-- 재사용 = 원본(root: kind='validate' AND reused_from_check_id IS NULL AND (진위 일치 OR 예외 확인)) 행을 새 행으로 복사.
-- 복사 행은 reused_from_check_id에 항상 root id를 넣음(재사용의 재사용도 root를 따라감). 원본 행은 지우지 않음.
-- 되돌리기: drop index if exists public.seller_business_checks_bno_checked_idx;
--          alter table public.seller_business_checks drop column if exists reused_from_check_id;
-- ============================================================================
alter table public.seller_business_checks
  add column if not exists reused_from_check_id uuid references public.seller_business_checks(id) on delete set null;
comment on column public.seller_business_checks.reused_from_check_id is
  '재사용 행이면 원본(root) 조회 id — null이면 관리자가 국세청에 직접 조회한 행(root 후보)';
create index if not exists seller_business_checks_bno_checked_idx
  on public.seller_business_checks (b_no, checked_at desc);
