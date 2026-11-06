-- 운영 2026-11-06 실행 완료. 재실행 금지.
-- 열람권 회수 — 잔량 검사와 회수 행 insert를 한 트랜잭션에서 하고 consume과 같은 회원 advisory lock을 잡음.
-- 코드: src/lib/viewCreditsServer.ts revokeViewCredit, src/app/api/admin/members/[id]/view-credits/revoke/route.ts (브랜치 feat/manual-bizno-view-credit-admin)
begin;

create or replace function public.view_credit_revoke(
  p_member uuid, p_grant uuid, p_quantity int, p_reason text, p_admin uuid)
returns table(result text, remaining_after int)
language plpgsql set search_path = public as $$
declare v_left int; v_expires timestamptz;
begin
  if p_quantity is null or p_quantity < 1 or p_reason is null or btrim(p_reason) = '' or p_admin is null then
    return query select 'invalid'::text, 0; return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('view_credit:' || p_member::text, 0));  -- consume과 같은 키
  select g.expires_at, g.quantity - coalesce((select sum(e.quantity) from view_credit_events e where e.grant_id = g.id), 0)
    into v_expires, v_left
    from view_credit_grants g where g.id = p_grant and g.member_id = p_member;
  if not found then return query select 'not_found'::text, 0; return; end if;
  if v_expires <= now() then return query select 'expired'::text, 0; return; end if;
  if p_quantity > v_left then return query select 'exceeds'::text, v_left; return; end if;
  insert into view_credit_events(grant_id, member_id, kind, quantity, reason, created_by)
  values (p_grant, p_member, 'revoke', p_quantity, btrim(p_reason), p_admin);
  return query select 'revoked'::text, v_left - p_quantity;
end $$;

revoke all on function public.view_credit_revoke(uuid, uuid, int, text, uuid) from public, anon, authenticated;
grant execute on function public.view_credit_revoke(uuid, uuid, int, text, uuid) to service_role;

commit;
