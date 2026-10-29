-- Existing migration exported from Supabase; do not re-apply to this project.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.cwl_clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  clash_tag text,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint cwl_clan_tag_format check (clash_tag is null or clash_tag ~ '^#[0-9A-Z]{3,15}$')
);

create table public.cwl_clan_memberships (
  clan_id uuid not null references public.cwl_clans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);
create index cwl_memberships_user on public.cwl_clan_memberships(user_id, clan_id);

create table public.cwl_clan_invites (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.cwl_clans(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  role text not null check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id),
  constraint invite_lifetime check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
create index cwl_invites_clan on public.cwl_clan_invites(clan_id, created_at desc);

create table public.cwl_cloud_profiles (
  clan_id uuid primary key references public.cwl_clans(id) on delete cascade,
  profile_json jsonb not null check (jsonb_typeof(profile_json) = 'object' and octet_length(profile_json::text) <= 5242880),
  data_version smallint not null default 9 check (data_version = 9),
  revision bigint not null default 1 check (revision >= 1),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.cwl_is_member(p_clan uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.cwl_clan_memberships m where m.clan_id = p_clan and m.user_id = (select auth.uid())) $$;
create function private.cwl_is_owner(p_clan uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.cwl_clans c where c.id = p_clan and c.owner_user_id = (select auth.uid())) $$;
create function private.cwl_can_edit(p_clan uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.cwl_clan_memberships m where m.clan_id = p_clan and m.user_id = (select auth.uid()) and m.role in ('owner','editor')) $$;
revoke all on function private.cwl_is_member(uuid), private.cwl_is_owner(uuid), private.cwl_can_edit(uuid) from public;
grant execute on function private.cwl_is_member(uuid), private.cwl_is_owner(uuid), private.cwl_can_edit(uuid) to authenticated;

create function private.cwl_bootstrap_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.cwl_clan_memberships (clan_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner');
  return new;
end;
$$;
revoke all on function private.cwl_bootstrap_owner() from public;
create trigger cwl_owner_created after insert on public.cwl_clans
  for each row execute function private.cwl_bootstrap_owner();

create function private.cwl_bump_profile_revision()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function private.cwl_bump_profile_revision() from public;
create trigger cwl_profile_revision before update on public.cwl_cloud_profiles
  for each row execute function private.cwl_bump_profile_revision();

create function public.cwl_redeem_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.cwl_clan_invites%rowtype;
  v_inserted int := 0;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_invite from public.cwl_clan_invites
   where id = p_invite_id and used_at is null and expires_at > now() for update;
  if not found then raise exception 'Invitation invalid or expired' using errcode = '22023'; end if;
  insert into public.cwl_clan_memberships (clan_id, user_id, role)
    values (v_invite.clan_id, v_user_id, v_invite.role)
    on conflict (clan_id,user_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    update public.cwl_clan_invites set used_at = now(), used_by = v_user_id where id = v_invite.id;
  end if;
  return v_invite.clan_id;
end;
$$;
revoke all on function public.cwl_redeem_invite(uuid) from public, anon;
grant execute on function public.cwl_redeem_invite(uuid) to authenticated;

alter table public.cwl_clans enable row level security;
alter table public.cwl_clan_memberships enable row level security;
alter table public.cwl_clan_invites enable row level security;
alter table public.cwl_cloud_profiles enable row level security;

create policy cwl_clans_read on public.cwl_clans for select to authenticated
  using (private.cwl_is_member(id));
create policy cwl_clans_create on public.cwl_clans for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy cwl_clans_owner_edit on public.cwl_clans for update to authenticated
  using (private.cwl_is_owner(id)) with check (private.cwl_is_owner(id));

create policy cwl_members_read on public.cwl_clan_memberships for select to authenticated
  using (private.cwl_is_member(clan_id));
create policy cwl_members_owner_edit on public.cwl_clan_memberships for update to authenticated
  using (private.cwl_is_owner(clan_id) and role <> 'owner')
  with check (private.cwl_is_owner(clan_id) and role in ('editor','viewer'));
create policy cwl_members_owner_remove on public.cwl_clan_memberships for delete to authenticated
  using (private.cwl_is_owner(clan_id) and role <> 'owner');

create policy cwl_invites_owner_read on public.cwl_clan_invites for select to authenticated
  using (private.cwl_is_owner(clan_id));
create policy cwl_invites_owner_create on public.cwl_clan_invites for insert to authenticated
  with check (private.cwl_is_owner(clan_id) and created_by = (select auth.uid()) and
              expires_at > now() and expires_at <= now() + interval '30 days');
create policy cwl_invites_owner_remove on public.cwl_clan_invites for delete to authenticated
  using (private.cwl_is_owner(clan_id));

create policy cwl_profiles_read on public.cwl_cloud_profiles for select to authenticated
  using (private.cwl_is_member(clan_id));
create policy cwl_profiles_insert on public.cwl_cloud_profiles for insert to authenticated
  with check (private.cwl_can_edit(clan_id) and updated_by = (select auth.uid()));
create policy cwl_profiles_update on public.cwl_cloud_profiles for update to authenticated
  using (private.cwl_can_edit(clan_id)) with check (private.cwl_can_edit(clan_id));

revoke all on public.cwl_clans, public.cwl_clan_memberships, public.cwl_clan_invites, public.cwl_cloud_profiles from anon, authenticated;
grant select on public.cwl_clans, public.cwl_clan_memberships, public.cwl_clan_invites, public.cwl_cloud_profiles to authenticated;
grant insert (name, clash_tag, owner_user_id) on public.cwl_clans to authenticated;
grant update (name, clash_tag) on public.cwl_clans to authenticated;
grant update (role) on public.cwl_clan_memberships to authenticated;
grant delete on public.cwl_clan_memberships to authenticated;
grant insert (clan_id, created_by, role, expires_at) on public.cwl_clan_invites to authenticated;
grant delete on public.cwl_clan_invites to authenticated;
grant insert (clan_id, profile_json) on public.cwl_cloud_profiles to authenticated;
grant update (profile_json) on public.cwl_cloud_profiles to authenticated;

alter publication supabase_realtime add table public.cwl_cloud_profiles;
