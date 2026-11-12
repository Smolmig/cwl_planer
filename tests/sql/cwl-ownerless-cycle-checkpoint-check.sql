-- #227 / Phase 3: native disposable Postgres-17 transaction checks.
-- No live Supabase / no real player profiles.
-- The setup has A+B sharing Clash tag, but only A has official new season.
do $t$
begin
  if has_function_privilege('anon',
     'public.cwl_ownerless_cycle_checkpoint(uuid,uuid,bigint,text)','EXECUTE')
     or has_function_privilege('authenticated',
     'public.cwl_ownerless_cycle_checkpoint(uuid,uuid,bigint,text)','EXECUTE')
     or not has_function_privilege('service_role',
     'public.cwl_ownerless_cycle_checkpoint(uuid,uuid,bigint,text)','EXECUTE')
  then raise exception 'checkpoint RPC is exposed to browser'; end if;
  if has_table_privilege('anon','public.cwl_ownerless_cycle_checkpoints','SELECT')
     or has_table_privilege('authenticated','public.cwl_ownerless_cycle_checkpoints','SELECT')
     or has_table_privilege('service_role','public.cwl_ownerless_cycle_checkpoints','UPDATE')
     or has_table_privilege('service_role','public.cwl_ownerless_cycle_checkpoints','DELETE')
  then raise exception 'history snapshot can leak or be modified'; end if;
  if not (select relrowsecurity from pg_class
     where oid='public.cwl_ownerless_cycle_checkpoints'::regclass)
  then raise exception 'checkpoint has no RLS';end if;
end $t$;

-- An atomic transaction that rolls back must leave ZERO records.
begin;
set local role service_role;
do $t$ declare r jsonb;
begin
  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',20,'2026-12');
  if r->>'saved'<>'true' or r->>'created'<>'true'
  then raise exception 'synthetic checkpoint should stage: %',r;end if;
end $t$;
rollback;
do $t$
begin
 if (select count(*) from public.cwl_ownerless_cycle_checkpoints)<>0
 then raise exception 'ROLLBACK leaked a staged snapshot';end if;
end $t$;

-- The real service-only RPC must secure original profile+review JSON and
-- return "created=true" exactly once even if the job is retried.
set role service_role;
do $t$ declare r jsonb;
begin
  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',20,'2026-12');
  if r->>'saved'<>'true' or r->>'created'<>'true' or
     r->>'source_season'<>'2026-11' or r->>'target_season'<>'2026-12' or
     (r->>'source_revision')::bigint<>20
  then raise exception '6/7 source was not secured: %',r;end if;

  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',20,'2026-12');
  if r->>'saved'<>'true' or r->>'created'<>'false'
  then raise exception 'same job retried and duplicated snapshot: %',r;end if;

  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',20,'2026-11');
  if r->>'saved'<>'false' or r->>'reason'<>'stale_preflight'
  then raise exception 'wrong future season accepted: %',r;end if;

  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',19,'2026-12');
  if r->>'saved'<>'false' or r->>'reason'<>'stale_profile_revision'
  then raise exception 'old profile CAS succeeded: %',r;end if;

  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '99999999-9999-4999-8999-999999999999',20,'2026-12');
  if r->>'saved'<>'false' or r->>'reason'<>'stale_cycle'
  then raise exception 'old cycle CAS succeeded: %',r;end if;

  r:=public.cwl_ownerless_cycle_checkpoint(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '22222222-2222-4222-8222-222222222222',15,'2026-12');
  if r->>'saved'<>'false' or r->>'reason'<>'no_new_verified_season'
  then raise exception 'other tenant sharing Clash tag inherited source: %',r;end if;
end $t$;
reset role;

-- After checkpoint, current profile, review cycle and locks are STILL LIVE
-- and byte-identical. The archive snapshot includes ALL original JSON keys.
do $t$
declare old_json jsonb; saved_json jsonb; rev_json jsonb; v_hash text;
begin
 select p.profile_json into old_json from public.cwl_cloud_profiles p
   where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 select cp.source_profile,cp.source_review_state,
   cp.source_profile_sha256 into saved_json,rev_json,v_hash
 from public.cwl_ownerless_cycle_checkpoints cp
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if saved_json is distinct from old_json or
    v_hash is null or
    (select revision from public.cwl_cloud_profiles
       where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>20 or
    (select cycle_id::text from public.cwl_plan_review_state
       where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <>
       '11111111-1111-4111-8111-111111111111' or
    rev_json is distinct from
       (select to_jsonb(s) from public.cwl_plan_review_state s
         where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') or
    v_hash is null then
    raise exception 'checkpoint changed source or dropped history';end if;
 if (select source_profile_sha256 from public.cwl_ownerless_cycle_checkpoints
       where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
       <> encode(sha256(convert_to(old_json::text,'UTF8')),'hex') then
   raise exception 'full source checksum mismatch';
 end if;
 if (select count(*) from public.cwl_ownerless_cycle_checkpoints)<>1
 then raise exception 'checkpoint tenant leak or duplicate'; end if;
end $t$;

-- The old checkpoint is immutable; a legitimate profile edit after staging
-- increments revision, and the new checkpoint is a distinct frozen snapshot.
update public.cwl_cloud_profiles
 set profile_json=jsonb_set(profile_json,'{testEdit}','"new-plan-revision"'::jsonb),
     revision=21
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role service_role;
do $t$ declare r jsonb;
begin
  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',21,'2026-12');
  if r->>'saved'<>'true' or r->>'created'<>'true'
  then raise exception 'new profile revision cannot create new checkpoint: %',r;end if;
end $t$;
reset role;
do $t$
begin
 if (select count(*) from public.cwl_ownerless_cycle_checkpoints)<>2 or
    (select source_profile ? 'testEdit'
      from public.cwl_ownerless_cycle_checkpoints
      where source_revision=20 and
      clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') or
    not (select source_profile ? 'testEdit'
      from public.cwl_ownerless_cycle_checkpoints
      where source_revision=21 and
      clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 then raise exception 'new revision overwrote original immutable history';end if;
end $t$;

-- Simulate an out-of-band change without the revision increment. Even if
-- the caller provides the matching old revision, old immutable history wins.
update public.cwl_cloud_profiles set
 profile_json=jsonb_set(profile_json,'{tampered}','true'::jsonb)
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $t$
begin
  begin
    perform public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',21,'2026-12');
    raise exception 'checkpoint_integrity_conflict_unexpectedly_accepted';
  exception when check_violation then
    null;
  end;
end $t$;
-- Restore only the synthetic fixture's profile shape.
update public.cwl_cloud_profiles set
 profile_json=profile_json-'tampered'
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- 5/5 and 7/7 sources are also legitimate old-cycle checkpoints. Missing
-- day seven on 6/7 was preserved, not guessed complete by the RPC.
update public.cwl_cloud_profiles set
 profile_json=public.test_cwl_profile(5,5,'2026-11'),revision=22
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role service_role;
do $t$ declare r jsonb;
begin
  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',22,'2026-12');
  if r->>'saved'<>'true' then raise exception '5/5 rejected: %',r;end if;
end $t$;
reset role;

update public.cwl_cloud_profiles set
 profile_json=public.test_cwl_profile(7,7,'2026-11'),revision=23
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role service_role;
do $t$ declare r jsonb;
begin
  r:=public.cwl_ownerless_cycle_checkpoint(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',23,'2026-12');
  if r->>'saved'<>'true' then raise exception '7/7 rejected: %',r;end if;
end $t$;
reset role;

do $t$
begin
 if (select count(*) from public.cwl_ownerless_cycle_checkpoints
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>4
 then raise exception 'wrong checkpoint count for saved revisions';end if;
 if (select count(*) from public.cwl_ownerless_cycle_checkpoints
     where clan_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>0
 then raise exception 'unverified tenant checkpoint';end if;
 if (select profile_json->>'testEdit'
     from public.cwl_ownerless_cycle_checkpoints
     where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and source_revision=20) is not null
 then raise exception 'original snapshot was overwritten';end if;
end $t$;
select 'PASS: atomic/immutable/tenant-isolated archive checkpoint' as result;
