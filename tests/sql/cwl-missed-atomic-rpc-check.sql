-- Execute only in CI disposable PostgreSQL after fixture + DRAFT SQL.
\set ON_ERROR_STOP on

-- All test assertions fail the SQL script if they do not hold.
do $checks$
declare
  v_sig text := 'public.cwl_commit_verified_historical_missed(uuid,text,text,timestamptz,timestamptz,text,jsonb,jsonb,integer,jsonb,boolean)';
begin
  if pg_catalog.has_function_privilege('anon',v_sig,'EXECUTE') or
     pg_catalog.has_function_privilege('authenticated',v_sig,'EXECUTE') or
     not pg_catalog.has_function_privilege('service_role',v_sig,'EXECUTE') then
    raise exception 'rpc_role_acl_invalid';
  end if;
end;
$checks$;

create or replace function public.test_verified_rpc(
  p_apply boolean default false,
  p_official_count integer default 2
) returns jsonb
language sql
security invoker
as $func$
  select public.cwl_commit_verified_historical_missed(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'cwl:#2QGL','#2PYL',
    '2026-11-07T20:00:00Z'::timestamptz,
    '2026-11-05T19:00:00Z'::timestamptz,
    '#QPYL',
    '["#2PYL","#2PQL","#2PRL"]'::jsonb,
    '[
      {"attacker_tag":"#2PQL","attack_order":1,"defender_tag":"#QPYL",
       "attacker_th":18,"defender_th":18,"stars":3,"destruction":100},
      {"attacker_tag":"#2PYL","attack_order":1,"defender_tag":"#QPRL",
       "attacker_th":18,"defender_th":18,"stars":3,"destruction":100}
    ]'::jsonb,
    p_official_count,
    '[{"player_tag":"#2PRL","player_name":"Own 2","missed_count":1}]'::jsonb,
    p_apply
  );
$func$;
grant execute on function public.test_verified_rpc(boolean,integer)
  to service_role;

set role service_role;

do $checks$
declare v_result jsonb;
begin
  v_result:=public.test_verified_rpc(); -- p_apply defaults to false
  if v_result->>'status' <> 'verified_preview' or
     v_result->>'applied' <> 'false' or
     (v_result->>'confirmed_misses')::integer <> 1 then
    raise exception 'rpc_default_dry_run_wrong';
  end if;
  if exists(select 1 from public.cwl_stat_missed) or
     exists(select 1 from public.cwl_stat_wars
       where missed_log_complete=true) then
    raise exception 'rpc_dry_run_modified_rows';
  end if;
end;
$checks$;

-- The stored attack count cannot contradict the trusted official counter.
do $checks$
declare v_denied boolean:=false;
begin
  begin
    perform public.test_verified_rpc(false,1);
  exception when others then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'rpc_false_counter_accepted'; end if;
  if exists(select 1 from public.cwl_stat_missed) then
    raise exception 'rpc_false_counter_inserted_rows';
  end if;
end;
$checks$;

-- Simulate a stale local attack being modified between preview and RPC.
update public.cwl_stat_attacks set stars=2
where clan_id='11111111-1111-4111-8111-111111111111'
  and war_key='cwl:#2QGL' and attacker_tag='#2PQL';
do $checks$
declare v_denied boolean:=false;
begin
  begin
    perform public.test_verified_rpc(false,2);
  exception when others then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'rpc_stale_attack_accepted'; end if;
end;
$checks$;
update public.cwl_stat_attacks set stars=3
where clan_id='11111111-1111-4111-8111-111111111111'
  and war_key='cwl:#2QGL' and attacker_tag='#2PQL';

reset role;

-- Force the second half of the transaction to fail; first-half Missed insert
-- MUST automatically roll back, even when the caller asked p_apply=true.
create function public.test_abort_completed_war_update()
returns trigger language plpgsql as $fail$
begin
  if new.missed_log_complete=true then
    raise exception 'synthetic_status_write_failed';
  end if;
  return new;
end;
$fail$;
create trigger test_abort_completed_war_update
before update on public.cwl_stat_wars
for each row execute function public.test_abort_completed_war_update();

set role service_role;
do $checks$
declare v_denied boolean:=false;
begin
  begin
    perform public.test_verified_rpc(true,2);
  exception when others then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'rpc_trigger_failure_succeeded'; end if;
  if exists(select 1 from public.cwl_stat_missed) or
     exists(select 1 from public.cwl_stat_wars
       where missed_log_complete=true) then
    raise exception 'rpc_transaction_not_rolled_back';
  end if;
end;
$checks$;
reset role;

drop trigger test_abort_completed_war_update on public.cwl_stat_wars;
drop function public.test_abort_completed_war_update();

-- Retry without the fault: save exactly one row, then finalize atomically.
set role service_role;
do $checks$
declare v_result jsonb;
begin
  v_result:=public.test_verified_rpc(true,2);
  if v_result->>'status' <> 'reconciled' or
     v_result->>'applied' <> 'true' then
    raise exception 'rpc_apply_result_incorrect';
  end if;
  if (select count(*) from public.cwl_stat_missed
      where clan_id='11111111-1111-4111-8111-111111111111')<>1 or
     (select count(*) from public.cwl_stat_missed
      where clan_id='22222222-2222-4222-8222-222222222222')<>0 or
     (select missed_log_complete from public.cwl_stat_wars
      where clan_id='11111111-1111-4111-8111-111111111111')<>true or
     (select missed_log_complete from public.cwl_stat_wars
      where clan_id='22222222-2222-4222-8222-222222222222')<>false then
    raise exception 'rpc_write_order_or_tenant_isolation_wrong';
  end if;
end;
$checks$;

-- A second application cannot overwrite, duplicate or backdate the evidence.
do $checks$
declare v_denied boolean:=false;
begin
  begin
    perform public.test_verified_rpc(true,2);
  exception when others then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'rpc_repeated_apply_succeeded'; end if;
  if (select count(*) from public.cwl_stat_missed)<>1 then
    raise exception 'rpc_repeated_apply_modified_misses';
  end if;
end;
$checks$;
reset role;
