-- #227 Phase 2 / READ ONLY / DRAFT: inspect an official new CWL group
-- before ANY automatic season rollover. Intentionally not a live migration.
--
-- This is a service-role-only, SECURITY INVOKER RPC for the signed collector
-- to inspect. It makes NO changes and grants NO authority to advance a cycle.
-- The future mutation RPC MUST revalidate all predicates under row locks.
create or replace function public.cwl_ownerless_cycle_preflight(p_clan uuid)
returns jsonb
language plpgsql stable security invoker set search_path=''
as $fn$
declare
  v_clan public.cwl_clans%rowtype;
  v_profile public.cwl_cloud_profiles%rowtype;
  v_state public.cwl_plan_review_state%rowtype;
  v_observation public.cwl_verified_league_observations%rowtype;
  v_live jsonb;
  v_locks jsonb;
  v_archives jsonb;
  v_days integer;
  v_locked integer;
  v_bad_locks integer;
  v_archives_count integer;
  v_result jsonb;
begin
  -- All errors are coarse-grained, not profile dumps. No fallback based on
  -- wall clock, old browser state or group_state='ended'.
  if p_clan is null then
    return jsonb_build_object('candidate',false,'reason','clan_missing');
  end if;
  select * into v_clan from public.cwl_clans where id=p_clan;
  if not found or coalesce(v_clan.clash_tag,'') !~
      '^#[0289PYLQGRJCUV]{3,15}$' then
    return jsonb_build_object('candidate',false,'reason','linked_clan_missing');
  end if;
  select * into v_state from public.cwl_plan_review_state where clan_id=p_clan;
  if not found or coalesce(v_state.season,'') !~
      '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    return jsonb_build_object('candidate',false,'reason','review_cycle_missing');
  end if;
  select * into v_profile from public.cwl_cloud_profiles where clan_id=p_clan;
  if not found or jsonb_typeof(v_profile.profile_json) is distinct from 'object'
      or v_profile.revision<1 then
    return jsonb_build_object('candidate',false,'reason','profile_missing');
  end if;
  -- The source is a recent server-verified Supercell group recorded in the
  -- separate app tenant. Never consult another app-clan's observation.
  select * into v_observation
    from public.cwl_verified_league_observations
    where clan_id=p_clan and clan_tag=v_clan.clash_tag
      and group_tags ? v_clan.clash_tag
    order by season desc limit 1;
  if not found or v_observation.season<=v_state.season then
    return jsonb_build_object('candidate',false,'reason','no_new_verified_season');
  end if;
  if v_observation.last_seen_at < now()-interval '36 hours'
     or v_observation.last_seen_at>now()+interval '5 minutes'
     or v_observation.war_count not in (5,7)
     or v_observation.rounds_count not in (0,v_observation.war_count) then
    return jsonb_build_object('candidate',false,'reason','season_evidence_stale');
  end if;
  v_live:=v_profile.profile_json->'cwlLive';
  v_locks:=v_profile.profile_json->'locks';
  v_archives:=v_profile.profile_json->'archives';
  if jsonb_typeof(v_locks) is distinct from 'array' or
     jsonb_array_length(v_locks)<>7 or
     jsonb_typeof(v_archives) is distinct from 'array' then
    return jsonb_build_object('candidate',false,'reason','profile_shape_unsafe');
  end if;
  if jsonb_typeof(v_live) is distinct from 'object' or
     v_live->>'season' is distinct from v_state.season or
     upper(coalesce(v_live->>'clanTag','')) is distinct from v_clan.clash_tag or
     jsonb_typeof(v_live->'rounds') is distinct from 'array' then
    return jsonb_build_object('candidate',false,'reason','source_season_unverified');
  end if;
  if coalesce(v_profile.profile_json#>>'{config,days}','') !~ '^[57]$' then
    return jsonb_build_object('candidate',false,'reason','source_format_unsafe');
  end if;
  v_days:=(v_profile.profile_json#>>'{config,days}')::integer;
  if coalesce(v_live->>'warCount',case when v_days=7 then '7' else '' end)
       is distinct from v_days::text or
     jsonb_array_length(v_live->'rounds')<v_days then
    return jsonb_build_object('candidate',false,'reason','source_format_unsafe');
  end if;
  -- Never assume that an inWar / missing day is warEnded. A lock counts
  -- only when it is an actual old-cycle Clash lock with matching day+tag.
  select count(*) filter (where l.value->>'locked'='true'),
    count(*) filter (where
      (l.ordinality>v_days and l.value->>'locked'='true') or
      (l.value->>'locked'='true' and (
        l.value->>'source' is distinct from 'coc-api' or
        l.value->>'season' is distinct from v_state.season or
        l.value->>'warTag' is distinct from v_live->'rounds'->(l.ordinality::int-1)->>'warTag'
      ))
    )
    into v_locked,v_bad_locks
    from jsonb_array_elements(v_locks) with ordinality as l(value,ordinality);
  if v_bad_locks>0 then
    return jsonb_build_object('candidate',false,'reason','unsafe_locked_day');
  end if;
  select count(*) into v_archives_count
    from jsonb_array_elements(v_archives) as a(value)
    where a.value->>'sourceSeason'=v_state.season;
  if v_archives_count>1 then
    return jsonb_build_object('candidate',false,'reason','duplicate_source_archive');
  end if;
  if v_archives_count=1 and exists(
    select 1 from jsonb_array_elements(v_archives) as a(value)
    where a.value->>'sourceSeason'=v_state.season and (
      jsonb_typeof(a.value->'lineups') is distinct from 'array' or
      a.value->>'id' is null
    )
  ) then
    return jsonb_build_object('candidate',false,'reason','source_archive_invalid');
  end if;

  -- "candidate" is read-only and NOT permission to reset. Future server
  -- RPC must acquire row locks, snapshot the full old profile atomically,
  -- preserve missing days, and use a compare-and-swap revision/cycle.
  return jsonb_build_object(
    'candidate',true,
    'reason','atomic_archive_and_cycle_transaction_required',
    'source_season',v_state.season,
    'target_season',v_observation.season,
    'source_cycle_id',v_state.cycle_id,
    'source_revision',v_profile.revision,
    'source_war_count',v_days,
    'target_war_count',v_observation.war_count,
    'source_locked_clash_days',v_locked,
    'source_unconfirmed_days',v_days-v_locked,
    'source_archive_exists',v_archives_count=1
  );
end;
$fn$;
-- PostgreSQL grants PUBLIC EXECUTE on newly created functions by default.
-- Fully remove inherited/browser privilege and grant only the service role.
revoke all on function public.cwl_ownerless_cycle_preflight(uuid)
  from public,anon,authenticated;
grant execute on function public.cwl_ownerless_cycle_preflight(uuid)
  to service_role;
