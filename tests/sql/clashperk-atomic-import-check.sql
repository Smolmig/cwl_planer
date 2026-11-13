-- PostgreSQL 17: execute draft RPC with realistic RLS and adversarial payloads.
-- All objects/rows are synthetic, run only in an ephemeral CI database.
\set ON_ERROR_STOP on
create function public.clashperk_test_payload(
 p_id text,p_clan text default '#99JP2RL2'
) returns jsonb language sql immutable set search_path=''
as $$
 select jsonb_build_object(
  'clanTag',p_clan,
  'wars',jsonb_build_array(jsonb_build_object(
    'war_key','cp:'||p_id,
    'war_type','normal',
    'started_at',to_char(
      ('2026-01-01 00:00:00+00'::timestamptz +
        (p_id::integer)*interval '1 day') at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'team_size',2,'opponent_tag','#2PYL','opponent_name','Synthetic Enemy'
  )),
  'attacks',jsonb_build_array(
   jsonb_build_object(
    'war_key','cp:'||p_id,'attacker_tag','#8PYL','attack_order',1,
    'attacker_name','Synthetic Player','attacker_th',18,
    'defender_tag','#2QPYL','defender_name','Synthetic Enemy','defender_th',18,
    'stars',3,'destruction',100
   ),
   jsonb_build_object(
    'war_key','cp:'||p_id,'attacker_tag','#8PYL','attack_order',2,
    'attacker_name','Synthetic Player','attacker_th',18,
    'defender_tag','#2QPYL','defender_name','Synthetic Enemy','defender_th',18,
    'stars',2,'destruction',90
   )
  ),
  'missed',jsonb_build_array(
   jsonb_build_object(
    'war_key','cp:'||p_id,'player_tag','#QPYL',
    'player_name','No Attack','missed_count',2
   )
  )
 )
$$;
-- Only signed-in members with editor rights may execute. The function is
-- SECURITY INVOKER; table writes still require the existing policies.
do $$
begin
 if (select p.prosecdef from pg_proc p
     where p.oid='public.cwl_import_clashperk_atomic(uuid,jsonb)'::regprocedure) then
  raise exception 'Unsafe SECURITY DEFINER import';
 end if;
 if has_function_privilege('anon','public.cwl_import_clashperk_atomic(uuid,jsonb)','EXECUTE')
 or has_function_privilege('public','public.cwl_import_clashperk_atomic(uuid,jsonb)','EXECUTE') then
  raise exception 'Public import EXECUTE grant';
 end if;
 if not has_function_privilege('authenticated','public.cwl_import_clashperk_atomic(uuid,jsonb)','EXECUTE') then
  raise exception 'Editor cannot call atomic import RPC';
 end if;
end
$$;

set role authenticated;
set request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
do $$
begin
 begin
  perform public.cwl_import_clashperk_atomic(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   public.clashperk_test_payload('100'));
  raise exception 'Viewer was incorrectly allowed to write';
 exception when insufficient_privilege then null;
 end;
end
$$;

set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare v jsonb;
begin
 v:=public.cwl_import_clashperk_atomic(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  public.clashperk_test_payload('100'));
 if v->>'inserted'<>'1' or v->>'attacks'<>'2' or
    v->>'missed'<>'1' or v->>'completeWars'<>'1' then
  raise exception 'Incorrect first import result %',v;
 end if;
 if not exists (select 1 from public.cwl_stat_wars
  where war_key='cp:100' and finalized and missed_log_complete and
  jsonb_array_length(roster_tags)=2) then
  raise exception 'War not finalized with verified attack slots';
 end if;
 -- Reupload is idempotent; neither attacks nor misses double-count.
 v:=public.cwl_import_clashperk_atomic(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  public.clashperk_test_payload('100'));
 if v->>'extended'<>'1' then
  raise exception 'Reimport not identified as extension';
 end if;
 if (select count(*) from public.cwl_stat_attacks where war_key='cp:100')<>2 or
    (select count(*) from public.cwl_stat_missed where war_key='cp:100')<>1 then
  raise exception 'Duplicate attack or missed on reimport';
 end if;
end
$$;

-- A late invalid Missed row must undo the newly inserted war + its attacks.
do $$
declare v jsonb;
begin
 v:=pg_catalog.jsonb_set(public.clashperk_test_payload('101'),
  '{missed,0,missed_count}','3'::jsonb);
 begin
  perform public.cwl_import_clashperk_atomic(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v);
  raise exception 'Expected late Missed validation failure';
 exception when sqlstate '22023' then null;
 end;
 if exists(select 1 from public.cwl_stat_wars where war_key='cp:101') or
    exists(select 1 from public.cwl_stat_attacks where war_key='cp:101') then
  raise exception 'PARTIAL IMPORT survived transaction rollback';
 end if;
end
$$;

-- An attacker with two different counts for the same saved attack causes a
-- hard conflict and rolls back any newly inserted rows in that upload.
do $$
declare v jsonb;
begin
 v:=pg_catalog.jsonb_set(public.clashperk_test_payload('100'),
  '{attacks,0,stars}','0'::jsonb);
 begin
  perform public.cwl_import_clashperk_atomic(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v);
  raise exception 'Expected conflicting evidence failure';
 exception when unique_violation then null;
 end;
 if (select stars from public.cwl_stat_attacks where war_key='cp:100'
     and attacker_tag='#8PYL' and attack_order=1)<>3 then
  raise exception 'Previously verified attack was overwritten';
 end if;
end
$$;

-- A partial historical war is finished as a known result but never pretends
-- to have full Missed coverage until later original logs prove the slots.
do $$
declare v jsonb;
begin
 v:=public.clashperk_test_payload('102');
 v:=pg_catalog.jsonb_set(v,'{attacks}',jsonb_build_array(v#>'{attacks,0}'));
 v:=pg_catalog.jsonb_set(v,'{missed}','[]'::jsonb);
 perform public.cwl_import_clashperk_atomic(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v);
 if not exists(select 1 from public.cwl_stat_wars
  where war_key='cp:102' and finalized and not missed_log_complete) then
  raise exception 'Partial war incorrectly claimed zero missing attacks';
 end if;
 perform public.cwl_import_clashperk_atomic(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  public.clashperk_test_payload('102'));
 if not exists(select 1 from public.cwl_stat_wars
  where war_key='cp:102' and finalized and missed_log_complete) then
  raise exception 'Late verified Missed evidence did not complete war';
 end if;
 if (select count(*) from public.cwl_stat_attacks where war_key='cp:102')<>2 then
  raise exception 'Late reimport created duplicate attacks';
 end if;
end
$$;

-- Other tenant cannot be given the first clan's data by tampering clan_id.
do $$
begin
 begin
  perform public.cwl_import_clashperk_atomic(
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   public.clashperk_test_payload('103'));
  raise exception 'Tenant hop was incorrectly allowed';
 exception when insufficient_privilege then null;
 end;
 if exists(select 1 from public.cwl_stat_wars where war_key='cp:103') then
  raise exception 'Cross-tenant war leaked';
 end if;
end
$$;

-- API war identity takes precedence even with a different key.
reset role;
insert into public.cwl_stat_wars(
 clan_id,war_key,war_type,started_at,team_size,
 opponent_tag,opponent_name,source,finalized
) values(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'normal:api-collision','normal',
 ('2026-01-01 00:00:00+00'::timestamptz + 104*interval '1 day'),
 2,'#2PYL','API Synthetic','api',true
);
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare v jsonb;
begin
 v:=public.cwl_import_clashperk_atomic(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  public.clashperk_test_payload('104'));
 if v->>'skippedApi'<>'1' then
  raise exception 'API collision not skipped: %',v;
 end if;
 if exists(select 1 from public.cwl_stat_wars where war_key='cp:104') or
    exists(select 1 from public.cwl_stat_attacks where war_key='cp:104') then
  raise exception 'Duplicate API-owned war created';
 end if;
end
$$;

-- An editor is not allowed to create a war for a second linked app clan.
do $$
begin
 begin
  perform public.cwl_import_clashperk_atomic(
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   public.clashperk_test_payload('105','#2JGC2J8VG'));
  raise exception 'Editor could write other tenant';
 exception when insufficient_privilege then null;
 end;
end
$$;

-- Owner of tenant B may import B alone, without changing tenant A.
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare v jsonb;
begin
 v:=public.cwl_import_clashperk_atomic(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  public.clashperk_test_payload('106','#2JGC2J8VG'));
 if v->>'inserted'<>'1' then
  raise exception 'Second tenant owner import failed';
 end if;
end
$$;
-- Read isolation must hold as strongly as write isolation. A real HTTP
-- test caught this missing assertion in the earlier synthetic fixture.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
begin
 if exists(select 1 from public.cwl_stat_wars where war_key='cp:106') then
  raise exception 'First clan owner can SELECT another clan''s war';
 end if;
 if not exists(select 1 from public.cwl_stat_wars where war_key='cp:100') then
  raise exception 'First clan owner lost its own war';
 end if;
end
$$;
set request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
do $$
begin
 if exists(select 1 from public.cwl_stat_wars where war_key='cp:106') then
  raise exception 'Viewer can SELECT another clan''s war';
 end if;
 if not exists(select 1 from public.cwl_stat_wars where war_key='cp:100') then
  raise exception 'Viewer cannot read own clan''s war';
 end if;
end
$$;
reset role;

-- CWL permits ONE attack per player and the server must verify its own
-- missed-count capacity independently of the browser's preview.
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare v jsonb; out jsonb;
begin
 v:=public.clashperk_test_payload('107');
 v:=pg_catalog.jsonb_set(v,'{wars,0,war_type}','"cwl"'::jsonb);
 v:=pg_catalog.jsonb_set(v,'{attacks}',jsonb_build_array(v#>'{attacks,0}'));
 v:=pg_catalog.jsonb_set(v,'{missed,0,missed_count}','1'::jsonb);
 out:=public.cwl_import_clashperk_atomic(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v);
 if out->>'completeWars'<>'1' or
    (select war_type from public.cwl_stat_wars where war_key='cp:107')<>'cwl' or
    (select count(*) from public.cwl_stat_attacks where war_key='cp:107')<>1 then
  raise exception 'CWL one-attack coverage was not verified';
 end if;
 v:=public.clashperk_test_payload('108');
 v:=pg_catalog.jsonb_set(v,'{wars,0,war_type}','"cwl"'::jsonb);
 v:=pg_catalog.jsonb_set(v,'{missed,0,missed_count}','1'::jsonb);
 begin
  perform public.cwl_import_clashperk_atomic(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v);
  raise exception 'Incorrectly accepted second CWL attack';
 exception when sqlstate '22023' then null;
 end;
 if exists(select 1 from public.cwl_stat_wars where war_key='cp:108') then
  raise exception 'Partial invalid CWL imported despite rollback';
 end if;
end
$$;
reset role;

do $$
begin
 if (select count(*) from public.cwl_stat_wars
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>4 then
  raise exception 'Unexpected main tenant war count';
 end if;
 if (select count(*) from public.cwl_stat_wars
     where clan_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1 then
  raise exception 'Unexpected second tenant war count';
 end if;
end
$$;
select 'clashperk-atomic-rpc: all owner/editor/viewer/rollback/tenant/API/retry checks passed' as result;
