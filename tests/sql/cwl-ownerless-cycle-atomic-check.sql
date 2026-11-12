-- #227 Phase 4 tests, disposable PG17, NO production data.
-- These tests run after synthetic trigger fixture, phase-4 SQL.
do $t$
begin
 if has_function_privilege('anon',
    'public.cwl_ownerless_atomic_rollover(uuid,uuid,bigint,text)','EXECUTE')
    or has_function_privilege('authenticated',
    'public.cwl_ownerless_atomic_rollover(uuid,uuid,bigint,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.cwl_ownerless_atomic_rollover(uuid,uuid,bigint,text)','EXECUTE')
 then raise exception 'atomic RPC exposed outside service_role';end if;
 if has_table_privilege('authenticated','public.cwl_ownerless_cycle_transitions','SELECT')
    or has_table_privilege('service_role','public.cwl_ownerless_cycle_transitions','UPDATE')
    or has_table_privilege('service_role','public.cwl_ownerless_cycle_transitions','DELETE')
    or not (select relrowsecurity from pg_class where oid=
      'public.cwl_ownerless_cycle_transitions'::regclass)
 then raise exception 'transition audit is mutable/exposed/no RLS';end if;
end $t$;

-- Error is injected AFTER original checkpoint + profile update + review
-- update and BEFORE the audit commit. Exception subtransaction MUST undo
-- all changes, including auto audit/snapshot trigger effects.
create function private.cwl_test_fail_transition()
returns trigger language plpgsql set search_path=''
as $fn$
begin
 if current_setting('test.cwl_force_fail',true)='on' then
   raise exception 'synthetic_commit_failure' using errcode='P7700';
 end if;
 return new;
end $fn$;
create trigger cwl_test_fail_transition before insert on
 public.cwl_ownerless_cycle_transitions
 for each row execute function private.cwl_test_fail_transition();

set role service_role;
do $t$
declare failed boolean:=false;
begin
 perform set_config('test.cwl_force_fail','on',false);
 begin
   perform public.cwl_ownerless_atomic_rollover(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',20,'2026-12');
 exception when sqlstate 'P7700' then failed:=true;
 end;
 perform set_config('test.cwl_force_fail','off',false);
 if not failed then raise exception 'expected injected atomic failure';end if;
end $t$;
reset role;
do $t$
begin
 if exists(select 1 from public.cwl_ownerless_cycle_checkpoints)
 or exists(select 1 from public.cwl_ownerless_cycle_transitions)
 or exists(select 1 from public.cwl_change_events)
 or exists(select 1 from public.cwl_profile_snapshots)
 or (select revision from public.cwl_cloud_profiles
    where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>20
 or (select season from public.cwl_plan_review_state
    where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>'2026-11'
 or (select status from public.cwl_plan_suggestions
    where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>'pending'
 then raise exception 'rollback did not undo entire attempted rollover';end if;
end $t$;

-- 6/7: one unknown, no phantom completed last war.
set role service_role;
do $t$
declare r jsonb;
begin
 r:=public.cwl_ownerless_atomic_rollover(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',20,'2026-12');
 if r->>'applied'<>'true' or r->>'created'<>'true' or
    r->>'reason'<>'atomic_rollover_applied' or
    (r->>'source_played_days')::int<>6 or
    (r->>'source_unconfirmed_days')::int<>1 or
    (r->>'target_revision')::int<>21 or
    r->>'target_cycle_id'='11111111-1111-4111-8111-111111111111' then
   raise exception '6/7 atomic rollover returned wrong state: %',r;
 end if;
 r:=public.cwl_ownerless_atomic_rollover(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',20,'2026-12');
 if r->>'applied'<>'true' or r->>'created'<>'false' or
    r->>'reason'<>'already_applied' then
   raise exception 'same cron retry reset profile twice: %',r;
 end if;
 r:=public.cwl_ownerless_atomic_rollover(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',20,'2026-10');
 if r->>'applied'<>'false' then
   raise exception 'wrong target accepted after rollover: %',r;
 end if;
 r:=public.cwl_ownerless_atomic_rollover(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',15,'2026-12');
 if r->>'applied'<>'false' or r->>'reason'<>'no_new_verified_season' then
   raise exception 'other tenant inherited same tag API proof: %',r;
 end if;
end $t$;
reset role;
do $t$
declare p jsonb;a jsonb;c jsonb;v_note jsonb;cp jsonb;source jsonb;
begin
 select profile_json into p from public.cwl_cloud_profiles
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 a:=p->'archives'->0;
 select source_profile into cp from public.cwl_ownerless_cycle_checkpoints
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_note:=p->'members'->0;
 if jsonb_array_length(p->'archives')<>1 or
   a->>'sourceSeason'<>'2026-11' or
   (a->>'playedCount')::int<>6 or a->>'complete'<>'false' or
   (a->>'days')::int<>7 or
   jsonb_array_length(a->'lineups')<>6 or
   a#>>'{lineups,0,snapshots,p01,name}'<>'Testspieler damals' or
   (a->'counts'->>'p01')::int<>1 or
   (p#>>'{config,days}')::int<>7 or
   jsonb_array_length(p->'locks')<>7 or
   p#>>'{locks,0,locked}'<>'false' or
   p#>>'{locks,6,locked}'<>'false' or
   p ? 'cwlLive' or
   p->>'cwlLiveIgnoredSeason'<>'2026-11' or
   jsonb_array_length(p->'archivedMembers')<>0 or
   v_note->>'name'<>'Testspieler' or
   v_note->>'note'<>'historical' or
   v_note->>'fixed'<>'true' or
   v_note->>'targetDays' is not null or
   v_note->'statuses'<> '["auto","auto","auto","auto","auto","auto","auto"]'::jsonb or
   v_note#>>'{cocBeforeDeparture,before,targetDays}' is not null or
   v_note#>>'{cocBeforeDeparture,edited,statuses.0}' is not null or
   v_note#>>'{cocBeforeDeparture,edited,preserveNote}'<>'yes' or
   cp#>>'{members,0,note}'<>'historical' or
   cp#>>'{locks,0,locked}'<>'true' or
   cp#>>'{locks,6,locked}'<>'false' or
   cp#>>'{cwlLive,season}'<>'2026-11'
 then raise exception 'old plan lost or new plan/archive malformed: %',p;end if;
 if (select revision from public.cwl_cloud_profiles
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>21
 or (select updated_by::text from public.cwl_cloud_profiles
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
     <>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 or (select locked from public.cwl_plan_review_state
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not false
 or (select season from public.cwl_plan_review_state
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>'2026-12'
 or (select status from public.cwl_plan_suggestions
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>'stale'
 or (select status from public.cwl_plan_suggestions
     where clan_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>'pending'
 or (select count(*) from public.cwl_ownerless_cycle_transitions)<>1
 or (select count(*) from public.cwl_change_events
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and actor_id is null and revision=21 and event_type='profile_updated')<>1
 or (select count(*) from public.cwl_profile_snapshots
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and revision=20)<>1
 then raise exception 'review/audit/backup/provenance not one atomic commit';end if;
 if (select checkpoint_sha256 from public.cwl_ownerless_cycle_transitions
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  <> encode(sha256(convert_to(cp::text,'UTF8')),'hex') then
   raise exception 'transition did not reference exact full original profile';
 end if;
end $t$;

-- Generic service UPDATE and an unprivileged viewer MUST remain denied even
-- though the server has now completed the verified transition.
set role service_role;
do $t$ declare denied boolean:=false;
begin
 begin
  update public.cwl_cloud_profiles set profile_json=
   jsonb_set(profile_json,'{bad}','true'::jsonb)
   where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then
   raise exception 'service role gained blanket profile write bypass';
 end if;
end $t$;
reset role;

-- Simulated verified new group for tenant B (same linked Supercell tag),
-- then its *own* completed 7/7 path, independent of tenant A.
insert into public.cwl_verified_league_observations
 (clan_id,season,clan_tag,group_tags,war_count,rounds_count,group_state)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-12','#2PYL',
 '["#2PY0","#2PY9","#2PYC","#2PYG","#2PYL","#2PYQ","#2PYR","#2PYV"]'::jsonb,
 7,0,'preparation');
set role service_role;
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_atomic_rollover(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',15,'2026-12');
 if r->>'applied'<>'true' or (r->>'source_unconfirmed_days')::int<>0
 then raise exception '7/7 failed: %',r;end if;
end $t$;
reset role;
do $t$
declare a jsonb;
begin
 select profile_json->'archives'->0 into a
 from public.cwl_cloud_profiles
 where clan_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 if (a->>'days')::int<>7 or (a->>'playedCount')::int<>7 or
    a->>'complete'<>'true' or jsonb_array_length(a->'lineups')<>7
 then raise exception '7/7 invented missing day or lost lines: %',a;end if;
end $t$;

-- Historical old five-war clan, NO 6th or 7th old war.
insert into public.cwl_verified_league_observations
 (clan_id,season,clan_tag,group_tags,war_count,rounds_count,group_state)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-12','#2PYQ',
 '["#2PY0","#2PY9","#2PYC","#2PYG","#2PYL","#2PYQ","#2PYR","#2PYV"]'::jsonb,
 7,0,'preparation');
set role service_role;
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_atomic_rollover(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '33333333-3333-4333-8333-333333333333',30,'2026-12');
 if r->>'applied'<>'true' or (r->>'source_unconfirmed_days')::int<>0
 then raise exception '5/5 failed: %',r;end if;
end $t$;
reset role;
do $t$ declare a jsonb;v jsonb;
begin
 select profile_json->'archives'->0,profile_json into a,v
 from public.cwl_cloud_profiles
 where clan_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 if (a->>'days')::int<>5 or (a->>'playedCount')::int<>5 or
    a->>'complete'<>'true' or jsonb_array_length(a->'lineups')<>5 or
    (v#>>'{config,days}')::int<>7 or
    jsonb_array_length(v->'locks')<>7
 then raise exception '5/5/7->new-season format mismatch: %',v;end if;
end $t$;

-- No cross-tenant data, no extra transitions, no stale old suggestions.
do $t$
begin
 if (select count(*) from public.cwl_ownerless_cycle_transitions)<>3 or
    (select count(*) from public.cwl_ownerless_cycle_checkpoints)<>3 or
    (select count(*) from public.cwl_change_events)<>3
 then raise exception 'missing/doubled transition/audit/snapshot';end if;
end $t$;

-- Normal owner's earlier permissions must NOT be stolen by the system path.
-- Synthetic owner claims are solely for this isolated contract test.
set role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
do $t$
declare old_revision bigint; new_revision bigint;
begin
 select revision into old_revision from public.cwl_cloud_profiles
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 update public.cwl_cloud_profiles set profile_json=
  jsonb_set(profile_json,'{name}','"Normal Owner edit"'::jsonb)
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 select revision into new_revision from public.cwl_cloud_profiles
  where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if new_revision<>old_revision+1 then
   raise exception 'normal authenticated edit lost revision behavior';end if;
end $t$;
reset role;
select set_config('request.jwt.claim.sub','',false);

-- A stale second worker after owner edit still cannot replay old reset.
set role service_role;
do $t$ declare r jsonb;
begin
 r:=public.cwl_ownerless_atomic_rollover(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',20,'2026-12');
 if r->>'reason'<>'already_applied' then
   raise exception 'cron retry should not reset later owner edit: %',r;end if;
end $t$;
reset role;
select 'PASS: atomic old archive, new cycle, triggers, rollback, retries, 5/7 tenants' as result;
