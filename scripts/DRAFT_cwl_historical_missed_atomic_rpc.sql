-- DRAFT ONLY · DO NOT APPLY TO PRODUCTION without a separate security review,
-- disposable-Postgres integration tests, manual approval and trusted Edge caller.
-- This file is intentionally outside supabase/migrations/ and is NOT deployed.
--
-- PostgreSQL functions run in one transaction. In this draft, table-level
-- SHARE ROW EXCLUSIVE locks block concurrent writers to all three stat tables,
-- avoiding phantoms from a collector that does not take advisory locks.
-- This is intentionally conservative; the potential global writer pause and
-- 1-second lock timeout require a staging load test before deployment.
--
-- This SQL CANNOT authenticate Clash. Only a server-only Edge caller that
-- *just* fetched an authoritative ended war and ran
-- previewHistoricalCwlMisses() may prepare this payload. Never accept browser,
-- import, or user-provided "official" snapshots as evidence.
begin;

create or replace function public.cwl_commit_verified_historical_missed(
  p_clan_id uuid,
  p_war_key text,
  p_expected_clash_tag text,
  p_expected_updated_at timestamptz,
  p_expected_started_at timestamptz,
  p_expected_opponent_tag text,
  p_expected_roster jsonb,
  p_expected_attacks jsonb,
  p_official_attack_counter integer,
  p_confirmed_missed jsonb,
  p_apply boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '1s'
set statement_timeout = '5s'
as $reconciliation$
declare
  v_clash_tag text;
  v_war public.cwl_stat_wars%rowtype;
  v_roster_count integer;
  v_roster_unique integer;
  v_invalid_roster integer;
  v_attacks jsonb;
  v_attack_count integer;
  v_unique_attackers integer;
  v_invalid_attack integer;
  v_existing_missed integer;
  v_missed_count integer;
  v_unique_missed integer;
  v_invalid_missed integer;
  v_expected_missing text[];
  v_offered_missing text[];
  v_changed integer;
begin
  -- Defense in depth: EXECUTE privilege must also be revoked from PUBLIC,
  -- anon and authenticated below. SECURITY INVOKER never changes role.
  if current_user <> 'service_role' then
    raise exception 'reconciliation_forbidden' using errcode = '42501';
  end if;
  if p_clan_id is null or p_war_key is null or
     p_war_key !~ '^cwl:#[0289PYLQGRJCUV]{3,15}$' or
     p_expected_clash_tag is null or
     p_expected_clash_tag !~ '^#[0289PYLQGRJCUV]{3,15}$' or
     p_apply is null or p_official_attack_counter is null or
     jsonb_typeof(p_expected_roster) is distinct from 'array' or
     jsonb_typeof(p_expected_attacks) is distinct from 'array' or
     jsonb_typeof(p_confirmed_missed) is distinct from 'array' then
    raise exception 'reconciliation_invalid_request';
  end if;

  -- Locks are part of this one RPC transaction, not separate REST calls.
  -- Lock all four tables in a fixed order; concurrent inserts/updates/deletes
  -- from the existing collector cannot sneak in during validation + write.
  lock table public.cwl_clans, public.cwl_stat_wars,
    public.cwl_stat_attacks, public.cwl_stat_missed
    in share row exclusive mode;

  select c.clash_tag into v_clash_tag
    from public.cwl_clans as c where c.id = p_clan_id;
  if not found or v_clash_tag is distinct from p_expected_clash_tag then
    raise exception 'reconciliation_clan_changed';
  end if;

  select w.* into v_war from public.cwl_stat_wars as w
    where w.clan_id=p_clan_id and w.war_key=p_war_key
    for update;
  if not found or
     v_war.source is distinct from 'api' or
     v_war.war_type is distinct from 'cwl' or
     v_war.finalized is distinct from true or
     v_war.missed_log_complete is distinct from false or
     v_war.updated_at is distinct from p_expected_updated_at or
     v_war.started_at is distinct from p_expected_started_at or
     v_war.opponent_tag is distinct from p_expected_opponent_tag or
     v_war.roster_tags is distinct from p_expected_roster then
    raise exception 'reconciliation_war_conflict';
  end if;

  select count(*),count(distinct t.value),
         count(*) filter(where t.value !~ '^#[0289PYLQGRJCUV]{3,15}$')
    into v_roster_count,v_roster_unique,v_invalid_roster
    from jsonb_array_elements_text(v_war.roster_tags) as t(value);
  if v_roster_count <> v_war.team_size or
     v_roster_unique <> v_war.team_size or
     v_invalid_roster <> 0 then
    raise exception 'reconciliation_bad_roster';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'attacker_tag',a.attacker_tag,'attack_order',a.attack_order,
          'defender_tag',a.defender_tag,'attacker_th',a.attacker_th,
          'defender_th',a.defender_th,'stars',a.stars,
          'destruction',a.destruction
        ) order by a.attacker_tag,a.attack_order
      ),'[]'::jsonb),
    count(*),count(distinct a.attacker_tag),
    count(*) filter(
      where a.attack_order <> 1 or
            not (v_war.roster_tags ? a.attacker_tag)
    )
    into v_attacks,v_attack_count,v_unique_attackers,v_invalid_attack
    from public.cwl_stat_attacks as a
    where a.clan_id=p_clan_id and a.war_key=p_war_key;

  -- The official counter was checked by the trusted JS preview. The RPC
  -- still rejects contradictions against the locked current DB snapshot.
  if v_attacks is distinct from p_expected_attacks or
     v_attack_count <> p_official_attack_counter or
     v_attack_count > v_war.team_size or
     v_unique_attackers <> v_attack_count or
     v_invalid_attack <> 0 then
    raise exception 'reconciliation_attack_conflict';
  end if;

  select count(*) into v_existing_missed
    from public.cwl_stat_missed as m
    where m.clan_id=p_clan_id and m.war_key=p_war_key;
  if v_existing_missed <> 0 then
    raise exception 'reconciliation_existing_missed_conflict';
  end if;

  select count(*),count(distinct m.value->>'player_tag'),
    count(*) filter(where
      jsonb_typeof(m.value) is distinct from 'object' or
      jsonb_typeof(m.value->'player_tag') is distinct from 'string' or
      (m.value->>'player_tag') !~ '^#[0289PYLQGRJCUV]{3,15}$' or
      jsonb_typeof(m.value->'player_name') is distinct from 'string' or
      length(m.value->>'player_name') > 80 or
      jsonb_typeof(m.value->'missed_count') is distinct from 'number' or
      m.value->>'missed_count' is distinct from '1'
    ) into v_missed_count,v_unique_missed,v_invalid_missed
    from jsonb_array_elements(p_confirmed_missed) as m(value);

  select coalesce(array_agg(t.value order by t.value),array[]::text[])
    into v_expected_missing
    from jsonb_array_elements_text(v_war.roster_tags) as t(value)
    where not exists(
      select 1 from public.cwl_stat_attacks as a
      where a.clan_id=p_clan_id and a.war_key=p_war_key
        and a.attacker_tag=t.value
    );
  select coalesce(array_agg(m.value->>'player_tag'
         order by m.value->>'player_tag'),array[]::text[])
    into v_offered_missing
    from jsonb_array_elements(p_confirmed_missed) as m(value);

  if v_missed_count > 50 or
     v_missed_count <> v_war.team_size - v_attack_count or
     v_unique_missed <> v_missed_count or v_invalid_missed <> 0 or
     v_offered_missing is distinct from v_expected_missing then
    raise exception 'reconciliation_missed_conflict';
  end if;

  -- Default is a *verified*, read-only dry run. No write when omitted.
  if p_apply = false then
    return jsonb_build_object(
      'applied',false,'confirmed_misses',v_missed_count,
      'status','verified_preview'
    );
  end if;

  -- Both statements run atomically with the checks above; if the update
  -- conflicts, the insert also rolls back. Never ON CONFLICT DO NOTHING.
  insert into public.cwl_stat_missed
    (clan_id,war_key,player_tag,player_name,missed_count)
    select p_clan_id,p_war_key,m.value->>'player_tag',
           m.value->>'player_name',1
    from jsonb_array_elements(p_confirmed_missed) as m(value);

  update public.cwl_stat_wars as w
    set missed_log_complete=true,updated_at=clock_timestamp()
    where w.clan_id=p_clan_id and w.war_key=p_war_key
      and w.source='api' and w.war_type='cwl'
      and w.finalized=true and w.missed_log_complete=false
      and w.updated_at=p_expected_updated_at;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then
    raise exception 'reconciliation_update_conflict';
  end if;

  return jsonb_build_object(
    'applied',true,'confirmed_misses',v_missed_count,
    'status','reconciled'
  );
end;
$reconciliation$;

-- PostgreSQL grants EXECUTE to PUBLIC by default; Supabase may also supply
-- direct role grants. Revoke in the SAME transaction as CREATE.
revoke all on function public.cwl_commit_verified_historical_missed(
 uuid,text,text,timestamptz,timestamptz,text,jsonb,jsonb,integer,jsonb,boolean
) from public,anon,authenticated;
grant execute on function public.cwl_commit_verified_historical_missed(
 uuid,text,text,timestamptz,timestamptz,text,jsonb,jsonb,integer,jsonb,boolean
) to service_role;

commit;
