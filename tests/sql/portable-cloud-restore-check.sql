-- Isolated PostgreSQL 17 synthetic restore UAT; no hosted DB connection.
SET ROLE authenticated;
SET request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
DO $restore_test$
DECLARE
 v_original jsonb;
 v_new jsonb;
 v_backup jsonb;
 v_saved_war jsonb;
 v_import_war jsonb;
 v_import_payload jsonb;
 v_saved_attack jsonb;
 v_saved_missed jsonb;
 v_result jsonb;
 v_revision bigint := 4;
 v_wars_before integer;
 v_attacks_before integer;
 v_missed_before integer;
BEGIN
 v_original := public.cwl_export_owned_backup(
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid]);
 v_backup:=v_original->'clans'->0;
 SELECT value INTO v_saved_war
 FROM pg_catalog.jsonb_array_elements(v_backup->'tables'->'cwl_stat_wars') AS w(value)
 WHERE w.value->>'source'='api' AND w.value->>'war_key'='normal:war1';
 v_saved_attack:=v_backup->'tables'->'cwl_stat_attacks'->0;
 v_saved_missed:=v_backup->'tables'->'cwl_stat_missed'->0;
 -- Create an API-origin backup war; the server MUST downgrade its provenance.
 v_new:=pg_catalog.jsonb_set(v_saved_war,'{war_key}','"normal:restored3"'::jsonb);
 v_backup:=pg_catalog.jsonb_set(v_backup,'{tables,cwl_stat_wars}',
   pg_catalog.jsonb_build_array(v_new));
 v_backup:=pg_catalog.jsonb_set(v_backup,'{tables,cwl_stat_attacks}',
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_set(
     v_saved_attack,'{war_key}','"normal:restored3"'::jsonb)));
 v_backup:=pg_catalog.jsonb_set(v_backup,'{tables,cwl_stat_missed}',
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_set(
     v_saved_missed,'{war_key}','"normal:restored3"'::jsonb)));
 SELECT count(*) INTO v_wars_before FROM public.cwl_stat_wars
  WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid;
 SELECT count(*) INTO v_attacks_before FROM public.cwl_stat_attacks
  WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid;
 SELECT count(*) INTO v_missed_before FROM public.cwl_stat_missed
  WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid;
 -- A dry run must be identical to apply except for writing nothing.
 v_result:=public.cwl_restore_portable_facts_atomic(
  '11111111-1111-4111-8111-111111111111'::uuid,v_backup,v_revision,false,NULL);
 IF v_result->>'applied' <> 'false' OR
    v_result#>>'{wars,new}' <> '1' OR
    v_result#>>'{attacks,new}' <> '1' OR
    v_result#>>'{missed,new}' <> '1' OR
    v_result->>'scope' <> 'war-facts-only' OR
    (v_result->>'review_only_other_rows')::integer<1 OR
    v_result->>'api_wars_imported_as_unverified'<>'1' THEN
    RAISE EXCEPTION 'incorrect read-only preview: %',v_result;
 END IF;
 IF EXISTS (SELECT 1 FROM public.cwl_portable_restore_checkpoints
  WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid) THEN
   RAISE EXCEPTION 'dry-run must not create a checkpoint';
 END IF;
  IF (SELECT count(*) FROM public.cwl_stat_wars
     WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>v_wars_before THEN
    RAISE EXCEPTION 'preview unexpectedly mutated DB';
 END IF;
 BEGIN
   PERFORM public.cwl_restore_portable_facts_atomic(
    '11111111-1111-4111-8111-111111111111'::uuid,v_backup,v_revision,true,'wrong');
   RAISE EXCEPTION 'missing confirmation accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 v_result:=public.cwl_restore_portable_facts_atomic(
  '11111111-1111-4111-8111-111111111111'::uuid,v_backup,v_revision,true,
  'RESTORE_VERIFIED_WAR_FACTS');
 IF v_result->>'checkpoint_id' IS NULL OR
    v_result->>'checkpoint_id'='null' OR
    (SELECT count(*) FROM public.cwl_portable_restore_checkpoints
       WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>1 OR
    (SELECT count(*) FROM public.cwl_portable_restore_checkpoints
       WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid
         AND actor_user_id='33333333-3333-4333-8333-333333333333'::uuid
         AND profile_revision=4
         AND source_clan_id='11111111-1111-4111-8111-111111111111'::uuid
         AND previous_wars='[]'::jsonb AND previous_attacks='[]'::jsonb
         AND previous_missed='[]'::jsonb
         AND war_keys='["normal:restored3"]'::jsonb)<>1 THEN
   RAISE EXCEPTION 'missing or invalid pre-mutation checkpoint: %',v_result;
 END IF;
  IF v_result->>'applied'<>'true' OR
    (SELECT count(*) FROM public.cwl_stat_wars
       WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>v_wars_before+1 OR
    (SELECT count(*) FROM public.cwl_stat_attacks
       WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>v_attacks_before+1 OR
    (SELECT count(*) FROM public.cwl_stat_missed
       WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>v_missed_before+1 THEN
   RAISE EXCEPTION 'atomic apply did not restore exactly one set';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.cwl_stat_wars
   WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid
     AND war_key='normal:restored3' AND source='import'
     AND missed_log_complete IS false AND source_clash_tag IS NULL
 ) THEN
   RAISE EXCEPTION 'forgeable API origin was not downgraded';
 END IF;
 v_result:=public.cwl_restore_portable_facts_atomic(
  '11111111-1111-4111-8111-111111111111'::uuid,v_backup,v_revision,true,
  'RESTORE_VERIFIED_WAR_FACTS');
 IF (SELECT count(*) FROM public.cwl_portable_restore_checkpoints
       WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>1 THEN
   RAISE EXCEPTION 'idempotent re-import created duplicate checkpoint';
 END IF;
  IF v_result#>>'{wars,new}'<>'0' OR
    v_result#>>'{attacks,new}'<>'0' OR
    v_result#>>'{missed,new}'<>'0' OR
    v_result#>>'{wars,identical}'<>'1' OR
    v_result#>>'{attacks,identical}'<>'1' OR
    v_result#>>'{missed,identical}'<>'1' THEN
    RAISE EXCEPTION 'second restore duplicated data: %',v_result;
 END IF;
 -- A late failed attack validation must rollback a previously inserted war.
 v_new:=pg_catalog.jsonb_set(v_saved_war,'{war_key}','"normal:rollback4"'::jsonb);
 v_new:=pg_catalog.jsonb_set(v_backup,'{tables,cwl_stat_wars}',
   pg_catalog.jsonb_build_array(v_new));
 v_new:=pg_catalog.jsonb_set(v_new,'{tables,cwl_stat_missed}','[]'::jsonb);
 v_new:=pg_catalog.jsonb_set(v_new,'{tables,cwl_stat_attacks}',
   pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_set(
       pg_catalog.jsonb_set(v_saved_attack,'{war_key}','"normal:rollback4"'::jsonb),
       '{stars}','4'::jsonb)));
 BEGIN
   PERFORM public.cwl_restore_portable_facts_atomic(
     '11111111-1111-4111-8111-111111111111'::uuid,v_new,v_revision,true,
     'RESTORE_VERIFIED_WAR_FACTS');
   RAISE EXCEPTION 'bad stars wrongly committed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT count(*) FROM public.cwl_portable_restore_checkpoints
       WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>1 THEN
   RAISE EXCEPTION 'failed transaction kept an invalid checkpoint';
 END IF;
  IF EXISTS (
   SELECT 1 FROM public.cwl_stat_wars
   WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid
     AND war_key='normal:rollback4'
 ) THEN
   RAISE EXCEPTION 'rollback left partial war';
 END IF;
 -- Historical API row may NOT gain a new supposedly verified missed event.
 v_new:=pg_catalog.jsonb_set(v_backup,'{tables,cwl_stat_wars}',
   pg_catalog.jsonb_build_array(v_saved_war));
 v_new:=pg_catalog.jsonb_set(v_new,'{tables,cwl_stat_attacks}','[]'::jsonb);
 v_new:=pg_catalog.jsonb_set(v_new,'{tables,cwl_stat_missed}',
   pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_set(
       pg_catalog.jsonb_set(v_saved_missed,'{war_key}','"normal:war1"'::jsonb),
       '{player_tag}','"#QL8P"'::jsonb)));
 v_result:=public.cwl_restore_portable_facts_atomic(
  '11111111-1111-4111-8111-111111111111'::uuid,v_new,v_revision,false,NULL);
 IF v_result#>>'{missed,conflict}'<>'1' THEN
    RAISE EXCEPTION 'unverified new missed on original API war not flagged';
 END IF;
 BEGIN
   PERFORM public.cwl_restore_portable_facts_atomic(
     '11111111-1111-4111-8111-111111111111'::uuid,v_new,v_revision,true,
     'RESTORE_VERIFIED_WAR_FACTS');
   RAISE EXCEPTION 'API-missed injection incorrectly allowed';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 IF EXISTS (
   SELECT 1 FROM public.cwl_stat_missed
   WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid
     AND war_key='normal:war1' AND player_tag='#QL8P'
 ) THEN
    RAISE EXCEPTION 'unverified API missed row was inserted';
 END IF;
 -- Stale compare-and-swap, foreign tenant, tag mismatch, duplicate source.
 BEGIN
   PERFORM public.cwl_restore_portable_facts_atomic(
     '11111111-1111-4111-8111-111111111111'::uuid,v_backup,3,false,NULL);
   RAISE EXCEPTION 'stale plan revision accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_restore_portable_facts_atomic(
     '22222222-2222-4222-8222-222222222222'::uuid,v_backup,1,false,NULL);
   RAISE EXCEPTION 'foreign clan accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_restore_portable_facts_atomic(
     '55555555-5555-4555-8555-555555555555'::uuid,v_backup,3,false,NULL);
   RAISE EXCEPTION 'mismatched Clash clan tag accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 v_new:=pg_catalog.jsonb_set(v_backup,'{tables,cwl_stat_wars}',
   pg_catalog.jsonb_build_array(
     v_backup->'tables'->'cwl_stat_wars'->0,
     v_backup->'tables'->'cwl_stat_wars'->0));
 BEGIN
   PERFORM public.cwl_restore_portable_facts_atomic(
     '11111111-1111-4111-8111-111111111111'::uuid,v_new,4,false,NULL);
   RAISE EXCEPTION 'duplicate war keys accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 -- A novel attack on an existing unverified import war is permitted and the
 -- checkpoint MUST retain that war's actual prior row for later review.
 SELECT value INTO v_import_war
 FROM pg_catalog.jsonb_array_elements(v_original->'clans'->0->'tables'->'cwl_stat_wars') AS w(value)
 WHERE w.value->>'war_key'='cwl:war2' AND w.value->>'source'='import';
 IF v_import_war IS NULL THEN RAISE EXCEPTION 'missing synthetic imported war'; END IF;
 v_import_payload:=pg_catalog.jsonb_set(v_original->'clans'->0,'{tables,cwl_stat_wars}',
   pg_catalog.jsonb_build_array(v_import_war));
 v_import_payload:=pg_catalog.jsonb_set(v_import_payload,'{tables,cwl_stat_attacks}',
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_set(
     v_saved_attack,'{war_key}','"cwl:war2"'::jsonb)));
 v_import_payload:=pg_catalog.jsonb_set(v_import_payload,'{tables,cwl_stat_missed}',
    '[]'::jsonb);
 v_result:=public.cwl_restore_portable_facts_atomic(
  '11111111-1111-4111-8111-111111111111'::uuid,v_import_payload,4,true,
  'RESTORE_VERIFIED_WAR_FACTS');
 IF v_result#>>'{attacks,new}'<>'1' OR
   (SELECT count(*) FROM public.cwl_portable_restore_checkpoints
    WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid)<>2 OR
   NOT EXISTS (
    SELECT 1 FROM public.cwl_portable_restore_checkpoints
    WHERE id=(v_result->>'checkpoint_id')::uuid
      AND pg_catalog.jsonb_array_length(previous_wars)=1
      AND previous_wars->0->>'war_key'='cwl:war2'
      AND pg_catalog.jsonb_array_length(previous_attacks)=0
      AND pg_catalog.jsonb_array_length(previous_missed)=0
   ) THEN
   RAISE EXCEPTION 'checkpoint did not save real preexisting imported war: %',v_result;
 END IF;
 -- Verify actual user-scoped SELECT cannot enumerate the other owner's
 -- checkpoints, even when the same role is authenticated.
 PERFORM set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',false);
 IF EXISTS (SELECT 1 FROM public.cwl_portable_restore_checkpoints)
 THEN RAISE EXCEPTION 'foreign owner leaked checkpoint'; END IF;
 PERFORM set_config('request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',false);
 RAISE NOTICE 'PASS: owner-only preflight, atomic insert, repeat import idempotent, rollback and API provenance defenses';
END;
$restore_test$;
RESET ROLE;
DO $restore_catalog$
DECLARE v record;
BEGIN
 SELECT provolatile,prosecdef,proconfig INTO v
 FROM pg_proc
 WHERE oid='public.cwl_restore_portable_facts_atomic(uuid,jsonb,bigint,boolean,text)'::regprocedure;
 IF v.provolatile<>'v' OR v.prosecdef OR NOT EXISTS (
   SELECT 1 FROM unnest(v.proconfig) AS s(value)
   WHERE replace(s.value,'"','')='search_path='
 ) THEN RAISE EXCEPTION 'restore RPC not VOLATILE SECURITY INVOKER / safe search_path';END IF;
 IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c
     WHERE c.oid='public.cwl_portable_restore_checkpoints'::regclass)
    OR has_table_privilege('anon','public.cwl_portable_restore_checkpoints','SELECT')
    OR has_table_privilege('anon','public.cwl_portable_restore_checkpoints','INSERT')
    OR has_table_privilege('authenticated','public.cwl_portable_restore_checkpoints','UPDATE')
    OR has_table_privilege('authenticated','public.cwl_portable_restore_checkpoints','DELETE') THEN
   RAISE EXCEPTION 'restore checkpoint grants/RLS invalid';
 END IF;
  IF has_function_privilege('anon',
      'public.cwl_restore_portable_facts_atomic(uuid,jsonb,bigint,boolean,text)',
      'EXECUTE') OR
    NOT has_function_privilege('authenticated',
      'public.cwl_restore_portable_facts_atomic(uuid,jsonb,bigint,boolean,text)',
      'EXECUTE') THEN
   RAISE EXCEPTION 'restore RPC roles unsafe';
 END IF;
 RAISE NOTICE 'PASS: VOLATILE SECURITY INVOKER and authenticated-only RPC';
END;
$restore_catalog$;
