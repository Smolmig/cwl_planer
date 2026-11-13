-- Disposable PostgreSQL-17 restore smoke-test. All test data is synthetic.
\set ON_ERROR_STOP on
do $$
begin
 if (select count(*) from public.cwl_stat_wars) <> 5 or
    (select count(*) from public.cwl_stat_wars where source='api') <> 1 then
  raise exception 'Archived synthetic war history lost during backup restore';
 end if;
 if (select count(*) from public.cwl_stat_attacks) <> 7 or
    (select count(*) from public.cwl_stat_missed) <> 4 then
  raise exception 'Synthetic attacks or Missed evidence lost during restore';
 end if;
 if (select count(*) from public.cwl_stat_wars
      where finalized and missed_log_complete) <> 4 then
  raise exception 'Verified Missed coverage changed during restore';
 end if;
 if not exists(select 1 from pg_proc
    where oid='public.cwl_import_clashperk_atomic(uuid,jsonb)'::regprocedure
    and not prosecdef) then
  raise exception 'Safe historical-import function was not restored';
 end if;
end
$$;
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare v jsonb;
begin
 if exists (select 1 from public.cwl_stat_wars
    where clan_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
  raise exception 'Restored RLS leaked second-clan statistics';
 end if;
 if (select count(*) from public.cwl_stat_wars
    where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>4 then
  raise exception 'Owner cannot read restored first-clan statistics';
 end if;
 v:=public.cwl_import_clashperk_atomic(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   public.clashperk_test_payload('110'));
 if v->>'inserted'<>'1' or v->>'completeWars'<>'1' then
  raise exception 'Restored atomic importer can no longer accept verified history';
 end if;
end
$$;
set request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
do $$
begin
 begin
  perform public.cwl_import_clashperk_atomic(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   public.clashperk_test_payload('111'));
  raise exception 'Restored viewer was granted editing permission';
 exception when insufficient_privilege then null;
 end;
 if (select count(*) from public.cwl_stat_attacks
     where war_key='cp:110')<>2 then
  raise exception 'Restored player attack detail is incomplete';
 end if;
 if exists(select 1 from public.cwl_stat_wars
      where clan_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
  raise exception 'Restored viewer can read a foreign clan';
 end if;
end
$$;
reset role;
select 'ClashPerk backup restore RLS and history smoke check: PASS' as result;
