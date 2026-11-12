-- #227 / Phase 4 DRAFT only. Never deploy without collector, UAT and restore gates.
-- This exact transaction is invoked only by the verified signed service collector.
-- Depends on phase-1 observations, phase-2 preflight, phase-3 checkpoints.
-- All caller supplied values are CAS expectations, NEVER trusted profile JSON.
--
-- JSON archive player shape matches cloud-app.html normalizeArchive().
create function private.cwl_ownerless_player_snapshot(p_member jsonb,p_id text)
returns jsonb language sql immutable set search_path=''
as $fn$
  select jsonb_build_object(
    'id',p_id,
    'name',coalesce(p_member->>'name','Unbekannt'),
    'playerTag',coalesce(p_member->>'playerTag',''),
    'townHall',p_member->'townHall',
    'threeStar',coalesce(p_member->>'threeStar','unknown'),
    'fixed',coalesce(p_member->>'fixed','false')='true'
  );
$fn$;
revoke all on function private.cwl_ownerless_player_snapshot(jsonb,text)
 from PUBLIC,anon,authenticated;

create function private.cwl_ownerless_reset_member(p_member jsonb)
returns jsonb language plpgsql immutable set search_path=''
as $fn$
declare v jsonb;v_before jsonb;v_edited jsonb;v_key text;v_i int;
begin
  v:=p_member||jsonb_build_object(
    'statuses','["auto","auto","auto","auto","auto","auto","auto"]'::jsonb,
    'firstDay',null,'outFromDay',null,'targetDays',null);
  if jsonb_typeof(v->'cocBeforeDeparture')='object' then
    v_before:=v->'cocBeforeDeparture';
    foreach v_key in array array['before','automatic'] loop
      if jsonb_typeof(v_before->v_key)='object' then
        v_before:=jsonb_set(v_before,array[v_key],
          (v_before->v_key)||jsonb_build_object('targetDays',null,
           'statuses','["auto","auto","auto","auto","auto","auto","auto"]'::jsonb));
      end if;
    end loop;
    if jsonb_typeof(v_before->'edited')='object' then
      v_edited:=v_before->'edited'-'targetDays';
      for v_i in 0..6 loop
        v_edited:=v_edited-('statuses.'||v_i::text);
      end loop;
      v_before:=jsonb_set(v_before,'{edited}',v_edited);
    end if;
    v:=jsonb_set(v,'{cocBeforeDeparture}',v_before);
  end if;
  return v;
end $fn$;
revoke all on function private.cwl_ownerless_reset_member(jsonb)
 from PUBLIC,anon,authenticated;

-- Build one normal archive object; the checkpoint keeps the full original
-- even when no archived lineup can be represented in the legacy UI format.
create function private.cwl_ownerless_build_archive(
 p_profile jsonb,p_source_season text,p_source_cycle uuid,p_created_at timestamptz
) returns jsonb language plpgsql stable set search_path=''
as $fn$
declare
 v_days int:=(p_profile#>>'{config,days}')::int;
 v_locks jsonb:=p_profile->'locks';
 v_member jsonb;v_map jsonb:='{}'::jsonb;
 v_players jsonb:='{}'::jsonb;
 v_counts jsonb:='{}'::jsonb;
 v_lineups jsonb:='[]'::jsonb;
 v_snaps jsonb;v_lineup jsonb;v_lock jsonb;v_source jsonb;v_snapshot jsonb;
 v_id text;v_day int;v_used int:=0;
 v_label text;
begin
 if v_days not in (5,7) or jsonb_typeof(v_locks)<>'array'
   or jsonb_typeof(p_profile->'members')<>'array'
   or jsonb_typeof(p_profile->'archivedMembers')<>'array' then
   raise exception 'unarchivable_source_profile' using errcode='23514';
 end if;
 -- Current members take precedence over older archived member copies.
 for v_member in select value from
   jsonb_array_elements(p_profile->'archivedMembers') as x(value) loop
   if coalesce(v_member->>'id','')<>'' then
    v_map:=v_map||jsonb_build_object(v_member->>'id',v_member);
   end if;
 end loop;
 for v_member in select value from
   jsonb_array_elements(p_profile->'members') as x(value) loop
   if coalesce(v_member->>'id','')<>'' then
    v_map:=v_map||jsonb_build_object(v_member->>'id',v_member);
   end if;
 end loop;
 for v_day in 0..v_days-1 loop
   v_lock:=v_locks->v_day;
   if v_lock->>'locked'='true' then
     v_lineup:=v_lock->'lineup';
     if jsonb_typeof(v_lineup)<>'array' then
       raise exception 'locked_lineup_missing' using errcode='23514';
     end if;
     v_snaps:='{}'::jsonb;
     for v_id in select value from jsonb_array_elements_text(v_lineup) as x(value) loop
       if v_id='' or v_counts ? v_id and exists(
          select 1 from jsonb_array_elements_text(v_lineup) as y(value)
          where y.value=v_id group by y.value having count(*)>1) then
         raise exception 'duplicate_or_empty_lineup_player' using errcode='23514';
       end if;
       v_source:=coalesce(v_lock->'snapshots'->v_id,v_map->v_id);
       if jsonb_typeof(v_source) is distinct from 'object' then
         raise exception 'locked_player_snapshot_missing' using errcode='23514';
       end if;
       v_snapshot:=private.cwl_ownerless_player_snapshot(v_source,v_id);
       v_snaps:=v_snaps||jsonb_build_object(v_id,v_snapshot);
       if not(v_players ? v_id) then
         v_players:=v_players||jsonb_build_object(v_id,v_snapshot);
       end if;
       v_counts:=v_counts||jsonb_build_object(v_id,
         coalesce((v_counts->>v_id)::int,0)+1);
     end loop;
     v_lineups:=v_lineups||jsonb_build_array(jsonb_build_object(
       'day',v_day+1,'lineup',v_lineup,'snapshots',v_snaps));
     v_used:=v_used+1;
   end if;
 end loop;
 for v_member in select value from
   jsonb_array_elements(p_profile->'members') as x(value) loop
   v_id:=v_member->>'id';
   if v_id is not null and v_id<>'' and v_member->>'participating'='true'
     and not (v_players ? v_id) then
       v_players:=v_players||jsonb_build_object(v_id,
         private.cwl_ownerless_player_snapshot(v_member,v_id));
       v_counts:=v_counts||jsonb_build_object(v_id,0);
   end if;
 end loop;
 v_label:=(array['Jänner','Februar','März','April','Mai','Juni','Juli',
             'August','September','Oktober','November','Dezember'])
             [split_part(p_source_season,'-',2)::int] || ' ' ||
             split_part(p_source_season,'-',1);
 return jsonb_build_object(
   'id','a_srv_'||replace(p_source_cycle::text,'-',''),
   'label',v_label,
   'createdAt',floor(extract(epoch from p_created_at)*1000)::bigint,
   'slots',(p_profile#>>'{config,slots}')::int,
   'days',v_days,
   'playedCount',v_used,
   'complete',v_used=v_days,
   'players',(select coalesce(jsonb_agg(value order by key),'[]'::jsonb)
     from jsonb_each(v_players) as x(key,value)),
   'lineups',v_lineups,
   'counts',v_counts,
   'sourceSeason',p_source_season,
   'cwlLive',p_profile->'cwlLive'
 );
end $fn$;
revoke all on function private.cwl_ownerless_build_archive(jsonb,text,uuid,timestamptz)
 from PUBLIC,anon,authenticated;

-- Deterministic source -> new season transform; never accept a caller's
-- whole replacement profile. p_created_at is immutable checkpoint time.
create function private.cwl_ownerless_next_profile(
 p_profile jsonb,p_source_season text,p_target_wars int,
 p_source_cycle uuid,p_created_at timestamptz
) returns jsonb language plpgsql stable set search_path=''
as $fn$
declare
 v_next jsonb;v_members jsonb;v_archives jsonb;v_goals jsonb;
 v_locks jsonb;v_archive_count int;
begin
 if p_target_wars not in (5,7) or jsonb_typeof(p_profile)<>'object'
   or jsonb_typeof(p_profile->'archives')<>'array'
   or jsonb_typeof(p_profile->'members')<>'array'
   or jsonb_typeof(p_profile->'archivedMembers')<>'array' then
   raise exception 'unsafe_reset_profile_shape' using errcode='23514';
 end if;
 select count(*) into v_archive_count
 from jsonb_array_elements(p_profile->'archives') a(value)
 where a.value->>'sourceSeason'=p_source_season;
 if v_archive_count>1 then
   raise exception 'duplicate_archived_source_season' using errcode='23514';
 end if;
 v_archives:=p_profile->'archives';
 if v_archive_count=0 then
   v_archives:=v_archives||jsonb_build_array(
     private.cwl_ownerless_build_archive(p_profile,p_source_season,
       p_source_cycle,p_created_at));
 end if;
 select coalesce(jsonb_agg(private.cwl_ownerless_reset_member(m.value)
    order by m.ordinality),'[]'::jsonb)
 into v_members from jsonb_array_elements(p_profile->'members')
 with ordinality as m(value,ordinality);
 select jsonb_agg(jsonb_build_object('townHall','{}'::jsonb,
   'strength',jsonb_build_object('high',0,'medium',0,'low',0,'verylow',0))
   order by n) into v_goals from generate_series(1,7) n;
 select jsonb_agg(jsonb_build_object('locked',false,'lineup','[]'::jsonb)
   order by n) into v_locks from generate_series(1,7) n;
 v_next:=(p_profile-'cwlLive')||jsonb_build_object(
   'config',jsonb_set(p_profile->'config','{days}',to_jsonb(p_target_wars),true),
   'members',v_members,
   'archivedMembers','[]'::jsonb,
   'dayGoals',v_goals,
   'locks',v_locks,
   'archives',v_archives,
   'cwlLiveIgnoredSeason',p_source_season,
   'updatedAt',floor(extract(epoch from p_created_at)*1000)::bigint
 );
 return v_next;
end $fn$;
revoke all on function private.cwl_ownerless_next_profile(jsonb,text,int,uuid,timestamptz)
 from PUBLIC,anon,authenticated;

-- A service-role write is admitted ONLY if it is the exact deterministic
-- reset produced from the *same* old-cycle immutable checkpoint, and the
-- transaction still has the same old cycle. Normal users cannot SET ROLE
-- service_role on a PostgreSQL connection. GUCs alone NEVER authorize this.
create function private.cwl_ownerless_checked_system_write(
 p_old public.cwl_cloud_profiles,p_new public.cwl_cloud_profiles
) returns boolean language sql stable security definer set search_path=''
as $fn$
select coalesce(
  pg_catalog.current_setting('role',true)='service_role'
  and (select auth.uid()) is null
  and exists(
    select 1 from public.cwl_ownerless_cycle_checkpoints cp
    join public.cwl_plan_review_state s on s.clan_id=cp.clan_id
    where cp.clan_id=p_old.clan_id
      and p_old.clan_id=p_new.clan_id
      and cp.source_revision=p_old.revision
      and cp.source_cycle_id=s.cycle_id
      and cp.source_season=s.season
      and cp.source_profile=p_old.profile_json
      and cp.target_season>s.season
      and cp.source_profile_sha256=
        encode(pg_catalog.sha256(
          pg_catalog.convert_to(p_old.profile_json::text,'UTF8')),'hex')
      and p_new.profile_json=private.cwl_ownerless_next_profile(
        p_old.profile_json,cp.source_season,
        (select o.war_count::int from public.cwl_verified_league_observations o
          where o.clan_id=cp.clan_id and o.season=cp.target_season),
        cp.source_cycle_id,cp.created_at)
   ),false
);
$fn$;
revoke all on function private.cwl_ownerless_checked_system_write(
 public.cwl_cloud_profiles,public.cwl_cloud_profiles)
 from PUBLIC,anon,authenticated;

-- Surgical changes ONLY to two existing triggers. Existing owner/editor
-- checks remain unchanged in the normal path. Do not globally bypass RLS.
create or replace function private.cwl_plan_write_guard()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if tg_op='UPDATE' and
     private.cwl_ownerless_checked_system_write(old,new) then
    return new;
  end if;
  perform 1 from public.cwl_plan_review_state
   where clan_id=new.clan_id for share;
  if not private.cwl_plan_can_write(new.clan_id) then
    raise exception 'plan_locked' using errcode='42501';
  end if;
  return new;
end $fn$;

create or replace function private.cwl_bump_profile_revision()
returns trigger language plpgsql set search_path=''
as $fn$
begin
  new.revision:=old.revision+1;
  new.updated_at:=now();
  if auth.uid() is null then
    if not private.cwl_ownerless_checked_system_write(old,new) then
      raise exception 'untrusted_system_profile_write' using errcode='42501';
    end if;
    -- Retain the previous HUMAN updater rather than impersonating an owner.
    -- Dedicated transition audit below identifies this as a SYSTEM update.
    new.updated_by:=old.updated_by;
  else
    new.updated_by:=auth.uid();
  end if;
  return new;
end $fn$;

-- An append-only, explicitly SYSTEM-attributed audit of the atomic commit.
create table public.cwl_ownerless_cycle_transitions (
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 source_cycle_id uuid not null,
 source_revision bigint not null,
 source_season text not null,
 target_season text not null,
 target_cycle_id uuid not null,
 target_revision bigint not null,
 checkpoint_sha256 text not null check (checkpoint_sha256 ~ '^[0-9a-f]{64}$'),
 source_played_days int not null check (source_played_days between 0 and 7),
 source_unconfirmed_days int not null check (source_unconfirmed_days between 0 and 7),
 origin text not null default 'signed_collector'
   check (origin='signed_collector'),
 applied_at timestamptz not null default now(),
 primary key(clan_id,source_cycle_id),
 foreign key(clan_id,source_cycle_id,source_revision)
  references public.cwl_ownerless_cycle_checkpoints
   (clan_id,source_cycle_id,source_revision)
);
alter table public.cwl_ownerless_cycle_transitions enable row level security;
revoke all on public.cwl_ownerless_cycle_transitions
 from PUBLIC,anon,authenticated,service_role;
grant select,insert on public.cwl_ownerless_cycle_transitions to service_role;

create or replace function public.cwl_ownerless_atomic_rollover(
 p_clan uuid,p_expected_cycle uuid,p_expected_revision bigint,
 p_target_season text
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare
 v_state public.cwl_plan_review_state%rowtype;
 v_profile public.cwl_cloud_profiles%rowtype;
 v_pref jsonb;v_cp jsonb;v_source public.cwl_ownerless_cycle_checkpoints%rowtype;
 v_done public.cwl_ownerless_cycle_transitions%rowtype;
 v_new_profile jsonb;v_new_cycle uuid;v_target_wars int;v_next_rev bigint;
begin
 if p_clan is null or p_expected_cycle is null or
   p_expected_revision is null or p_expected_revision<1 or
   coalesce(p_target_season,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
   return jsonb_build_object('applied',false,'reason','invalid_expectations');
 end if;
 -- Serialize all competing cron runs and normal Owner cycle changes.
 select * into v_state from public.cwl_plan_review_state
   where clan_id=p_clan for update;
 if not found then
   return jsonb_build_object('applied',false,'reason','review_cycle_missing');
 end if;
 -- Retry after a committed transition is a no-op even if the user has
 -- subsequently edited the new plan. Never rerun the old reset.
 if v_state.cycle_id is distinct from p_expected_cycle then
   select * into v_done from public.cwl_ownerless_cycle_transitions
     where clan_id=p_clan and source_cycle_id=p_expected_cycle
       and source_revision=p_expected_revision
       and target_season=p_target_season;
   if found and v_state.cycle_id=v_done.target_cycle_id
       and v_state.season=v_done.target_season then
     return jsonb_build_object('applied',true,'created',false,
       'reason','already_applied','source_cycle_id',p_expected_cycle,
       'target_cycle_id',v_done.target_cycle_id,
       'target_season',v_done.target_season);
   end if;
   return jsonb_build_object('applied',false,'reason','stale_cycle');
 end if;
 select * into v_profile from public.cwl_cloud_profiles
   where clan_id=p_clan for update;
 if not found or v_profile.revision is distinct from p_expected_revision then
   return jsonb_build_object('applied',false,'reason','stale_profile_revision');
 end if;
 v_pref:=public.cwl_ownerless_cycle_preflight(p_clan);
 if v_pref->>'candidate' is distinct from 'true' then
   return jsonb_build_object('applied',false,
     'reason',coalesce(v_pref->>'reason','preflight_rejected'));
 end if;
 if v_pref->>'source_cycle_id' is distinct from p_expected_cycle::text
   or (v_pref->>'source_revision')::bigint is distinct from p_expected_revision
   or v_pref->>'target_season' is distinct from p_target_season then
   return jsonb_build_object('applied',false,'reason','stale_preflight');
 end if;
 v_target_wars:=(v_pref->>'target_war_count')::int;

 -- Same transaction: original full-JSON checkpoint first, then exact new
 -- profile, stale suggestions, new review cycle, then explicit SYSTEM audit.
 -- Any thrown error aborts ALL effects (including the checkpoint).
 v_cp:=public.cwl_ownerless_cycle_checkpoint(
    p_clan,p_expected_cycle,p_expected_revision,p_target_season);
 if v_cp->>'saved' is distinct from 'true' then
   raise exception 'atomic_checkpoint_rejected: %',v_cp->>'reason'
     using errcode='40001';
 end if;
 select * into v_source from public.cwl_ownerless_cycle_checkpoints
  where clan_id=p_clan and source_cycle_id=p_expected_cycle
    and source_revision=p_expected_revision;
 v_new_profile:=private.cwl_ownerless_next_profile(
  v_profile.profile_json,v_state.season,v_target_wars,
  v_state.cycle_id,v_source.created_at);
 update public.cwl_cloud_profiles
   set profile_json=v_new_profile
   where clan_id=p_clan and revision=p_expected_revision
   returning revision into v_next_rev;
 if not found or v_next_rev is distinct from p_expected_revision+1 then
   raise exception 'atomic_profile_write_conflict' using errcode='40001';
 end if;

 update public.cwl_plan_suggestions
   set status='stale',decided_at=now(),decided_by=null
   where clan_id=p_clan and cycle_id=v_state.cycle_id
    and status='pending';

 v_new_cycle:=gen_random_uuid();
 update public.cwl_plan_review_state set
   cycle_id=v_new_cycle,season=p_target_season,
   locked=false,locked_by=null,locked_at=null,updated_at=now()
 where clan_id=p_clan and cycle_id=p_expected_cycle;
 if not found then
   raise exception 'atomic_review_cycle_conflict' using errcode='40001';
 end if;

 insert into public.cwl_ownerless_cycle_transitions
  (clan_id,source_cycle_id,source_revision,source_season,target_season,
   target_cycle_id,target_revision,checkpoint_sha256,
   source_played_days,source_unconfirmed_days)
 values (p_clan,p_expected_cycle,p_expected_revision,
  v_state.season,p_target_season,v_new_cycle,v_next_rev,
  v_source.source_profile_sha256,
  (v_pref->>'source_locked_clash_days')::int,
  (v_pref->>'source_unconfirmed_days')::int);
 return jsonb_build_object('applied',true,'created',true,
   'reason','atomic_rollover_applied',
   'source_season',v_state.season,'target_season',p_target_season,
   'source_cycle_id',p_expected_cycle,'target_cycle_id',v_new_cycle,
   'source_revision',p_expected_revision,'target_revision',v_next_rev,
   'source_played_days',(v_pref->>'source_locked_clash_days')::int,
   'source_unconfirmed_days',(v_pref->>'source_unconfirmed_days')::int);
end $fn$;
revoke all on function public.cwl_ownerless_atomic_rollover(uuid,uuid,bigint,text)
 from PUBLIC,anon,authenticated;
grant execute on function public.cwl_ownerless_atomic_rollover(uuid,uuid,bigint,text)
 to service_role;
