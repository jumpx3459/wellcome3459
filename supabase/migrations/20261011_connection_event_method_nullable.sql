-- 2026-10-11 PR ② 거래 연결 보드 4단계(feat/connection-board-simple) — 연락 방법 필수 해제
-- ★ 운영 DB 실행 완료(대표, 2026-10-11 — 이 PR 전에). 이 파일은 기록용. 다시 실행해도 결과 같음.
--
-- 보드가 "연락 방법(전화·문자·카톡)" 선택을 없앰 → 단계 이력(deal_connection_events.method)에 값이 없을 수 있음.
-- 허용값 check(phone·sms·kakao·app·alimtalk·system)는 그대로 — null만 새로 허용(check는 null을 통과시킴).
-- 서버(/api/admin/connections/[id]/step)는 method가 오면 phone·sms·kakao만 받고, 없으면 null로 저장.

alter table public.deal_connection_events alter column method drop not null;

-- 확인:
--   select is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'deal_connection_events' and column_name = 'method';   -- YES
--
-- 되돌리기(이력에 method null 행이 없을 때만 가능):
--   alter table public.deal_connection_events alter column method set not null;
