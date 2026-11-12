-- Disposable PG17 CI: executable regression, no production-data access.
-- Any failing safety assertion raises an exception and fails the workflow.
do $t$
declare r jsonb;
begin
  r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if r->>'candidate'<>'true' or
     r->>'reason'<>'atomic_archive_and_cycle_transaction_required' or
     r->>'source_season'<>'2026-11' or r->>'target_season'<>'2026-12' or
     (r->>'source_locked_clash_days')::int<>6 or
     (r->>'source_unconfirmed_days')::int<>1 or
     r->>'source_archive_exists'<>'false' or
     (r->>'source_revision')::int<>20 or
     r->>'source_cycle_id'<>'11111111-1111-4111-8111-111111111111'
  then raise exception '6/7 verified official new season preflight incorrect: %',r;end if;
  r:=public.cwl_ownerless_cycle_preflight('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if r->>'candidate'<>'false' or r->>'reason'<>'no_new_verified_season'
  then raise exception 'foreign app-clan wrongly used shared tag evidence: %',r;end if;
  r:=public.cwl_ownerless_cycle_preflight('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  if r->>'candidate'<>'false' or r->>'reason'<>'review_cycle_missing'
  then raise exception 'missing review cycle was guessed: %',r;end if;
end
$t$;

-- Synthetic progress 7/7: readiness must not confuse saved locks with
-- verified completed games; it only reports seven old-cycle Clash locks.
update public.cwl_cloud_profiles set
  profile_json=public.test_cwl_profile(7,7,'2026-11'),revision=21
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if (r->>'source_locked_clash_days')::int<>7 or
    (r->>'source_unconfirmed_days')::int<>0 or
    (r->>'source_revision')::int<>21
 then raise exception '7/7 snapshot count inconsistent: %',r;end if;
end $t$;

-- Historical five-war seasons are also valid sources, without phantom day 6/7.
update public.cwl_cloud_profiles set
  profile_json=public.test_cwl_profile(5,5,'2026-11'),revision=22
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'candidate'<>'true' or
    (r->>'source_war_count')::int<>5 or
    (r->>'source_unconfirmed_days')::int<>0
 then raise exception '5/5 source misread or phantom day: %',r;end if;
end $t$;

-- An existing original archive must be recognized but never replaced here.
update public.cwl_cloud_profiles set
  profile_json=jsonb_set(profile_json,'{archives}',
    '[{"id":"synthetic-arch","sourceSeason":"2026-11","lineups":[]}]'::jsonb)
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'candidate'<>'true' or r->>'source_archive_exists'<>'true'
 then raise exception 'existing source archive not recognized: %',r;end if;
end $t$;
-- Duplicated source archive is always a safety block (no silent dedup).
update public.cwl_cloud_profiles set
  profile_json=jsonb_set(profile_json,'{archives}',
    '[{"id":"a","sourceSeason":"2026-11","lineups":[]},{"id":"b","sourceSeason":"2026-11","lineups":[]}]'::jsonb)
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'reason'<>'duplicate_source_archive'
 then raise exception 'duplicate archive not blocked: %',r;end if;
end $t$;

-- Broken history and manual locks are not auto-reset, even when official
-- next-season evidence exists.
update public.cwl_cloud_profiles set profile_json=
  jsonb_set(public.test_cwl_profile(7,6,'2026-11'),
    '{locks,0,source}','"manual"'::jsonb)
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'reason'<>'unsafe_locked_day'
 then raise exception 'manual played lock could be deleted: %',r;end if;
end $t$;
update public.cwl_cloud_profiles set profile_json=
  jsonb_set(public.test_cwl_profile(7,6,'2026-11'),
    '{cwlLive,season}','"2026-10"'::jsonb)
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'reason'<>'source_season_unverified'
 then raise exception 'source season mismatch allowed: %',r;end if;
end $t$;
update public.cwl_cloud_profiles set profile_json=
  public.test_cwl_profile(7,6,'2026-11')
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Refuse old or future observations, including the same season as the
-- plan review state. Date of observation is not proof of warEnded.
-- The stage-1 real trigger intentionally forces last_seen_at=now() on
-- every write. Only in this disposable synthetic CI database, briefly
-- suspend that ONE trigger to simulate 48 hours without any collector poll.
alter table public.cwl_verified_league_observations
  disable trigger cwl_verified_league_observation_guard;
update public.cwl_verified_league_observations
 set last_seen_at=now()-interval '48 hours'
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
alter table public.cwl_verified_league_observations
  enable trigger cwl_verified_league_observation_guard;
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'reason'<>'season_evidence_stale'
 then raise exception 'stale Supercell evidence was accepted: %',r;end if;
end $t$;
update public.cwl_verified_league_observations set last_seen_at=now()
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.cwl_plan_review_state set season='2026-12'
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'reason'<>'no_new_verified_season'
 then raise exception 'same-season rollover was allowed: %',r;end if;
end $t$;
update public.cwl_plan_review_state set season='2026-11'
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Guard table identity cannot switch the same season to a different linked
-- clan or a different six/eight-clan group.
do $t$
begin
 begin
   update public.cwl_verified_league_observations
     set group_tags='["#2PY0","#2PY9","#2PYC","#2PYG","#2PYL","#2PYQ"]'::jsonb,
       war_count=5
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
   raise exception 'expected immutable group rejection';
 exception when check_violation then null;
 end;
 begin
   insert into public.cwl_verified_league_observations
     (clan_id,season,clan_tag,group_tags,war_count,rounds_count,group_state)
     values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
       '2026-12','#2PYL',
       '["#2PY0","#2PY9","#2PYC","#2PYG","#2PYL","#2PYQ","#2PYR","#2PYV"]'::jsonb,
       7,0,'preparation');
   raise exception 'expected foreign clan-tag rejection';
 exception when check_violation then null;
 end;
end $t$;

-- Actual Postgres permissions, not just a grep over SQL.
do $t$
begin
 if has_function_privilege('anon',
   'public.cwl_ownerless_cycle_preflight(uuid)','EXECUTE') or
    has_function_privilege('authenticated',
   'public.cwl_ownerless_cycle_preflight(uuid)','EXECUTE') or
    not has_function_privilege('service_role',
   'public.cwl_ownerless_cycle_preflight(uuid)','EXECUTE')
 then raise exception 'public preflight permission regression';end if;
 if has_table_privilege('anon',
   'public.cwl_verified_league_observations','SELECT') or
    has_table_privilege('authenticated',
   'public.cwl_verified_league_observations','SELECT')
 then raise exception 'official group evidence leaked to browser';end if;
 if not (select relrowsecurity from pg_class
   where oid='public.cwl_verified_league_observations'::regclass)
 then raise exception 'group evidence table lacks RLS';end if;
end $t$;

-- Genuine service-invoker execution, restricted result shape, no write.
set role service_role;
do $t$
declare r jsonb;
begin
 r:=public.cwl_ownerless_cycle_preflight('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if r->>'candidate'<>'true' then
   raise exception 'service-only preflight was denied: %',r;
 end if;
end
$t$;
reset role;
select 'PASS: synthetic preflight and permissions' as result;
