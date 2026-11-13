-- Synthetic Postgres17-only test tenant. NO real Supercell tags/users/data.
create role anon nologin;
create role authenticated nologin;
create schema if not exists auth;
create schema if not exists private;
create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $$
 select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.cwl_clans(
 id uuid primary key,clash_tag text not null,
 owner_user uuid not null,editor_user uuid
);
insert into public.cwl_clans values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','#99JP2RL2',
  '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','#2JGC2J8VG',
  '33333333-3333-4333-8333-333333333333',null);
create or replace function private.cwl_can_edit(p_clan uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
   select 1 from public.cwl_clans c
   where c.id=p_clan and (c.owner_user=(select auth.uid())
        or c.editor_user=(select auth.uid()))
 )
$$;
create or replace function private.cwl_is_member(p_clan uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.cwl_clans c where c.id=p_clan
    and (c.owner_user=(select auth.uid())
      or c.editor_user=(select auth.uid())
      or (select auth.uid())='44444444-4444-4444-8444-444444444444'::uuid)
 )
$$;
grant usage on schema private,auth to authenticated;
grant execute on function private.cwl_can_edit(uuid),
 private.cwl_is_member(uuid),auth.uid() to authenticated;
grant select on public.cwl_clans to authenticated;
-- Test the real historical-statistics table migrations with existing RLS.
\i supabase/migrations/20261031125500_cwl_private_attack_history_stats.sql
\i supabase/migrations/20261031133000_cwl_statistics_missed_attack_log.sql
