-- ============================================================================
-- 2026-10-04 판매자 신원 확인(공개 전 4번) — 사업자 조회 기록 표 seller_business_checks (더하기만, 서버 전용)
-- 코드: src/lib/nts.ts, src/lib/businessCheck.ts, src/app/api/admin/business-checks/**, src/app/api/admin/deals/route.ts (브랜치 feat/seller-business-check)
--
-- 흐름: 점핑매니저가 통화로 사업자번호·대표자명·개업일자를 받아 관리자 화면 "사업자 조회"에서 국세청 진위확인·상태조회
--       → 한 번 조회할 때마다 이 표에 한 행. 판매 신청 승인([매물로 등록하기])은 그 신청의 최신 진위확인이
--       일치(validate_result = '01')이거나 예외 확인(exception_ok)일 때만 서버가 허용.
-- 저장하지 않는 것: 국세청 응답 원문, 서비스키. 사업자번호는 숫자 10자리만.
-- deal_seller_private·members.business_verified와는 연결하지 않음(별개).
-- retention_until: 보관 기한 — 채우는 작업은 공개 후 백로그(지금은 null).
--
-- 배포 순서: ① 이 파일 실행(대표, SQL Editor) ② 확인 조회 기대값 ③ Vercel NTS_API_KEY 등록 ④ PR merge·배포
--   ①을 ④ 전에 해야 함 — 배포 뒤 이 표가 없으면 사업자 조회·판매 신청 승인이 오류(승인은 "조회 후 등록" 409로 막힘).
--   ① 뒤 ④ 전에는 기존 코드가 이 표를 안 쓰므로 영향 없음.
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (exists = false, sr = true, deals = true, admins = true)
--   select to_regclass('public.seller_business_checks') is not null as exists,
--          to_regclass('public.seller_requests') is not null as sr,
--          to_regclass('public.deals') is not null as deals,
--          to_regclass('public.admin_users') is not null as admins;

create table if not exists public.seller_business_checks (
  id uuid primary key default gen_random_uuid(),
  seller_request_id uuid references public.seller_requests(id) on delete set null,   -- 판매 신청 없이(직접 등록용) 조회하면 null
  deal_id uuid references public.deals(id) on delete set null,                       -- 승인으로 만든 매물. 매물을 지워도 조회 기록은 남음
  kind text not null default 'validate'
    check (kind in ('validate', 'status_recheck')),   -- validate = 관리자 조회(진위확인+상태), status_recheck = 승인 시점 상태 재조회
  -- 입력 (국세청에 보낸 값)
  b_no text not null check (b_no ~ '^[0-9]{10}$'),   -- 사업자등록번호 숫자 10자리
  rep_name text,                                      -- 대표자 성명(p_nm) — status_recheck는 null
  open_date text check (open_date is null or open_date ~ '^[0-9]{8}$'),   -- 개업일자 YYYYMMDD(start_dt)
  input_company_name text,                            -- 관리자가 입력한 상호(선택, 국세청 b_nm로도 보냄)
  -- 결과 (응답 원문은 저장하지 않음)
  validate_result text check (validate_result in ('01', '02', 'error')),   -- 01 일치 / 02 불일치 / error 확인 대기. status_recheck는 null
  status_code text,                                   -- b_stt_cd: 01 계속 / 02 휴업 / 03 폐업 / '' 미등록 / null 모름(오류·불일치)
  status_text text,                                   -- b_stt 또는 미등록 안내(tax_type 메시지)
  tax_type text,                                      -- 과세유형 명칭
  error_kind text,                                    -- error일 때 이유: no_key·timeout·http_5xx·http_4xx·bad_json·network
  checked_at timestamptz not null default now(),
  checked_by_admin_id uuid references public.admin_users(id) on delete set null,
  -- 예외 확인 (진위 확인이 안 될 때 사업자등록증·폐업사실증명원 사본 확인 — 사본은 확인 후 즉시 파기, 저장 안 함)
  exception_ok boolean not null default false,
  exception_reason text,
  exception_by_admin_id uuid references public.admin_users(id) on delete set null,
  exception_by_admin_name text,                       -- 확인한 관리자 이름 — 관리자 계정을 지워(id → null) 누가 했는지 남김
  exception_at timestamptz,
  retention_until timestamptz,                        -- 보관 기한(공개 후 백로그에서 채움)
  created_at timestamptz not null default now(),
  -- 예외 확인이면 사유·확인 시각·확인자가 반드시 있음. 확인자는 id 또는 이름
  -- (관리자 해제는 admin_users 행 삭제라 id가 set null로 비어도 이 check에 걸리지 않게 이름을 함께 둠)
  constraint seller_business_checks_exception_chk check (
    not exception_ok
    or (exception_reason is not null and btrim(exception_reason) <> ''
        and exception_at is not null
        and (exception_by_admin_id is not null or exception_by_admin_name is not null))
  )
);

create index if not exists seller_business_checks_request_idx on public.seller_business_checks (seller_request_id, checked_at desc);
create index if not exists seller_business_checks_deal_idx on public.seller_business_checks (deal_id);
create index if not exists seller_business_checks_checked_idx on public.seller_business_checks (checked_at desc);

alter table public.seller_business_checks enable row level security;   -- 정책 없음 = service role만
revoke all on public.seller_business_checks from anon, authenticated;

-- 확인 — 한 행 (rls = true, policies = 0, anon_select = false, auth_select = false, svc_insert = true, exc_chk = true)
--   select c.relrowsecurity as rls,
--          (select count(*) from pg_policies where schemaname = 'public' and tablename = 'seller_business_checks') as policies,
--          has_table_privilege('anon', 'public.seller_business_checks', 'select') as anon_select,
--          has_table_privilege('authenticated', 'public.seller_business_checks', 'select') as auth_select,
--          has_table_privilege('service_role', 'public.seller_business_checks', 'insert') as svc_insert,
--          exists (select 1 from pg_constraint where conname = 'seller_business_checks_exception_chk') as exc_chk
--     from pg_class c where c.oid = 'public.seller_business_checks'::regclass;

-- 되돌리기 (이 표만 지움 — 다른 표·정책 영향 없음. PR을 먼저 revert한 뒤 실행. 조회 기록은 사라짐):
--   drop table if exists public.seller_business_checks;
