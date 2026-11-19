-- Real PG17 synthetic-only plan/archive preview and candidate staging.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $test_plan_recovery$
DECLARE
 v_full jsonb;
 v_source jsonb;
 v_modified jsonb;
 v_row jsonb;
 v_first jsonb;
 v_second jsonb;
 v_preview jsonb;
 v_before jsonb;
 v_id uuid;
 v_after_count integer;
BEGIN
 v_full := public.cwl_export_owned_backup(
   ARRAY['11111111-1111-4111-8111-111111111111'::uuid]);
 v_source := pg_catalog.jsonb_build_object(
  'source_clan_id',v_full->'clans'->0->>'source_clan_id',
  'clash_tag',v_full->'clans'->0->>'clash_tag',
  'tables',pg_catalog.jsonb_build_object(
    'cwl_cloud_profiles',v_full#>'{clans,0,tables,cwl_cloud_profiles}',
    'cwl_plan_review_state',v_full#>'{clans,0,tables,cwl_plan_review_state}',
    'cwl_group_archives',v_full#>'{clans,0,tables,cwl_group_archives}',
    'cwl_own_lineup_archives',v_full#>'{clans,0,tables,cwl_own_lineup_archives}'
  )
 );
 SELECT profile_json INTO v_before FROM public.cwl_cloud_profiles
 WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid;
 v_preview := public.cwl_stage_portable_plan_recovery(
  '11111111-1111-4111-8111-111111111111'::uuid,v_source,4,false,NULL);
 IF v_preview->>'scope'<>'plan-archive-review-only'
    OR v_preview->>'staged'<>'false'
    OR v_preview->>'mutation_permitted'<>'false'
    OR v_preview->>'plan_identical'<>'true'
    OR v_preview->>'active_plan_modified'<>'false'
    OR v_preview->>'archives_modified'<>'false'
    OR v_preview->>'target_protected_days'<>'1'
    OR v_preview#>>'{group_archives,identical}'<>'1'
    OR v_preview#>>'{own_lineup_archives,identical}'<>'1'
    OR v_preview->>'review_state_conflict'<>'false'
 THEN
   RAISE EXCEPTION 'incorrect plan/archives preview %',v_preview;
 END IF;
 IF EXISTS(SELECT 1 FROM public.cwl_portable_plan_recovery_candidates) THEN
   RAISE EXCEPTION 'preview unexpectedly staged a candidate';
 END IF;
 -- A source with different plan details is a proposal only, not an overwrite.
 v_modified:=pg_catalog.jsonb_set(v_source,
    '{tables,cwl_cloud_profiles,0,profile_json,name}',
    '"Restored plan candidate"'::jsonb);
 v_first:=public.cwl_stage_portable_plan_recovery(
  '11111111-1111-4111-8111-111111111111'::uuid,v_modified,4,true,
  'STAGE_PLAN_FOR_MANUAL_REVIEW');
 IF v_first->>'staged'<>'true' OR
    v_first->>'plan_identical'<>'false' OR
    v_first->>'active_plan_modified'<>'false' OR
    v_first->>'archives_modified'<>'false' OR
    v_first->>'mutation_permitted'<>'false' OR
    v_first->>'candidate_id' IS NULL OR
    v_first->>'candidate_id'='null' THEN
   RAISE EXCEPTION 'plan staging returned unexpected result %',v_first;
 END IF;
 v_id:=(v_first->>'candidate_id')::uuid;
 IF (SELECT count(*) FROM public.cwl_portable_plan_recovery_candidates)<>1 OR
    (SELECT count(*) FROM public.cwl_portable_plan_recovery_candidates
       WHERE id=v_id AND actor_user_id=
        '33333333-3333-4333-8333-333333333333'::uuid
         AND target_revision=4
         AND source_revision=4
         AND (target_before->'profile_json')=v_before
         AND target_before->'review_state'->>'locked'='true'
         AND pg_catalog.jsonb_array_length(
           target_before->'group_archives')=1
         AND pg_catalog.jsonb_array_length(
           target_before->'own_lineup_archives')=1)<>1 THEN
   RAISE EXCEPTION 'candidate lost actual protected target before-state';
 END IF;
 IF (SELECT profile_json FROM public.cwl_cloud_profiles
    WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)
    IS DISTINCT FROM v_before THEN
   RAISE EXCEPTION 'staging overwrote an active locked or played plan';
 END IF;
 v_second:=public.cwl_stage_portable_plan_recovery(
  '11111111-1111-4111-8111-111111111111'::uuid,v_modified,4,true,
  'STAGE_PLAN_FOR_MANUAL_REVIEW');
 IF v_second->>'candidate_id'<>v_id::text OR
   (SELECT count(*) FROM public.cwl_portable_plan_recovery_candidates)<>1 THEN
   RAISE EXCEPTION 'staging repeated an identical candidate';
 END IF;
 -- Same source revision but different bytes cannot silently overwrite it.
 v_row:=pg_catalog.jsonb_set(v_modified,
    '{tables,cwl_cloud_profiles,0,profile_json,name}',
    '"Tampered different source payload"'::jsonb);
 BEGIN
  PERFORM public.cwl_stage_portable_plan_recovery(
   '11111111-1111-4111-8111-111111111111'::uuid,v_row,4,true,
   'STAGE_PLAN_FOR_MANUAL_REVIEW');
  RAISE EXCEPTION 'changed same-revision candidate was accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 -- Protected archives cannot be reverted: detect conflicting verified lineup.
 v_row:=pg_catalog.jsonb_set(v_source,
    '{tables,cwl_own_lineup_archives,0,state}','"inWar"'::jsonb);
 v_preview:=public.cwl_stage_portable_plan_recovery(
  '11111111-1111-4111-8111-111111111111'::uuid,v_row,4,false,NULL);
 IF v_preview#>>'{own_lineup_archives,conflict}'<>'1' THEN
    RAISE EXCEPTION 'ended lineup downgrade was not called a conflict';
 END IF;
 -- A missing archive is a possible candidate, never an authenticated write.
 v_row:=pg_catalog.jsonb_set(v_source,'{tables,cwl_group_archives}',
  pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(
        v_source->'tables'->'cwl_group_archives'->0,
        '{season}','"2026-10"'::jsonb),
      '{group_json,season}','"2026-10"'::jsonb)
  ));
 v_preview:=public.cwl_stage_portable_plan_recovery(
  '11111111-1111-4111-8111-111111111111'::uuid,v_row,4,false,NULL);
 IF v_preview#>>'{group_archives,new}'<>'1' OR
    (SELECT count(*) FROM public.cwl_group_archives
      WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>1 THEN
    RAISE EXCEPTION 'preview inserted an archive or missed new candidate';
 END IF;
 -- Wrong tag, forged source clan, stale CAS and missing confirmation fail closed.
 v_row:=pg_catalog.jsonb_set(v_source,'{clash_tag}','"#QL8P"'::jsonb);
 BEGIN
  PERFORM public.cwl_stage_portable_plan_recovery(
   '11111111-1111-4111-8111-111111111111'::uuid,v_row,4,false,NULL);
  RAISE EXCEPTION 'wrong clan tag accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 v_row:=pg_catalog.jsonb_set(v_source,
  '{tables,cwl_cloud_profiles,0,clan_id}',
  '"44444444-4444-4444-8444-444444444444"'::jsonb);
 BEGIN
  PERFORM public.cwl_stage_portable_plan_recovery(
   '11111111-1111-4111-8111-111111111111'::uuid,v_row,4,false,NULL);
  RAISE EXCEPTION 'foreign source row accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
  PERFORM public.cwl_stage_portable_plan_recovery(
   '11111111-1111-4111-8111-111111111111'::uuid,v_source,3,false,NULL);
  RAISE EXCEPTION 'stale plan revision accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 BEGIN
  PERFORM public.cwl_stage_portable_plan_recovery(
   '11111111-1111-4111-8111-111111111111'::uuid,v_source,4,true,'yes');
  RAISE EXCEPTION 'missing confirmation accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.cwl_stage_portable_plan_recovery(
   '22222222-2222-4222-8222-222222222222'::uuid,v_source,1,false,NULL);
  RAISE EXCEPTION 'foreign target accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 -- Unauthorized owner cannot read an already-staged candidate, including
 -- when logged in as another account with the same PostgreSQL role.
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',false);
 IF EXISTS (SELECT 1 FROM public.cwl_portable_plan_recovery_candidates)
 THEN RAISE EXCEPTION 'foreign owner could read private candidate'; END IF;
 PERFORM pg_catalog.set_config('request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',false);
 RAISE NOTICE 'PASS: owner plan preview, protected days, archive conflicts, immutable private staging and idempotence';
END;
$test_plan_recovery$;
RESET ROLE;
DO $check_plan_security$
DECLARE v record;
BEGIN
 SELECT provolatile,prosecdef,proconfig INTO v
 FROM pg_catalog.pg_proc
 WHERE oid='public.cwl_stage_portable_plan_recovery(uuid,jsonb,bigint,boolean,text)'::regprocedure;
 IF v.provolatile<>'v' OR v.prosecdef OR NOT EXISTS(
    SELECT 1 FROM pg_catalog.unnest(v.proconfig) AS s(value)
    WHERE pg_catalog.replace(s.value,'"','')='search_path='
 ) THEN RAISE EXCEPTION 'unsafe plan staging RPC metadata'; END IF;
 IF has_function_privilege('anon',
   'public.cwl_stage_portable_plan_recovery(uuid,jsonb,bigint,boolean,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
   'public.cwl_stage_portable_plan_recovery(uuid,jsonb,bigint,boolean,text)','EXECUTE')
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid='public.cwl_portable_plan_recovery_candidates'::regclass)
 OR has_table_privilege('anon','public.cwl_portable_plan_recovery_candidates','SELECT')
 OR has_table_privilege('authenticated','public.cwl_portable_plan_recovery_candidates','UPDATE')
 OR has_table_privilege('authenticated','public.cwl_portable_plan_recovery_candidates','DELETE')
 OR has_column_privilege('authenticated',
   'public.cwl_portable_plan_recovery_candidates','actor_user_id','INSERT')
 OR has_column_privilege('authenticated',
   'public.cwl_portable_plan_recovery_candidates','id','INSERT') THEN
   RAISE EXCEPTION 'plan candidate RLS/grants weakened';
 END IF;
 IF has_table_privilege('authenticated','public.cwl_group_archives','INSERT')
   OR has_table_privilege('authenticated','public.cwl_own_lineup_archives','INSERT')
 THEN RAISE EXCEPTION 'official collector-only archives became user-writable'; END IF;
 RAISE NOTICE 'PASS: invoker/RLS owner-only candidate, archive writes remain collector-only';
END;
$check_plan_security$;
