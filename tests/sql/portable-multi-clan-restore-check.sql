-- Isolated PostgreSQL 17: source file has TWO different Clash clan tags,
-- original current owner and a SINGLE private SQL witness. We prove ALL OR
-- NOTHING across 17 datasets per clan. Never run against live user data.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
CREATE TEMP TABLE original_multi_receipt AS
 SELECT q.r->'snapshot' AS payload,
   (q.r->'server_receipt'->>'id')::uuid AS receipt
 FROM (SELECT public.cwl_issue_owned_backup_witness(ARRAY[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '55555555-5555-4555-8555-555555555555'::uuid
 ]) AS r) q;

DO $happy_path$
DECLARE
 p jsonb;w uuid;preview jsonb;applied jsonb;
 targets uuid[]:=ARRAY[
  '88888888-8888-4888-8888-888888888888'::uuid,
  'abababab-abab-4bab-8bab-abababababab'::uuid];
 sha text[];
BEGIN
 SELECT payload,receipt INTO p,w FROM original_multi_receipt;
 IF pg_catalog.jsonb_array_length(p->'clans')<>2
    OR p#>>'{clans,0,clash_tag}'<>'#P8Y2'
    OR p#>>'{clans,1,clash_tag}'<>'#QL8P'
    OR (SELECT count(*) FROM private.cwl_portable_backup_witnesses)<>1 THEN
  RAISE EXCEPTION 'The original two-clan export lacks one genuine receipt';
 END IF;
 preview:=public.cwl_restore_witnessed_multi_clans(
  w,p,targets,ARRAY[1,1]::bigint[],NULL,false,NULL);
 IF preview->>'scope'<>'verified-multi-pristine-clan-17-datasets'
  OR (preview->>'source_clan_count')::integer<>2
  OR (preview->>'target_clan_count')::integer<>2
  OR preview->>'applied'<>'false'
  OR preview->>'mutation_permitted'<>'false'
  OR preview->>'public_full_restore_available'<>'false'
  OR pg_catalog.jsonb_array_length(preview->'previews')<>2
  OR (preview#>>'{previews,0,restored_table_count}')::integer<>17
  OR (preview#>>'{previews,1,restored_table_count}')::integer<>17
  OR (preview#>>'{previews,0,source_locked_days}')::integer<>1
  OR (preview#>>'{previews,1,source_locked_days}')::integer<>1
  OR (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>0
  OR (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>0
 THEN RAISE EXCEPTION 'Two-clan no-write preview failed: %',preview;END IF;
 sha:=ARRAY[
   preview#>>'{previews,0,target_fingerprint}',
   preview#>>'{previews,1,target_fingerprint}'];
 applied:=public.cwl_restore_witnessed_multi_clans(
   w,p,targets,ARRAY[1,1]::bigint[],sha,true,
   'RESTORE_ALL_VERIFIED_EMPTY_CLANS');
 IF applied->>'applied'<>'true'
    OR (applied->>'source_clan_count')::integer<>2
    OR pg_catalog.jsonb_array_length(applied->'restores')<>2
    OR (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>1
    OR (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>2
    OR NOT EXISTS(SELECT 1 FROM public.cwl_cloud_profiles
       WHERE clan_id=targets[1] AND revision=2
         AND profile_json#>>'{locks,0,locked}'='true')
    OR NOT EXISTS(SELECT 1 FROM public.cwl_cloud_profiles
       WHERE clan_id=targets[2] AND revision=2
         AND profile_json#>>'{locks,1,locked}'='true')
    OR NOT EXISTS(SELECT 1 FROM public.cwl_plan_review_state
       WHERE clan_id=targets[1] AND locked)
    OR NOT EXISTS(SELECT 1 FROM public.cwl_plan_review_state
       WHERE clan_id=targets[2] AND locked)
    OR (SELECT count(*) FROM public.cwl_stat_attacks
       WHERE clan_id=targets[1])<>2
    OR (SELECT count(*) FROM public.cwl_stat_attacks
       WHERE clan_id=targets[2])<>1
    OR NOT EXISTS(SELECT 1 FROM public.cwl_stat_attacks
       WHERE clan_id=targets[1] AND stars=3 AND destruction=100)
    OR NOT EXISTS(SELECT 1 FROM public.cwl_stat_attacks
       WHERE clan_id=targets[2] AND stars=3 AND destruction=100)
    OR (SELECT count(*) FROM public.cwl_own_lineup_archives
       WHERE clan_id IN (targets[1],targets[2]))<>2
    OR (SELECT count(*) FROM public.cwl_group_archives
       WHERE clan_id IN (targets[1],targets[2]))<>2 THEN
   RAISE EXCEPTION 'One or both original CWL profiles/attacks/archives missing: %',applied;
 END IF;
 -- Source order is preserved and all checkpoint identities are grouped.
 IF (SELECT target_clan_ids FROM private.cwl_portable_multi_clan_recovery_sessions
      LIMIT 1) IS DISTINCT FROM targets OR
   (SELECT pg_catalog.cardinality(checkpoint_ids)
     FROM private.cwl_portable_multi_clan_recovery_sessions LIMIT 1)<>2 THEN
    RAISE EXCEPTION 'Original all-or-nothing group checkpoint mapping lost';END IF;
 RAISE NOTICE 'PASS: one signed source/one transaction restored two different Clash tags with all 34 dataset instances and one durable group manifest';
END $happy_path$;

-- All invalid calls must fail before any writing; an active SECOND target
-- also prevents the first (otherwise clean) target from changing.
DO $preflight_denials$
DECLARE p jsonb;w uuid;
 targets uuid[]:=ARRAY[
  '99999999-9999-4999-8999-999999999999'::uuid,
  'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'::uuid];
 v bigint;
BEGIN
 SELECT payload,receipt INTO p,w FROM original_multi_receipt;
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
    w,p,targets,ARRAY[1,1]::bigint[],NULL,false,NULL);
  RAISE EXCEPTION 'Active second clan was not blocked';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 IF (SELECT revision FROM public.cwl_cloud_profiles
   WHERE clan_id=targets[1])<>1 THEN RAISE EXCEPTION 'First clan modified in preflight';END IF;
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
    w,p,ARRAY[targets[1],targets[1]]::uuid[],
    ARRAY[1,1]::bigint[],NULL,false,NULL);
  RAISE EXCEPTION 'Duplicate target accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
    w,p,ARRAY[targets[2],targets[1]]::uuid[],
    ARRAY[1,1]::bigint[],NULL,false,NULL);
  RAISE EXCEPTION 'Swapped opposite-Clash-tag target accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
    w,p,ARRAY[targets[1],'abababab-abab-4bab-8bab-abababababab'::uuid],
    ARRAY[1,1]::bigint[],ARRAY[repeat('0',64),repeat('0',64)]::text[],
    true,'RESTORE_ALL_VERIFIED_EMPTY_CLANS');
  RAISE EXCEPTION 'Used second target or stale SHA accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
    w,pg_catalog.jsonb_set(p,
       '{clans,1,tables,cwl_stat_attacks,0,stars}','0'::jsonb),
    ARRAY[targets[1],'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid],
    ARRAY[1,1]::bigint[],NULL,false,NULL);
  RAISE EXCEPTION 'Tampered second original stars accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
   w,p,ARRAY[targets[1],'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid],
   ARRAY[1,1]::bigint[],ARRAY[repeat('0',64),repeat('0',64)]::text[],
   true,'YES');
  RAISE EXCEPTION 'Unconfirmed multi-clan import accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>1
  OR (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>2
 THEN RAISE EXCEPTION 'Rejected preflights mutated checkpoints';END IF;
 RAISE NOTICE 'PASS: active second clan, swapped mapping, duplicates, stale SHA, forged API stars and missing confirmation denied';
END $preflight_denials$;
RESET ROLE;

-- Simulate a late insert error on the SECOND tenant, after the first tenant
-- has already restored its entire plan, archives, facts and audit. PostgreSQL
-- must undo both tenants and all checkpoints in this SAME RPC transaction.
CREATE OR REPLACE FUNCTION public.synthetic_multi_restore_late_error()
RETURNS trigger LANGUAGE plpgsql AS $late$
BEGIN
 IF NEW.clan_id='bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid THEN
   RAISE EXCEPTION 'synthetic second clan late-archive error';END IF;
 RETURN NEW;
END $late$;
CREATE TRIGGER synthetic_multi_restore_late_error
 BEFORE INSERT ON public.cwl_clan_review_decisions
 FOR EACH ROW EXECUTE FUNCTION public.synthetic_multi_restore_late_error();
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $atomic_rollback$
DECLARE p jsonb;w uuid;prev jsonb;
 targets uuid[]:=ARRAY[
  '99999999-9999-4999-8999-999999999999'::uuid,
  'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid];
 sha text[];
BEGIN
 SELECT payload,receipt INTO p,w FROM original_multi_receipt;
 prev:=public.cwl_restore_witnessed_multi_clans(
  w,p,targets,ARRAY[1,1]::bigint[],NULL,false,NULL);
 sha:=ARRAY[prev#>>'{previews,0,target_fingerprint}',
  prev#>>'{previews,1,target_fingerprint}'];
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
   w,p,targets,ARRAY[1,1]::bigint[],sha,true,
   'RESTORE_ALL_VERIFIED_EMPTY_CLANS');
  RAISE EXCEPTION 'Synthetic late target failure did not abort';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Synthetic late target failure did not abort' THEN RAISE;END IF;
 END;
 IF (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=targets[1])<>1
   OR (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=targets[2])<>1
   OR (SELECT count(*) FROM public.cwl_stat_wars
       WHERE clan_id IN (targets[1],targets[2]))<>0
   OR (SELECT count(*) FROM public.cwl_stat_attacks
       WHERE clan_id IN (targets[1],targets[2]))<>0
   OR (SELECT count(*) FROM public.cwl_own_lineup_archives
       WHERE clan_id IN (targets[1],targets[2]))<>0
   OR (SELECT count(*) FROM public.cwl_change_events
       WHERE clan_id IN (targets[1],targets[2]))<>0
   OR (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>1
   OR (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>2 THEN
  RAISE EXCEPTION 'A late error leaked earlier tenant changes/checkpoints';
 END IF;
 RAISE NOTICE 'PASS: second tenant late SQL failure rolled back the first tenant profile, wars, attacks, audit and both checkpoints';
END $atomic_rollback$;
RESET ROLE;
DROP TRIGGER synthetic_multi_restore_late_error ON public.cwl_clan_review_decisions;
DROP FUNCTION public.synthetic_multi_restore_late_error();

-- A silent source-evidence mutation in the second tenant must ALSO trigger
-- a complete rollback, including previously restored first-tenant data.
CREATE OR REPLACE FUNCTION public.synthetic_multi_corrupt_stars()
RETURNS trigger LANGUAGE plpgsql AS $stars$
BEGIN
 IF NEW.clan_id='bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid
  THEN NEW.stars:=0;END IF;
 RETURN NEW;
END $stars$;
CREATE TRIGGER synthetic_multi_corrupt_stars
 BEFORE INSERT ON public.cwl_stat_attacks
 FOR EACH ROW EXECUTE FUNCTION public.synthetic_multi_corrupt_stars();
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $silent_integrity_rollback$
DECLARE p jsonb;w uuid;prev jsonb;
 targets uuid[]:=ARRAY[
  '99999999-9999-4999-8999-999999999999'::uuid,
  'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid];
 sha text[];
BEGIN
 SELECT payload,receipt INTO p,w FROM original_multi_receipt;
 prev:=public.cwl_restore_witnessed_multi_clans(
  w,p,targets,ARRAY[1,1]::bigint[],NULL,false,NULL);
 sha:=ARRAY[prev#>>'{previews,0,target_fingerprint}',
   prev#>>'{previews,1,target_fingerprint}'];
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
   w,p,targets,ARRAY[1,1]::bigint[],sha,true,
   'RESTORE_ALL_VERIFIED_EMPTY_CLANS');
  RAISE EXCEPTION 'Silent second tenant stars mutation was accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 IF (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=targets[1])<>1
   OR (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=targets[2])<>1
   OR (SELECT count(*) FROM public.cwl_stat_wars
      WHERE clan_id IN (targets[1],targets[2]))<>0
   OR (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>1
   OR (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>2 THEN
   RAISE EXCEPTION 'Silent second tenant attack mutation left an earlier tenant changed';
 END IF;
 RAISE NOTICE 'PASS: a silent change to the second tenant API stars aborts all restored tenants';
END $silent_integrity_rollback$;
RESET ROLE;
DROP TRIGGER synthetic_multi_corrupt_stars ON public.cwl_stat_attacks;
DROP FUNCTION public.synthetic_multi_corrupt_stars();

-- The saved original receipt survives deletion of BOTH original clans. The
-- source file alone is insufficient; this test reuses the protected receipt.
DO $delete_both_original_clans$
DECLARE t text; ids uuid[]:=ARRAY[
  '11111111-1111-4111-8111-111111111111'::uuid,
  '55555555-5555-4555-8555-555555555555'::uuid];
BEGIN
 FOREACH t IN ARRAY ARRAY[
 'cwl_clan_review_decisions','cwl_clan_donation_observations',
 'cwl_clan_absence_observations','cwl_clan_member_tenure',
 'cwl_clan_cw_missed_decisions','cwl_missed_owner_decisions',
 'cwl_profile_snapshots','cwl_change_events','cwl_plan_suggestions',
 'cwl_own_lineup_archives','cwl_group_archives','cwl_clan_management_rules',
 'cwl_plan_review_state','cwl_stat_attacks','cwl_stat_missed',
 'cwl_stat_wars','cwl_cloud_profiles'
 ] LOOP
  EXECUTE pg_catalog.format('DELETE FROM public.%I WHERE clan_id=ANY($1)',t)
    USING ids;
 END LOOP;
 DELETE FROM public.cwl_clan_memberships WHERE clan_id=ANY(ids);
 DELETE FROM public.cwl_clans WHERE id=ANY(ids);
END $delete_both_original_clans$;
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $fully_deleted_multi_original$
DECLARE p jsonb;w uuid;prev jsonb;applied jsonb;
 targets uuid[]:=ARRAY[
  '99999999-9999-4999-8999-999999999999'::uuid,
  'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid];
 sha text[];
BEGIN
 SELECT payload,receipt INTO p,w FROM original_multi_receipt;
 IF EXISTS(SELECT 1 FROM public.cwl_clans
   WHERE id IN ('11111111-1111-4111-8111-111111111111'::uuid,
                '55555555-5555-4555-8555-555555555555'::uuid))
 THEN RAISE EXCEPTION 'Original clan loss simulation not complete';END IF;
 prev:=public.cwl_restore_witnessed_multi_clans(
  w,p,targets,ARRAY[1,1]::bigint[],NULL,false,NULL);
 sha:=ARRAY[prev#>>'{previews,0,target_fingerprint}',
   prev#>>'{previews,1,target_fingerprint}'];
 applied:=public.cwl_restore_witnessed_multi_clans(
  w,p,targets,ARRAY[1,1]::bigint[],sha,true,
  'RESTORE_ALL_VERIFIED_EMPTY_CLANS');
 IF applied->>'applied'<>'true'
   OR (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>2
   OR (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>4
   OR (SELECT count(*) FROM public.cwl_stat_attacks
        WHERE clan_id=targets[1])<>2
   OR (SELECT count(*) FROM public.cwl_stat_attacks
        WHERE clan_id=targets[2])<>1
   OR NOT EXISTS(SELECT 1 FROM public.cwl_cloud_profiles
        WHERE clan_id=targets[1] AND revision=2
          AND profile_json#>>'{locks,0,locked}'='true')
   OR NOT EXISTS(SELECT 1 FROM public.cwl_cloud_profiles
        WHERE clan_id=targets[2] AND revision=2
          AND profile_json#>>'{locks,1,locked}'='true') THEN
  RAISE EXCEPTION 'Multi-clan restore after deleting both source clans failed';
 END IF;
 RAISE NOTICE 'PASS: both source clans entirely deleted, original private witness survives, both protected CWL plans and all source facts recovered in one operation';
END $fully_deleted_multi_original$;
RESET ROLE;

-- Removed owner from just ONE target: original actor must lose access to the
-- WHOLE multi-clan group checkpoint, despite still owning its other target.
UPDATE public.cwl_clan_memberships SET role='viewer'
 WHERE clan_id='abababab-abab-4bab-8bab-abababababab'::uuid
  AND user_id='33333333-3333-4333-8333-333333333333';
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $revoked_one_target$
BEGIN
 IF (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>1
 THEN RAISE EXCEPTION 'Group record leaked after one target owner was revoked';END IF;
 RAISE NOTICE 'PASS: one revoked target hides that entire original group checkpoint';
END $revoked_one_target$;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $other_user$
DECLARE p jsonb;w uuid;
BEGIN
 SELECT payload,receipt INTO p,w FROM original_multi_receipt;
 BEGIN
  PERFORM public.cwl_restore_witnessed_multi_clans(
   w,p,ARRAY[
    '99999999-9999-4999-8999-999999999999'::uuid,
    'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc'::uuid
   ],ARRAY[2,2]::bigint[],NULL,false,NULL);
  RAISE EXCEPTION 'Foreign user accessed a signed multi-clan payload';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF (SELECT count(*) FROM private.cwl_portable_multi_clan_recovery_sessions)<>0
 THEN RAISE EXCEPTION 'Foreign user read private group checkpoint'; END IF;
END $other_user$;
RESET ROLE;
DO $permissions$
BEGIN
 IF has_function_privilege('anon',
  'public.cwl_restore_witnessed_multi_clans(uuid,jsonb,uuid[],bigint[],text[],boolean,text)',
   'EXECUTE')
 OR NOT has_function_privilege('authenticated',
  'public.cwl_restore_witnessed_multi_clans(uuid,jsonb,uuid[],bigint[],text[],boolean,text)',
   'EXECUTE')
 OR has_function_privilege('authenticated',
  'private.cwl_restore_witnessed_multi_member_worker(uuid,jsonb,integer,uuid[],uuid,bigint,text,boolean,text)',
   'EXECUTE')
 OR has_table_privilege('authenticated',
  'private.cwl_portable_multi_clan_recovery_sessions','INSERT')
 OR has_table_privilege('authenticated',
  'private.cwl_portable_multi_clan_recovery_sessions','UPDATE')
 OR has_table_privilege('authenticated',
  'private.cwl_portable_multi_clan_recovery_sessions','DELETE')
 OR has_table_privilege('anon',
  'private.cwl_portable_multi_clan_recovery_sessions','SELECT')
 OR NOT (SELECT relrowsecurity FROM pg_class
    WHERE oid='private.cwl_portable_multi_clan_recovery_sessions'::regclass)
 THEN RAISE EXCEPTION 'Unsafe multi-clan public/privileged helper/checkpoint access';END IF;
 RAISE NOTICE 'PASS: full group RLS, no direct helper grants, no anonymous restore';
END $permissions$;
