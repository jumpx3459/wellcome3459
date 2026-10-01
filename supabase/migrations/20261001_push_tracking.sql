-- ============================================================================
-- 2026-10-01 PR-A [10] 푸시 구독 관리 — 운영 DB 미실행 (대표 실행)
-- 배경(운영 확인): 9/28에 만든 구독이 VAPID 키 변경 전 키로 묶여 발송이 failed인데 MY 카드는 "알림 받는 중"이었음.
--   사이트 데이터 삭제 후 재구독하니 정상 수신.
-- 코드: src/lib/sendPush.ts(403도 죽은 구독으로 정리, 발송 결과 기록), src/lib/pushClient.ts(키 다르면 자동 재구독, 이 기기 끄기),
--       /api/push/subscribe(user_agent 저장), /api/push/unsubscribe(이 기기 구독 삭제), /api/push/status(이 기기 정보)
-- 배포 순서: ① 아래 1·2 실행 → ② 확인 조회(한 행) → ③ PR merge·배포
--   (SQL 전에 배포돼도 구독 저장은 동작 — 새 컬럼이 없으면 그 컬럼만 빼고 저장. 발송 결과 칸은 SQL 뒤부터 쌓임)
-- ============================================================================

-- 0) 실행 전 확인 — 한 행 (subs·logs 행 수 기록용, new_cols = 0)
--   select (select count(*) from public.push_subscriptions) as subs,
--          (select count(*) from public.notification_logs) as logs,
--          (select count(*) from information_schema.columns where table_schema = 'public'
--            and ((table_name = 'push_subscriptions' and column_name in ('user_agent','last_success_at'))
--              or (table_name = 'notification_logs' and column_name in ('subscription_id','error_code','error_message')))) as new_cols;

-- 1) 구독: 어떤 기기·브라우저인지(MY "이 기기: 안드로이드 크롬"), 마지막으로 보내기 성공한 시각
alter table public.push_subscriptions add column if not exists user_agent text;
alter table public.push_subscriptions add column if not exists last_success_at timestamptz;

-- 2) 발송 기록: 어느 구독으로 보냈는지 + 실패 이유(HTTP 상태, 짧은 메시지)
--    구독이 지워져도(만료 정리·이 기기 끄기) 기록은 남도록 on delete set null
alter table public.notification_logs add column if not exists subscription_id uuid
  references public.push_subscriptions(id) on delete set null;
alter table public.notification_logs add column if not exists error_code int;
alter table public.notification_logs add column if not exists error_message text;
create index if not exists notification_logs_subscription_idx on public.notification_logs (subscription_id);

-- 확인 — 한 행 (new_cols = 5, fk = 1)
--   select (select count(*) from information_schema.columns where table_schema = 'public'
--            and ((table_name = 'push_subscriptions' and column_name in ('user_agent','last_success_at'))
--              or (table_name = 'notification_logs' and column_name in ('subscription_id','error_code','error_message')))) as new_cols,
--          (select count(*) from pg_constraint where conrelid = 'public.notification_logs'::regclass and contype = 'f'
--            and pg_get_constraintdef(oid) like '%push_subscriptions%') as fk;

-- 배포 뒤 참고 조회 — 최근 실패 원인 (한 행씩)
--   select error_code, count(*), max(sent_at) from public.notification_logs
--    where status = 'failed' and sent_at > now() - interval '7 days' group by error_code order by 2 desc;
