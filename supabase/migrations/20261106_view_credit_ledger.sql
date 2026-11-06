-- 운영 2026-11-06 실행 완료. 재실행 금지.
begin;

create table public.view_credit_grants (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  source       text not null check (source in ('monthly','welcome','admin')),
  quantity     int  not null check (quantity between 1 and 100),
  period_month date,
  expires_at   timestamptz not null,
  reason       text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  check ((source = 'monthly') = (period_month is not null)),
  check (source <> 'admin' or (reason is not null and created_by is not null))
);

create table public.view_credit_events (
  id         uuid primary key default gen_random_uuid(),
  grant_id   uuid not null references public.view_credit_grants(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  kind       text not null check (kind in ('use','revoke')),
  quantity   int  not null check (quantity >= 1),
  deal_id    uuid references public.deals(id) on delete set null,
  reason     text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (kind <> 'use' or quantity = 1),
  check (kind <> 'revoke' or (reason is not null and created_by is not null))
);

create unique index view_credit_grants_monthly_uq on public.view_credit_grants(member_id, period_month) where source = 'monthly';
create unique index view_credit_grants_welcome_uq on public.view_credit_grants(member_id) where source = 'welcome';
create index view_credit_grants_member_exp_idx on public.view_credit_grants(member_id, expires_at);
create unique index view_credit_events_use_uq on public.view_credit_events(member_id, deal_id) where kind = 'use';
create index view_credit_events_grant_idx on public.view_credit_events(grant_id);

alter table public.view_credit_grants enable row level security;
alter table public.view_credit_events enable row level security;
revoke all on public.view_credit_grants, public.view_credit_events from public, anon, authenticated, service_role;
grant select, insert on public.view_credit_grants, public.view_credit_events to service_role;

create or replace function public.view_credit_ensure(p_member uuid)
returns void language plpgsql set search_path = public as $$
declare
  v_month timestamp := date_trunc('month', now() at time zone 'Asia/Seoul');
begin
  if not exists (select 1 from members where id = p_member and business_verified is true) then
    return;
  end if;
  insert into view_credit_grants(member_id, source, quantity, period_month, expires_at)
  values (p_member, 'monthly', 5, v_month::date, (v_month + interval '1 month') at time zone 'Asia/Seoul')
  on conflict (member_id, period_month) where source = 'monthly' do nothing;
  insert into view_credit_grants(member_id, source, quantity, expires_at)
  values (p_member, 'welcome', 5, now() + interval '90 days')
  on conflict (member_id) where source = 'welcome' do nothing;
end $$;

create or replace function public.view_credit_balance(p_member uuid)
returns table(remaining int, next_expires_at timestamptz)
language plpgsql set search_path = public as $$
begin
  perform view_credit_ensure(p_member);
  return query
  with lots as (
    select g.expires_at,
           g.quantity - coalesce((select sum(e.quantity) from view_credit_events e where e.grant_id = g.id), 0) as left_qty
    from view_credit_grants g
    where g.member_id = p_member and g.expires_at > now()
  )
  select coalesce(sum(l.left_qty), 0)::int, min(l.expires_at)
  from lots l where l.left_qty > 0;
end $$;

create or replace function public.view_credit_consume(p_member uuid, p_deal uuid)
returns table(result text, remaining int)
language plpgsql set search_path = public as $$
declare v_grant uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('view_credit:' || p_member::text, 0));
  if exists (select 1 from view_credit_events e
             where e.member_id = p_member and e.deal_id = p_deal and e.kind = 'use') then
    return query select 'already'::text, b.remaining from view_credit_balance(p_member) b;
    return;
  end if;
  perform view_credit_ensure(p_member);
  select g.id into v_grant
  from view_credit_grants g
  where g.member_id = p_member and g.expires_at > now()
    and g.quantity > coalesce((select sum(e.quantity) from view_credit_events e where e.grant_id = g.id), 0)
  order by g.expires_at, g.created_at
  limit 1;
  if v_grant is null then
    return query select 'no_credit'::text, 0;
    return;
  end if;
  insert into view_credit_events(grant_id, member_id, kind, quantity, deal_id)
  values (v_grant, p_member, 'use', 1, p_deal);
  return query select 'used'::text, b.remaining from view_credit_balance(p_member) b;
end $$;

revoke all on function public.view_credit_ensure(uuid), public.view_credit_balance(uuid),
  public.view_credit_consume(uuid, uuid) from public, anon, authenticated;
grant execute on function public.view_credit_ensure(uuid), public.view_credit_balance(uuid),
  public.view_credit_consume(uuid, uuid) to service_role;

commit;
