-- #269: isolated local-Supabase Auth integration fixture.
-- Run ONLY against Supabase CLI local Postgres, NEVER hosted production.
-- Real GoTrue auth.users and auth.uid() are installed by 'supabase start'.
create schema if not exists private;

create table public.cwl_clans (
  id uuid primary key,
  clash_tag text not null unique
);
create table public.cwl_clan_memberships (
  clan_id uuid not null references public.cwl_clans(id),
  user_id uuid not null references auth.users(id),
  role text not null check(role in ('owner','editor','viewer')),
  primary key(clan_id,user_id)
);
insert into public.cwl_clans(id,clash_tag) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','#99JP2RL2'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','#2JGC2J8VG');

create function private.cwl_is_member(p_clan uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.cwl_clan_memberships m
    where m.clan_id=p_clan and m.user_id=(select auth.uid())
  )
$$;
create function private.cwl_can_edit(p_clan uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.cwl_clan_memberships m
    where m.clan_id=p_clan and m.user_id=(select auth.uid())
      and m.role in ('owner','editor')
  )
$$;

alter table public.cwl_clans enable row level security;
alter table public.cwl_clan_memberships enable row level security;
create policy local_clans_view on public.cwl_clans for select
 to authenticated using(private.cwl_is_member(id));
create policy local_membership_view on public.cwl_clan_memberships for select
 to authenticated using(user_id=(select auth.uid()));

revoke all on public.cwl_clans,public.cwl_clan_memberships from public,anon;
grant select on public.cwl_clans to authenticated;

revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.cwl_is_member(uuid) to authenticated;
grant execute on function private.cwl_can_edit(uuid) to authenticated;
