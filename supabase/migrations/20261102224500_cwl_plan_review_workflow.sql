-- Owner-controlled approval of a CWL plan; editor suggestions cannot update a locked profile.
-- The plan approval is separate from the existing per-war 'played' locks.
create table public.cwl_plan_review_state (
 clan_id uuid primary key references public.cwl_clans(id) on delete cascade,
 cycle_id uuid not null default gen_random_uuid(),
 season text not null default to_char(now() at time zone 'UTC','YYYY-MM'),
 locked boolean not null default false,
 locked_by uuid,
 locked_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.cwl_plan_suggestions (
 id uuid primary key default gen_random_uuid(),
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 cycle_id uuid not null,
 author_id uuid not null,
 base_revision bigint not null,
 suggested_profile jsonb not null,
 status text not null default 'pending' check(status in ('pending','accepted','rejected','stale','withdrawn')),
 submitted_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid
);
create index cwl_plan_suggestions_by_clan on public.cwl_plan_suggestions (clan_id,cycle_id,status,submitted_at desc);
alter table public.cwl_plan_review_state enable row level security;
alter table public.cwl_plan_suggestions enable row level security;
revoke all on public.cwl_plan_review_state from anon,authenticated;
revoke all on public.cwl_plan_suggestions from anon,authenticated;
grant select on public.cwl_plan_review_state, public.cwl_plan_suggestions to authenticated;
create policy cwl_plan_review_read on public.cwl_plan_review_state
 for select to authenticated using (private.cwl_is_member(clan_id));
create policy cwl_plan_suggestions_read on public.cwl_plan_suggestions
 for select to authenticated using (private.cwl_is_member(clan_id));

create or replace function private.cwl_plan_is_locked(p_clan uuid)
 returns boolean language sql stable security definer set search_path=''
 as $fn$select coalesce((select s.locked and s.season=to_char(now() at time zone 'UTC','YYYY-MM')
 from public.cwl_plan_review_state s where s.clan_id=p_clan),false)$fn$;
revoke all on function private.cwl_plan_is_locked(uuid) from public;
grant execute on function private.cwl_plan_is_locked(uuid) to authenticated;

create or replace function private.cwl_plan_can_write(p_clan uuid)
 returns boolean language sql stable security definer set search_path=''
 as $fn$select private.cwl_is_owner(p_clan) or
 (private.cwl_can_edit(p_clan) and not private.cwl_plan_is_locked(p_clan))$fn$;
revoke all on function private.cwl_plan_can_write(uuid) from public;
grant execute on function private.cwl_plan_can_write(uuid) to authenticated;

drop policy if exists cwl_profiles_insert on public.cwl_cloud_profiles;
drop policy if exists cwl_profiles_update on public.cwl_cloud_profiles;
create policy cwl_profiles_insert on public.cwl_cloud_profiles
 for insert to authenticated with check (private.cwl_plan_can_write(clan_id) and updated_by=(select auth.uid()));
create policy cwl_profiles_update on public.cwl_cloud_profiles
 for update to authenticated using (private.cwl_plan_can_write(clan_id))
 with check (private.cwl_plan_can_write(clan_id));

-- Serialize an editor profile write against the owner locking the plan.
create function private.cwl_plan_write_guard()
 returns trigger language plpgsql security definer set search_path=''
 as $fn$
 begin
   perform 1 from public.cwl_plan_review_state where clan_id=new.clan_id for share;
   if not private.cwl_plan_can_write(new.clan_id) then
     raise exception 'plan_locked' using errcode='42501';
   end if;
   return new;
 end;
 $fn$;
revoke all on function private.cwl_plan_write_guard() from public;
create trigger cwl_plan_guard before insert or update of profile_json on public.cwl_cloud_profiles
 for each row execute function private.cwl_plan_write_guard();

create function public.cwl_set_plan_lock(p_clan uuid,p_locked boolean,p_new_cycle boolean default false)
 returns jsonb language plpgsql security definer set search_path=''
 as $fn$
 declare v_state public.cwl_plan_review_state;v_season text:=to_char(now() at time zone 'UTC','YYYY-MM');
 begin
  if auth.uid() is null or not private.cwl_is_owner(p_clan) then raise exception 'owner_only' using errcode='42501';end if;
  insert into public.cwl_plan_review_state(clan_id,season,locked) values(p_clan,v_season,false)
   on conflict(clan_id) do nothing;
  select * into v_state from public.cwl_plan_review_state where clan_id=p_clan for update;
  if p_new_cycle or v_state.season<>v_season then
    update public.cwl_plan_suggestions set status='stale',decided_at=now(),decided_by=auth.uid()
      where clan_id=p_clan and status='pending';
    update public.cwl_plan_review_state
      set cycle_id=gen_random_uuid(),season=v_season,locked=case when p_new_cycle then false else p_locked end,
       locked_by=case when p_new_cycle or not p_locked then null else auth.uid() end,
       locked_at=case when p_new_cycle or not p_locked then null else now() end,updated_at=now()
      where clan_id=p_clan returning * into v_state;
  else
    update public.cwl_plan_review_state
      set locked=p_locked,locked_by=case when p_locked then auth.uid() else null end,
       locked_at=case when p_locked then now() else null end,updated_at=now()
      where clan_id=p_clan returning * into v_state;
    if not p_locked then
      update public.cwl_plan_suggestions set status='stale',decided_at=now(),decided_by=auth.uid()
        where clan_id=p_clan and status='pending';
    end if;
  end if;
  return jsonb_build_object('cycle_id',v_state.cycle_id,'season',v_state.season,'locked',v_state.locked);
 end;
 $fn$;

create function public.cwl_submit_plan_suggestion(p_clan uuid,p_base_revision bigint,p_profile jsonb)
 returns uuid language plpgsql security definer set search_path=''
 as $fn$
 declare v_state public.cwl_plan_review_state;v_profile public.cwl_cloud_profiles;v_id uuid;
 begin
  if auth.uid() is null or not exists(select 1 from public.cwl_clan_memberships
    where clan_id=p_clan and user_id=auth.uid() and role='editor') then
     raise exception 'editor_only' using errcode='42501';end if;
  select * into v_state from public.cwl_plan_review_state where clan_id=p_clan for share;
  if v_state.clan_id is null or not v_state.locked or v_state.season<>to_char(now() at time zone 'UTC','YYYY-MM')
    then raise exception 'plan_not_locked';end if;
  select * into v_profile from public.cwl_cloud_profiles where clan_id=p_clan for share;
  if v_profile.revision is null or v_profile.revision<>p_base_revision then raise exception 'stale_revision';end if;
  if jsonb_typeof(p_profile)<>'object' or octet_length(p_profile::text)>300000 or
      jsonb_typeof(p_profile->'members')<>'array' or
      p_profile->'id' is distinct from v_profile.profile_json->'id' or
      p_profile->'locks' is distinct from v_profile.profile_json->'locks' or
      p_profile->'archives' is distinct from v_profile.profile_json->'archives' or
      p_profile->'archivedMembers' is distinct from v_profile.profile_json->'archivedMembers' then
    raise exception 'invalid_plan_suggestion';
  end if;
  insert into public.cwl_plan_suggestions(clan_id,cycle_id,author_id,base_revision,suggested_profile)
   values(p_clan,v_state.cycle_id,auth.uid(),p_base_revision,p_profile) returning id into v_id;
  return v_id;
 end;
 $fn$;

create function public.cwl_resolve_plan_suggestion(p_suggestion uuid,p_accept boolean)
 returns jsonb language plpgsql security definer set search_path=''
 as $fn$
 declare v_s public.cwl_plan_suggestions;v_state public.cwl_plan_review_state;v_profile public.cwl_cloud_profiles;
 begin
  select * into v_s from public.cwl_plan_suggestions where id=p_suggestion;
  if v_s.id is null or auth.uid() is null or not private.cwl_is_owner(v_s.clan_id) then
   raise exception 'owner_only' using errcode='42501';end if;
  -- Acquire locks in the same order as plan locking: state, suggestion, profile.
  select * into v_state from public.cwl_plan_review_state where clan_id=v_s.clan_id for share;
  select * into v_s from public.cwl_plan_suggestions where id=p_suggestion for update;
  if v_s.status<>'pending' then raise exception 'suggestion_already_decided';end if;
  if not v_state.locked or v_state.cycle_id<>v_s.cycle_id or
     v_state.season<>to_char(now() at time zone 'UTC','YYYY-MM') then raise exception 'suggestion_outdated';end if;
  if p_accept then
    select * into v_profile from public.cwl_cloud_profiles where clan_id=v_s.clan_id for update;
    if v_profile.revision<>v_s.base_revision then raise exception 'stale_revision';end if;
    if v_s.suggested_profile->'locks' is distinct from v_profile.profile_json->'locks' or
      v_s.suggested_profile->'archives' is distinct from v_profile.profile_json->'archives' or
      v_s.suggested_profile->'archivedMembers' is distinct from v_profile.profile_json->'archivedMembers' then
      raise exception 'played_days_changed';end if;
    update public.cwl_cloud_profiles
     set profile_json=v_s.suggested_profile where clan_id=v_s.clan_id;
  end if;
  update public.cwl_plan_suggestions set status=case when p_accept then 'accepted' else 'rejected' end,
    decided_at=now(),decided_by=auth.uid() where id=p_suggestion;
  return jsonb_build_object('status',case when p_accept then 'accepted' else 'rejected' end);
 end;
 $fn$;

create function public.cwl_withdraw_plan_suggestion(p_suggestion uuid)
 returns void language plpgsql security definer set search_path=''
 as $fn$
 begin
  update public.cwl_plan_suggestions set status='withdrawn',decided_at=now()
  where id=p_suggestion and status='pending' and author_id=auth.uid() and exists
    (select 1 from public.cwl_clan_memberships m where m.clan_id=cwl_plan_suggestions.clan_id
      and m.user_id=auth.uid() and m.role='editor');
  if not found then raise exception 'suggestion_not_withdrawable';end if;
 end;
 $fn$;
revoke all on function public.cwl_set_plan_lock(uuid,boolean,boolean) from public,anon;
revoke all on function public.cwl_submit_plan_suggestion(uuid,bigint,jsonb) from public,anon;
revoke all on function public.cwl_resolve_plan_suggestion(uuid,boolean) from public,anon;
revoke all on function public.cwl_withdraw_plan_suggestion(uuid) from public,anon;
grant execute on function public.cwl_set_plan_lock(uuid,boolean,boolean) to authenticated;
grant execute on function public.cwl_submit_plan_suggestion(uuid,bigint,jsonb) to authenticated;
grant execute on function public.cwl_resolve_plan_suggestion(uuid,boolean) to authenticated;
grant execute on function public.cwl_withdraw_plan_suggestion(uuid) to authenticated;
