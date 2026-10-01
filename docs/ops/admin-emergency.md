# 관리자 긴급 복구 절차 (앱 관리자 로그인이 안 될 때)

앱의 `/admin`에 아무도 들어갈 수 없을 때 Supabase 대시보드 → **SQL Editor**에서 직접 처리하는 절차입니다.
이 문서에는 비밀번호·키 같은 비밀값을 적지 않습니다. 아래 `'…'` 자리는 실행하는 사람이 그 자리에서 직접 채웁니다.

- 관리자 계정 표: `public.admin_users` (id, name, phone, role, password_hash, last_login_at, created_at)
- 역할: `최고관리자` / `관리자` / `점핑매니저`(F 전까지 지정하지 않음)
- 로그인: 휴대폰 번호 + 비밀번호 (`verify_admin_login(p_phone, p_password)`), 같은 번호 15분 5회 실패 시 15분 잠금
- SQL Editor는 마지막 결과만 보여주므로 확인 조회는 모두 한 행으로 나오게 적었습니다.

## 0. 먼저 상태 보기

```sql
-- 관리자 목록 (번호는 뒤 4자리만)
select name, role, '****' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 4) as phone_tail, last_login_at
  from public.admin_users order by created_at;

-- 한 행 요약: 최고관리자 수 · 잠긴 번호 수(최근 15분 실패 5회 이상)
select (select count(*) from public.admin_users where role = '최고관리자') as super_admins,
       (select count(*) from (select phone from public.admin_login_failures
                               where created_at > now() - interval '15 minutes'
                               group by phone having count(*) >= 5) x) as locked_phones;
```

## 1. 로그인 잠금 풀기 (실패 5회로 잠긴 경우)

```sql
delete from public.admin_login_failures
 where phone = public.kpi_norm_phone('010-0000-0000');   -- 잠긴 관리자 번호

-- 확인 — 한 행 (0)
select count(*) as remaining from public.admin_login_failures
 where phone = public.kpi_norm_phone('010-0000-0000');
```

## 2. 비밀번호 재설정

```sql
update public.admin_users
   set password_hash = crypt('새 비밀번호', gen_salt('bf'))   -- 8자 이상, 실행 후 SQL Editor 기록에서 지울 것
 where public.kpi_norm_phone(phone) = public.kpi_norm_phone('010-0000-0000');

-- 확인 — 한 행 (true). 같은 값을 넣어 맞는지 확인
select exists (select 1 from public.verify_admin_login('010-0000-0000', '새 비밀번호')) as login_ok;
```

- 재설정 후 바로 앱에서 로그인해 **비밀번호 변경**으로 다시 바꾸는 것을 권장합니다.
- SQL Editor 실행 기록에 비밀번호가 남으므로, 실행 후 해당 쿼리를 기록에서 지워 주세요.

## 3. 최고관리자로 지정 / 해제

```sql
-- 지정
update public.admin_users set role = '최고관리자'
 where public.kpi_norm_phone(phone) = public.kpi_norm_phone('010-0000-0000');

-- 해제(관리자로 내림) — 마지막 최고관리자는 내리지 말 것 (아래 확인에서 1 이상이어야 함)
update public.admin_users set role = '관리자'
 where public.kpi_norm_phone(phone) = public.kpi_norm_phone('010-0000-0000');

-- 확인 — 한 행
select (select role from public.admin_users
         where public.kpi_norm_phone(phone) = public.kpi_norm_phone('010-0000-0000')) as role_now,
       (select count(*) from public.admin_users where role = '최고관리자') as super_admins;
```

- 역할은 요청마다 DB에서 다시 읽으므로 바꾸면 **바로** 적용됩니다(다시 로그인할 필요 없음).
- 설립자 계정(`FOUNDER_ADMIN_PHONE`) 보호는 앱 API에만 있습니다. SQL로는 막지 않으니 신중히.

## 4. 관리자 계정이 하나도 없을 때 새로 만들기

```sql
select * from public.create_admin_user('이름', '010-0000-0000', '최고관리자', '임시 비밀번호');

-- 확인 — 한 행 (true)
select exists (select 1 from public.verify_admin_login('010-0000-0000', '임시 비밀번호')) as login_ok;
```

- 번호는 회원 가입 번호와 같게 넣어야 MY 화면의 관리자 표시가 맞습니다.

## 5. 관리자 계정 지우기 (퇴사 등)

```sql
delete from public.admin_users
 where public.kpi_norm_phone(phone) = public.kpi_norm_phone('010-0000-0000');

-- 확인 — 한 행 (deleted = 0이면 지워짐, super_admins는 1 이상)
select (select count(*) from public.admin_users
         where public.kpi_norm_phone(phone) = public.kpi_norm_phone('010-0000-0000')) as deleted,
       (select count(*) from public.admin_users where role = '최고관리자') as super_admins;
```

- 지운 계정의 세션은 다음 요청부터 바로 막힙니다(요청마다 DB에서 계정을 다시 확인).

## 6. 앱 전체에서 관리자 로그인이 막혔을 때 (설정 문제)

- `ADMIN_SESSION_SECRET`이 없거나 32자 미만이면 로그인이 **일부러 거부**됩니다("관리자 세션 설정 오류").
  Vercel → 프로젝트 → Settings → Environment Variables에서 32자 이상 임의 문자열로 다시 넣고 재배포하세요.
  바꾸면 기존 관리자 세션은 모두 로그아웃됩니다.
- 무엇을 했는지는 감사 로그로 확인합니다:

```sql
select created_at, admin_name, action, target_type, detail
  from public.admin_audit_logs order by created_at desc limit 20;
```
