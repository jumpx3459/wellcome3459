-- 운영 2026-11-06 실행 완료(대표). 재실행 금지.
-- 수동 승인 회원 사업자번호 입력(method='manual') — 관리자가 등록증과 대조해 입력한 번호, 진위확인 아님.
-- 코드: src/app/api/admin/members/[id]/business-manual/route.ts (브랜치 feat/manual-bizno-view-credit-admin)
begin;

-- method='manual'은 대표자명·개업일 없이 저장
alter table public.member_business_checks alter column rep_name drop not null;
alter table public.member_business_checks alter column open_date drop not null;

-- validate_result에 'manual' 추가
alter table public.member_business_checks drop constraint member_business_checks_validate_result_check;
alter table public.member_business_checks add constraint member_business_checks_validate_result_check
  check (validate_result in ('01','02','error','manual'));

-- method별 모양: nts는 기존 규칙 그대로, manual은 validate_result='manual'만
alter table public.member_business_checks add constraint member_business_checks_method_shape_check check (
  (method = 'nts'    and validate_result in ('01','02','error') and rep_name is not null and open_date is not null)
  or
  (method = 'manual' and validate_result = 'manual')
);

comment on column public.member_business_checks.validate_result is
  '01 진위 일치 / 02 불일치 / error 국세청 오류(이상 method=nts) / manual 관리자가 등록증과 대조해 입력한 번호 — 진위확인 아님(method=manual)';

commit;
