-- Isolated PG17 owner clean-plan restore apply and malicious/dirty cases.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $verify_plan_apply$
DECLARE
  v_raw jsonb;
  v_source jsonb;
  v_target uuid:='88888888-8888-4888-8888-888888888888'::uuid;
  v_rollback uuid:='99999999-9999-4999-8999-999999999999'::uuid;
  v_locked uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_candidate uuid;
  v_rollback_candidate uuid;
  v_locked_candidate uuid;
  v_reply jsonb;
  v_before jsonb;
  v_after jsonb;
  v_modified jsonb;
  v_before_locks jsonb;
  v_before_live jsonb;
BEGIN
  v_raw:=public.cwl_export_owned_backup(
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid]);
  v_source:=pg_catalog.jsonb_build_object(
    'source_clan_id',v_raw->'clans'->0->>'source_clan_id',
    'clash_tag',v_raw->'clans'->0->>'clash_tag',
    'tables',pg_catalog.jsonb_build_object(
      'cwl_cloud_profiles',v_raw#>'{clans,0,tables,cwl_cloud_profiles}',
      'cwl_plan_review_state',v_raw#>'{clans,0,tables,cwl_plan_review_state}',
      'cwl_group_archives',v_raw#>'{clans,0,tables,cwl_group_archives}',
      'cwl_own_lineup_archives',v_raw#>'{clans,0,tables,cwl_own_lineup_archives}'
    )
  );
  IF v_source->'tables'->'cwl_cloud_profiles'->0->'profile_json'->'locks'->0->>'locked'<>'true' THEN
    RAISE EXCEPTION 'test source lacks protected played day';
  END IF;
  v_reply:=public.cwl_stage_portable_plan_recovery(
    v_target,v_source,5,true,'STAGE_PLAN_FOR_MANUAL_REVIEW');
  v_candidate:=(v_reply->>'candidate_id')::uuid;
  SELECT profile_json INTO v_before FROM public.cwl_cloud_profiles WHERE clan_id=v_target;
  v_before_locks:=v_before->'locks';
  v_before_live:=v_before->'cwlLive';

  v_reply:=public.cwl_apply_portable_pristine_plan(v_candidate,5,false,NULL);
  IF v_reply->>'scope'<>'pristine-plan-planning-only' OR
     v_reply->>'applied'<>'false' OR
     v_reply->>'target_is_empty'<>'true' OR
     v_reply->>'eligible_for_empty_target_apply'<>'true' OR
     v_reply->>'has_changes'<>'true' OR
     v_reply->>'protected_days'<>'0' OR
     v_reply->>'member_count'<>'1' OR
     v_reply->>'archives_preserved'<>'true' OR
     v_reply->>'locks_preserved'<>'true' THEN
     RAISE EXCEPTION 'wrong read-only clean-target preview %',v_reply;
  END IF;
  IF EXISTS(SELECT 1 FROM public.cwl_portable_plan_apply_checkpoints) THEN
    RAISE EXCEPTION 'preview unexpectedly wrote checkpoint';
  END IF;
  IF (SELECT profile_json FROM public.cwl_cloud_profiles WHERE clan_id=v_target)
       IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'preview unexpectedly modified active profile';
  END IF;
  BEGIN
    PERFORM public.cwl_apply_portable_pristine_plan(
      v_candidate,5,true,'WRONG_CONFIRMATION');
    RAISE EXCEPTION 'missing confirmation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  v_reply:=public.cwl_apply_portable_pristine_plan(
    v_candidate,5,true,'APPLY_TO_EMPTY_CWL_PLAN');
  IF v_reply->>'applied'<>'true'
     OR v_reply->>'result_revision'<>'6'
     OR v_reply->>'checkpoint_id' IS NULL
     OR v_reply->>'checkpoint_id'='null' THEN
    RAISE EXCEPTION 'real plan apply returned no revision/checkpoint %',v_reply;
  END IF;
  SELECT profile_json INTO v_after FROM public.cwl_cloud_profiles WHERE clan_id=v_target;
  IF (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=v_target)<>6
      OR v_after->'members' <> v_source->'tables'->'cwl_cloud_profiles'->0->'profile_json'->'members'
      OR v_after->'dayGoals' <> v_source->'tables'->'cwl_cloud_profiles'->0->'profile_json'->'dayGoals'
      OR v_after->'config' <> v_source->'tables'->'cwl_cloud_profiles'->0->'profile_json'->'config'
      OR v_after->'locks' IS DISTINCT FROM v_before_locks
      OR v_after->'archives' IS DISTINCT FROM v_before->'archives'
      OR v_after->'archivedMembers' IS DISTINCT FROM v_before->'archivedMembers'
      OR v_after->'cwlLive' IS DISTINCT FROM v_before_live
      OR v_after->'id' IS DISTINCT FROM v_before->'id'
      OR v_after->'name' IS DISTINCT FROM v_before->'name' THEN
    RAISE EXCEPTION 'source overwrote protected plan identity/locks/archives';
  END IF;
  IF (SELECT count(*) FROM public.cwl_portable_plan_apply_checkpoints WHERE clan_id=v_target)<>1
    OR (SELECT count(*) FROM public.cwl_portable_plan_apply_checkpoints
     WHERE clan_id=v_target AND candidate_id=v_candidate AND
       before_profile_json=v_before AND applied_profile_json=v_after AND
       before_revision=5 AND applied_revision=6 AND
       before_review_state->>'locked'='false')<>1 THEN
    RAISE EXCEPTION 'missing atomic before/after recovery checkpoint';
  END IF;
  IF EXISTS(SELECT 1 FROM public.cwl_own_lineup_archives WHERE clan_id=v_target)
     OR EXISTS(SELECT 1 FROM public.cwl_group_archives WHERE clan_id=v_target)
     OR EXISTS(SELECT 1 FROM public.cwl_stat_wars WHERE clan_id=v_target) THEN
    RAISE EXCEPTION 'collector-only archives or API evidence were forged from file';
  END IF;
  BEGIN
    PERFORM public.cwl_apply_portable_pristine_plan(
      v_candidate,5,true,'APPLY_TO_EMPTY_CWL_PLAN');
    RAISE EXCEPTION 'repeated restore incorrectly succeeded';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  IF (SELECT count(*) FROM public.cwl_portable_plan_apply_checkpoints WHERE clan_id=v_target)<>1 THEN
    RAISE EXCEPTION 'repeated restore duplicated checkpoint';
  END IF;

  -- Target that already has a played day is NEVER eligible; no mutation.
  v_reply:=public.cwl_stage_portable_plan_recovery(
    v_locked,v_source,5,true,'STAGE_PLAN_FOR_MANUAL_REVIEW');
  v_locked_candidate:=(v_reply->>'candidate_id')::uuid;
  v_reply:=public.cwl_apply_portable_pristine_plan(v_locked_candidate,5,false,NULL);
  IF v_reply->>'target_is_empty'<>'false' OR
      v_reply->>'eligible_for_empty_target_apply'<>'false' OR
      v_reply->>'protected_days'<>'1' THEN
    RAISE EXCEPTION 'protected day not rejected in preview %',v_reply;
  END IF;
  BEGIN
    PERFORM public.cwl_apply_portable_pristine_plan(
      v_locked_candidate,5,true,'APPLY_TO_EMPTY_CWL_PLAN');
    RAISE EXCEPTION 'protected played day incorrectly overwritten';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.cwl_portable_plan_apply_checkpoints
     WHERE clan_id=v_locked) THEN
    RAISE EXCEPTION 'blocked protected target received a checkpoint';
  END IF;

  -- The RLS-protected candidate table is not a trusted signature: a source
  -- with malformed duplicate member IDs MUST be rejected.
  v_modified:=pg_catalog.jsonb_set(v_source,
    '{tables,cwl_cloud_profiles,0,profile_json,members}',
    '[{"id":"SAME"},{"id":"SAME"}]'::jsonb);
  v_reply:=public.cwl_stage_portable_plan_recovery(
    v_rollback,v_modified,5,true,'STAGE_PLAN_FOR_MANUAL_REVIEW');
  v_rollback_candidate:=(v_reply->>'candidate_id')::uuid;
  BEGIN
    PERFORM public.cwl_apply_portable_pristine_plan(
      v_rollback_candidate,5,false,NULL);
    RAISE EXCEPTION 'duplicate source member IDs accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END IF;

  -- Create an independent clean target candidate with a deliberate trigger
  -- failure. It must happen after checkpoint creation and leave no trace.
  v_modified:=pg_catalog.jsonb_set(v_source,
    '{tables,cwl_cloud_profiles,0,profile_json,members,0,id}',
    '"FAIL_AFTER_CHECKPOINT"'::jsonb);
  -- An owner can only stage one unique candidate per source & target revision,
  -- so for the synthetic rollback test remove just the invalid candidate as
  -- superuser in test setup instead. See separate second DO section below.
  RAISE NOTICE 'PASS: clean plan applied, locks/archives preserved, private checkpoint, replay/played days/duplicate members rejected';
END
$verify_plan_apply$;
RESET ROLE;

-- Use the disposable DB superuser only to set up an independent rollback
-- candidate. The real apply is then performed as authenticated.
DELETE FROM public.cwl_portable_plan_recovery_candidates
WHERE clan_id='99999999-9999-4999-8999-999999999999'::uuid;
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $verify_rollback$
DECLARE
 v_raw jsonb;
 v_source jsonb;
 v_candidate uuid;
 v_preview jsonb;
 v_before jsonb;
BEGIN
 v_raw:=public.cwl_export_owned_backup(
   ARRAY['11111111-1111-4111-8111-111111111111'::uuid]);
 v_source:=pg_catalog.jsonb_build_object(
  'source_clan_id',v_raw->'clans'->0->>'source_clan_id',
  'clash_tag',v_raw->'clans'->0->>'clash_tag',
  'tables',pg_catalog.jsonb_build_object(
    'cwl_cloud_profiles',v_raw#>'{clans,0,tables,cwl_cloud_profiles}',
    'cwl_plan_review_state',v_raw#>'{clans,0,tables,cwl_plan_review_state}',
    'cwl_group_archives',v_raw#>'{clans,0,tables,cwl_group_archives}',
    'cwl_own_lineup_archives',v_raw#>'{clans,0,tables,cwl_own_lineup_archives}'
  )
 );
 v_source:=pg_catalog.jsonb_set(v_source,
   '{tables,cwl_cloud_profiles,0,profile_json,members,0,id}',
   '"FAIL_AFTER_CHECKPOINT"'::jsonb);
 v_preview:=public.cwl_stage_portable_plan_recovery(
   '99999999-9999-4999-8999-999999999999'::uuid,v_source,5,true,
   'STAGE_PLAN_FOR_MANUAL_REVIEW');
 v_candidate:=(v_preview->>'candidate_id')::uuid;
 SELECT profile_json INTO v_before FROM public.cwl_cloud_profiles
 WHERE clan_id='99999999-9999-4999-8999-999999999999'::uuid;
 BEGIN
   PERFORM public.cwl_apply_portable_pristine_plan(
    v_candidate,5,true,'APPLY_TO_EMPTY_CWL_PLAN');
   RAISE EXCEPTION 'synthetic trigger failure was ignored';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.cwl_portable_plan_apply_checkpoints
    WHERE clan_id='99999999-9999-4999-8999-999999999999'::uuid) OR
    (SELECT profile_json FROM public.cwl_cloud_profiles
     WHERE clan_id='99999999-9999-4999-8999-999999999999'::uuid)
    IS DISTINCT FROM v_before OR
    (SELECT revision FROM public.cwl_cloud_profiles
     WHERE clan_id='99999999-9999-4999-8999-999999999999'::uuid)<>5 THEN
   RAISE EXCEPTION 'failed profile update failed to rollback checkpoint+plan';
 END IF;
 -- RLS isolates the checkpoint from the OTHER signed-in owner.
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',
   '44444444-4444-4444-8444-444444444444',false);
 IF EXISTS(SELECT 1 FROM public.cwl_portable_plan_apply_checkpoints) THEN
   RAISE EXCEPTION 'foreign owner can read private plan-apply checkpoint';
 END IF;
 RAISE NOTICE 'PASS: late trigger failure atomically rolls back profile and checkpoint; foreign owner denied';
END
$verify_rollback$;
RESET ROLE;

DO $verify_plan_apply_security$
DECLARE v record;
BEGIN
 SELECT provolatile,prosecdef,proconfig INTO v FROM pg_catalog.pg_proc
 WHERE oid='public.cwl_apply_portable_pristine_plan(uuid,bigint,boolean,text)'::regprocedure;
 IF v.provolatile<>'v' OR v.prosecdef OR NOT EXISTS(
   SELECT 1 FROM pg_catalog.unnest(v.proconfig) AS s(value)
   WHERE pg_catalog.replace(s.value,'"','')='search_path='
 ) THEN RAISE EXCEPTION 'unsafe plan apply function volatility/security';END IF;
 IF has_function_privilege('anon',
   'public.cwl_apply_portable_pristine_plan(uuid,bigint,boolean,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
   'public.cwl_apply_portable_pristine_plan(uuid,bigint,boolean,text)','EXECUTE')
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.cwl_portable_plan_apply_checkpoints'::regclass)
 OR has_table_privilege('anon','public.cwl_portable_plan_apply_checkpoints','SELECT')
 OR has_table_privilege('authenticated','public.cwl_portable_plan_apply_checkpoints','UPDATE')
 OR has_table_privilege('authenticated','public.cwl_portable_plan_apply_checkpoints','DELETE')
 OR has_column_privilege('authenticated',
     'public.cwl_portable_plan_apply_checkpoints','actor_user_id','INSERT')
 OR has_column_privilege('authenticated',
     'public.cwl_portable_plan_apply_checkpoints','id','INSERT')
 OR has_table_privilege('authenticated','public.cwl_group_archives','INSERT')
 OR has_table_privilege('authenticated','public.cwl_own_lineup_archives','INSERT')
 THEN RAISE EXCEPTION 'plan checkpoint/RLS/collector archive grants are unsafe';END IF;
 RAISE NOTICE 'PASS: VOLATILE SECURITY INVOKER, no anon, append-only owner checkpoint and unchanged collector permissions';
END
$verify_plan_apply_security$;
