-- Release candidate; apply only after rollback fixtures and review.
-- The service identity must be the actual verified collector, not an owner UID.
create or replace function private.cwl_plan_write_guard()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
 perform 1 from public.cwl_plan_review_state where clan_id=new.clan_id for share;
 if tg_op='UPDATE' and auth.uid() is null and auth.jwt()->>'role'='service_role'
   and current_setting('cwl.atomic_rollover_clan',true)=new.clan_id::text then
   return new;
 end if;
 if not private.cwl_plan_can_write(new.clan_id) then
   raise exception 'plan_locked' using errcode='42501';
 end if;
 return new;
end;
$$;
create or replace function private.cwl_bump_profile_revision()
returns trigger language plpgsql set search_path to '' as $$
begin
 new.revision:=old.revision+1;
 new.updated_at:=now();
 -- updated_by remains the last human editor; actor_id in the normal audit
 -- is NULL for the system action. Never impersonate the clan owner.
 if auth.uid() is null and auth.jwt()->>'role'='service_role'
   and current_setting('cwl.atomic_rollover_clan',true)=new.clan_id::text then
   new.updated_by:=old.updated_by;
 else
   new.updated_by:=auth.uid();
 end if;
 return new;
end;
$$;

create or replace function public.cwl_collector_rollover(
 p_clan uuid,p_expected_revision bigint,p_old_season text,p_group jsonb,p_next jsonb
) returns boolean language plpgsql security invoker set search_path to '' as $$
declare
 v_tag text; v_season text; v_count int;
 v_profile public.cwl_cloud_profiles%rowtype;
 v_review public.cwl_plan_review_state%rowtype;
 v_has_review boolean; v_old_archives jsonb; v_next_archives jsonb;
 v_old_n int; v_new_n int; v_old_season_n int; v_next_season_n int;
 v_revision bigint; v_archive jsonb; v_locked int;
begin
 if current_user<>'service_role' or auth.uid() is not null or
   coalesce(auth.jwt()->>'role','')<>'service_role' then
   raise exception 'collector_only' using errcode='42501';
 end if;
 if p_clan is null or p_expected_revision is null or p_old_season is null or
    p_old_season !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or
    jsonb_typeof(p_group) is distinct from 'object' or
    jsonb_typeof(p_next) is distinct from 'object' then return false;end if;
 v_season:=p_group->>'season';
 if v_season is distinct from to_char(now() at time zone 'UTC','YYYY-MM') or
   p_old_season>=v_season or coalesce(p_group->>'state','') not in ('preparation','inWar') or
   coalesce(p_group->>'warCount','') not in ('5','7') or
   jsonb_typeof(p_group->'clanTags') is distinct from 'array' then return false;end if;
 v_count:=(p_group->>'warCount')::int;
 if jsonb_array_length(p_group->'clanTags')<>v_count+1 or
    (select count(distinct value) from jsonb_array_elements_text(p_group->'clanTags'))<>v_count+1 or
    exists(select 1 from jsonb_array_elements_text(p_group->'clanTags') t(value)
      where value is null or value !~ '^#[0289PYLQGRJCUV]{3,15}$') then return false;end if;
 select upper(clash_tag) into v_tag from public.cwl_clans where id=p_clan for share;
 if not found or v_tag is null or p_group->>'clanTag' is distinct from v_tag or
    not (p_group->'clanTags' ? v_tag) then return false;end if;
 -- Same lock order as ordinary profile update -> review guard. Concurrent
 -- suggestion/cycle transactions can retry on PostgreSQL deadlock rollback.
 select * into v_profile from public.cwl_cloud_profiles where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision or
    v_profile.profile_json->'cwlLive'->>'season' is distinct from p_old_season or
    v_profile.profile_json->'cwlLive'->>'clanTag' is distinct from v_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_old_season then return false;end if;
 select * into v_review from public.cwl_plan_review_state where clan_id=p_clan for update;
 v_has_review:=found;
 -- Do not overwrite an already opened new-season cycle (including an
 -- interrupted legacy client). The existing owner path can complete it.
 if v_has_review and v_review.season is distinct from p_old_season then return false;end if;
 if p_next->'cwlLive' is distinct from jsonb_build_object('season',v_season,'clanTag',v_tag,'rounds','[]'::jsonb,'warCount',v_count) or
    p_next->>'cwlLiveIgnoredSeason' is distinct from p_old_season or
    p_next->'config' is distinct from jsonb_set(v_profile.profile_json->'config','{days}',to_jsonb(v_count)) or
    p_next->'archivedMembers' is distinct from '[]'::jsonb or
    p_next->'locks' is distinct from (select jsonb_agg('{"locked":false,"lineup":[]}'::jsonb) from generate_series(1,7)) or
    p_next->'dayGoals' is distinct from (select jsonb_agg('{"townHall":{},"strength":{"high":0,"medium":0,"low":0,"verylow":0}}'::jsonb) from generate_series(1,7)) or
    jsonb_typeof(p_next->'members') is distinct from 'array' then return false;end if;
 if exists(select 1 from jsonb_array_elements(p_next->'members') m where
    m->'statuses' is distinct from (select jsonb_agg('auto'::text) from generate_series(1,7)) or
    m->'firstDay' is distinct from 'null'::jsonb or m->'outFromDay' is distinct from 'null'::jsonb or
    m->'targetDays' is distinct from 'null'::jsonb) then return false;end if;
 -- All unrelated profile fields remain byte-for-byte identical as JSONB.
 if (p_next - array['cwlLive','cwlLiveIgnoredSeason','config','archivedMembers','locks','dayGoals','members','archives']) is distinct from
    (v_profile.profile_json - array['cwlLive','cwlLiveIgnoredSeason','config','archivedMembers','locks','dayGoals','members','archives'])
 then return false;end if;
 if (select jsonb_agg(value - array['statuses','firstDay','outFromDay','targetDays','cocBeforeDeparture'] order by ord)
      from jsonb_array_elements(p_next->'members') with ordinality t(value,ord)) is distinct from
    (select jsonb_agg(value - array['statuses','firstDay','outFromDay','targetDays','cocBeforeDeparture'] order by ord)
      from jsonb_array_elements(v_profile.profile_json->'members') with ordinality t(value,ord))
 then return false;end if;
 v_old_archives:=v_profile.profile_json->'archives';v_next_archives:=p_next->'archives';
 if jsonb_typeof(v_old_archives) is distinct from 'array' or jsonb_typeof(v_next_archives) is distinct from 'array'
 then return false;end if;
 v_old_n:=jsonb_array_length(v_old_archives);v_new_n:=jsonb_array_length(v_next_archives);
 select count(*) into v_old_season_n from jsonb_array_elements(v_old_archives) a where a->>'sourceSeason'=p_old_season;
 select count(*) into v_next_season_n from jsonb_array_elements(v_next_archives) a where a->>'sourceSeason'=p_old_season;
 if v_old_season_n>1 or v_next_season_n<>1 or v_new_n<>v_old_n+(1-v_old_season_n) or
    exists(select 1 from generate_series(0,v_old_n-1) i where v_old_archives->i is distinct from v_next_archives->i)
 then return false;end if;
 if v_old_season_n=0 and v_next_archives->v_old_n->'cwlLive' is distinct from v_profile.profile_json->'cwlLive'
 then return false;end if;
 select value into v_archive from jsonb_array_elements(v_next_archives) where value->>'sourceSeason'=p_old_season;
 if jsonb_typeof(v_profile.profile_json->'locks') is distinct from 'array' or
    jsonb_typeof(v_archive->'lineups') is distinct from 'array' then return false;end if;
 select count(*) into v_locked from jsonb_array_elements(v_profile.profile_json->'locks') l where l->>'locked'='true';
 if v_archive->>'days' is distinct from v_profile.profile_json->'config'->>'days' or
    v_archive->>'slots' is distinct from v_profile.profile_json->'config'->>'slots' or
    v_archive->>'playedCount' is distinct from v_locked::text or
    v_archive->>'complete' is distinct from (v_locked::text=v_profile.profile_json->'config'->>'days')::text or
    jsonb_array_length(v_archive->'lineups')<>v_locked or
    exists(select 1 from jsonb_array_elements(v_profile.profile_json->'locks') with ordinality l(value,ord)
     where l.value->>'locked'='true' and not exists(select 1 from jsonb_array_elements(v_archive->'lineups') a
       where a->>'day'=l.ord::text and a->'lineup'=l.value->'lineup')) then return false;end if;
 -- Explicit recovery point, even when the regular 2h snapshot throttle
 -- would not have captured this exact revision.
 insert into public.cwl_profile_snapshots(clan_id,revision,profile_json)
 values(p_clan,v_profile.revision,v_profile.profile_json) on conflict(clan_id,revision) do nothing;
 if v_has_review then
  update public.cwl_plan_suggestions set status='stale',decided_at=now(),decided_by=null
   where clan_id=p_clan and cycle_id=v_review.cycle_id and status='pending';
  update public.cwl_plan_review_state set season=v_season,cycle_id=gen_random_uuid(),
   locked=false,locked_by=null,locked_at=null,updated_at=now() where clan_id=p_clan;
 else
  insert into public.cwl_plan_review_state(clan_id,season,locked) values(p_clan,v_season,false);
 end if;
 perform set_config('cwl.atomic_rollover_clan',p_clan::text,true);
 update public.cwl_cloud_profiles set profile_json=p_next where clan_id=p_clan and revision=p_expected_revision
 returning revision into v_revision;
 if not found then raise exception 'rollover_revision_conflict' using errcode='40001';end if;
 perform set_config('cwl.atomic_rollover_clan','',true);
 update public.cwl_change_events set details=details||jsonb_build_object('system_action','cwl_season_rollover',
    'old_season',p_old_season,'new_season',v_season)
 where clan_id=p_clan and revision=v_revision and actor_id is null and event_type='profile_updated';
 return true;
end;
$$;
revoke all on function public.cwl_collector_rollover(uuid,bigint,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.cwl_collector_rollover(uuid,bigint,text,jsonb,jsonb) to service_role;
