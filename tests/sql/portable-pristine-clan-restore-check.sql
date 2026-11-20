-- Real PostgreSQL 17 isolated synthetic UAT for full original source ->
-- owner-linked pristine replacement clan, including LOCKED/PLAYED plan, API
-- attacks, immutable member evidence, whole archive, decisions and audits.
-- Run after portable-cloud-export-fixture, portable-cloud-restore-fixture,
-- original owner snapshot, origin witness, fresh-clan fixture and new RPC.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
CREATE TEMP TABLE original_witness AS SELECT s.r->'snapshot' AS payload,
 (s.r->'server_receipt'->>'id')::uuid AS receipt
 FROM (SELECT public.cwl_issue_owned_backup_witness(
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid]) AS r) s;
DO $fresh_restore$
DECLARE v_original jsonb;v_receipt uuid;v_preview jsonb;v_applied jsonb;
 v_target uuid:='88888888-8888-4888-8888-888888888888';
BEGIN
 SELECT payload,receipt INTO v_original,v_receipt FROM original_witness;
 IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(
    v_original#>'{clans,0,tables}'))<>17 OR
    v_original#>>'{clans,0,tables,cwl_own_lineup_archives,0,state}'<>'warEnded'
    OR v_original#>>'{clans,0,tables,cwl_plan_review_state,0,locked}'<>'true'
    OR v_original#>>'{clans,0,tables,cwl_stat_attacks,0,stars}'<>'3' THEN
  RAISE EXCEPTION 'The original signed fixture lacks verified played CWL/attacks';
 END IF;
 v_preview:=public.cwl_restore_witnessed_pristine_clan(
  v_receipt,v_original,v_target,1,NULL,false,NULL);
 IF v_preview->>'scope'<>'verified-pristine-new-clan-17-datasets' OR
  v_preview->>'applied'<>'false' OR
  v_preview->>'mutation_permitted'<>'false' OR
  v_preview->>'public_full_restore_available'<>'false' OR
  (v_preview->>'restored_table_count')::integer<>17 OR
  (v_preview->>'source_locked_days')::integer<>1 OR
  (v_preview->>'source_archive_rows')::integer<>2 OR
  (v_preview->>'source_rows')::integer<13 OR
  length(v_preview->>'target_fingerprint')<>64 THEN
  RAISE EXCEPTION 'Fresh replacement preview was incomplete: %',v_preview;
 END IF;
 IF (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>0
  THEN RAISE EXCEPTION 'Preview mutated recovery checkpoints';END IF;
 v_applied:=public.cwl_restore_witnessed_pristine_clan(
  v_receipt,v_original,v_target,1,v_preview->>'target_fingerprint',
  true,'RESTORE_ORIGINAL_TO_EMPTY_CLAN');
 IF v_applied->>'applied'<>'true' OR
  (v_applied->>'applied_revision')::integer<>2 OR
  (v_applied->>'restored_table_count')::integer<>17 OR
  (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>1 THEN
   RAISE EXCEPTION 'Original 17-area replay/checkpoint failed: %',v_applied;
 END IF;
 IF (SELECT profile_json FROM public.cwl_cloud_profiles WHERE clan_id=v_target)
  IS DISTINCT FROM v_original#>'{clans,0,tables,cwl_cloud_profiles,0,profile_json}'
  OR (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=v_target)<>2
  OR NOT EXISTS(SELECT 1 FROM public.cwl_plan_review_state
   WHERE clan_id=v_target AND locked AND season='2026-11'
    AND locked_by='33333333-3333-4333-8333-333333333333'::uuid)
  OR NOT EXISTS(SELECT 1 FROM public.cwl_own_lineup_archives
   WHERE clan_id=v_target AND state='warEnded' AND day=1)
  OR NOT EXISTS(SELECT 1 FROM public.cwl_stat_wars
   WHERE clan_id=v_target AND war_key='normal:war1'
    AND source='api' AND missed_log_complete=true)
  OR (SELECT count(*) FROM public.cwl_stat_attacks
   WHERE clan_id=v_target AND war_key='normal:war1')<>2
  OR (SELECT count(*) FROM public.cwl_profile_snapshots WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_change_events WHERE clan_id=v_target)<>3
  OR (SELECT count(*) FROM public.cwl_plan_suggestions WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_clan_member_tenure WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_clan_donation_observations WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_clan_absence_observations WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_clan_review_decisions WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_clan_cw_missed_decisions WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_missed_owner_decisions WHERE clan_id=v_target)<>1
  OR (SELECT count(*) FROM public.cwl_clan_management_rules WHERE clan_id=v_target)<>1 THEN
   RAISE EXCEPTION 'Rebuilt original plan/played wars/archive/provenance differs';
 END IF;
 IF EXISTS(SELECT 1 FROM public.cwl_clan_cw_missed_decisions
   WHERE clan_id=v_target AND id=1) OR
  EXISTS(SELECT 1 FROM public.cwl_missed_owner_decisions
   WHERE clan_id=v_target AND id=303) OR
  EXISTS(SELECT 1 FROM public.cwl_change_events
   WHERE clan_id=v_target AND id=302) OR
  EXISTS(SELECT 1 FROM public.cwl_profile_snapshots
   WHERE clan_id=v_target AND id=301) OR
  EXISTS(SELECT 1 FROM public.cwl_plan_suggestions
   WHERE clan_id=v_target AND id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN
   RAISE EXCEPTION 'Surrogate IDs were not safely remapped';
 END IF;
 -- Must refuse duplicate 2nd replay: the restored clan is ACTIVE and locked.
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,v_target,2,NULL,false,NULL);
  RAISE EXCEPTION 'Second replay overwrote a played CWL';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 RAISE NOTICE 'PASS: fresh replacement replicated all 17 signed datasets, original actors/API/stars/played locks, safe surrogate IDs, one durable before-checkpoint';
END $fresh_restore$;

-- Explicit preflight failures never change target data.
DO $preflight$
DECLARE v_original jsonb;v_receipt uuid;v_before jsonb;
BEGIN
 SELECT payload,receipt INTO v_original,v_receipt FROM original_witness;
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,'77777777-7777-4777-8777-777777777777',1,NULL,false,NULL);
  RAISE EXCEPTION 'Real target war was overwritten';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,'99999999-9999-4999-8999-999999999999',2,NULL,false,NULL);
  RAISE EXCEPTION 'Stale planned revision bypassed';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,'99999999-9999-4999-8999-999999999999',1,repeat('0',64),
   true,'RESTORE_ORIGINAL_TO_EMPTY_CLAN');
  RAISE EXCEPTION 'Stale target SHA bypassed';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,pg_catalog.jsonb_set(v_original,
    '{clans,0,tables,cwl_stat_attacks,0,stars}','0'::jsonb),
   '99999999-9999-4999-8999-999999999999',1,NULL,false,NULL);
  RAISE EXCEPTION 'Forged original star accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 IF (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>1
 THEN RAISE EXCEPTION 'Denied operations wrote additional checkpoints';END IF;
 RAISE NOTICE 'PASS: active opponent, stale revision, forged fingerprint and tampered witness fail closed';
END $preflight$;

-- Synthetic late failure occurs after original profile update, source wars,
-- historical audit and further rows. All changes + checkpoint MUST roll back.
RESET ROLE;
CREATE OR REPLACE FUNCTION public.synthetic_late_restore_failure() RETURNS trigger
LANGUAGE plpgsql AS $late$
BEGIN RAISE EXCEPTION 'synthetic late 17-table failure';END$late$;
CREATE TRIGGER synthetic_late_restore_failure
 BEFORE INSERT ON public.cwl_clan_review_decisions FOR EACH ROW
 EXECUTE FUNCTION public.synthetic_late_restore_failure();
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $rollback$
DECLARE v_original jsonb;v_receipt uuid;v_pre jsonb;
 v_target uuid:='99999999-9999-4999-8999-999999999999';
BEGIN
 SELECT payload,receipt INTO v_original,v_receipt FROM original_witness;
 v_pre:=public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,v_target,1,NULL,false,NULL);
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,v_target,1,v_pre->>'target_fingerprint',
   true,'RESTORE_ORIGINAL_TO_EMPTY_CLAN');
  RAISE EXCEPTION 'Late failure unexpectedly completed restore';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Late failure unexpectedly completed restore' THEN RAISE; END IF;
 END;
 IF (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=v_target)<>1 OR
   (SELECT profile_json FROM public.cwl_cloud_profiles WHERE clan_id=v_target)
    IS DISTINCT FROM public.synthetic_empty_profile('Fresh 2') OR
   (SELECT count(*) FROM public.cwl_stat_wars WHERE clan_id=v_target)<>0 OR
   (SELECT count(*) FROM public.cwl_stat_attacks WHERE clan_id=v_target)<>0 OR
   (SELECT count(*) FROM public.cwl_change_events WHERE clan_id=v_target)<>0 OR
   (SELECT count(*) FROM public.cwl_profile_snapshots WHERE clan_id=v_target)<>0 OR
   (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>1 THEN
  RAISE EXCEPTION 'Late failure leaked profile, fact, historical audit or new checkpoint';
 END IF;
 RAISE NOTICE 'PASS: forced late trigger failure rolled back source plan/played locks, facts, audit and checkpoint';
END $rollback$;
RESET ROLE;
DROP TRIGGER synthetic_late_restore_failure ON public.cwl_clan_review_decisions;
DROP FUNCTION public.synthetic_late_restore_failure();

-- More subtle than a thrown constraint: an unexpected trigger that
-- silently changes a signed API attack MUST be caught by the complete
-- post-write 17-table comparison and also roll back plan+checkpoint.
CREATE OR REPLACE FUNCTION public.synthetic_corrupt_attack_stars() RETURNS trigger
LANGUAGE plpgsql AS $corrupt$
BEGIN NEW.stars:=0;RETURN NEW;END$corrupt$;
CREATE TRIGGER synthetic_corrupt_attack_stars BEFORE INSERT
 ON public.cwl_stat_attacks FOR EACH ROW
 EXECUTE FUNCTION public.synthetic_corrupt_attack_stars();
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $postcondition_rollback$
DECLARE v_original jsonb;v_receipt uuid;v_pre jsonb;
 v_target uuid:='99999999-9999-4999-8999-999999999999';
BEGIN
 SELECT payload,receipt INTO v_original,v_receipt FROM original_witness;
 v_pre:=public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,v_target,1,NULL,false,NULL);
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,v_target,1,v_pre->>'target_fingerprint',
   true,'RESTORE_ORIGINAL_TO_EMPTY_CLAN');
  RAISE EXCEPTION 'Silently corrupted API stars were accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 IF (SELECT count(*) FROM public.cwl_stat_wars WHERE clan_id=v_target)<>0
 OR (SELECT count(*) FROM public.cwl_stat_attacks WHERE clan_id=v_target)<>0
 OR (SELECT revision FROM public.cwl_cloud_profiles WHERE clan_id=v_target)<>1
 OR (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>1 THEN
   RAISE EXCEPTION 'Silent corrupted attack did not cause full transaction rollback';
 END IF;
 RAISE NOTICE 'PASS: silent API stars mutation caught by 17-area postcondition and rolled back';
END $postcondition_rollback$;
RESET ROLE;
DROP TRIGGER synthetic_corrupt_attack_stars ON public.cwl_stat_attacks;
DROP FUNCTION public.synthetic_corrupt_attack_stars();

-- Realistic disaster: original source clan is REMOVED after the signed
-- receipt has been securely minted. The private independent receipt persists,
-- and the surviving signed file must still restore all 17 datasets to a new
-- owner-linked target. No code is allowed to read from the deleted source.
DO $simulate_deleted_clan$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'cwl_clan_review_decisions','cwl_clan_donation_observations',
  'cwl_clan_absence_observations','cwl_clan_member_tenure',
  'cwl_clan_cw_missed_decisions','cwl_missed_owner_decisions',
  'cwl_profile_snapshots','cwl_change_events','cwl_plan_suggestions',
  'cwl_own_lineup_archives','cwl_group_archives',
  'cwl_clan_management_rules','cwl_plan_review_state',
  'cwl_stat_attacks','cwl_stat_missed','cwl_stat_wars','cwl_cloud_profiles'
 ] LOOP
  EXECUTE pg_catalog.format('DELETE FROM public.%I WHERE clan_id=%L::uuid',
    t,'11111111-1111-4111-8111-111111111111');
 END LOOP;
 DELETE FROM public.cwl_clan_memberships
   WHERE clan_id='11111111-1111-4111-8111-111111111111';
 DELETE FROM public.cwl_clans
   WHERE id='11111111-1111-4111-8111-111111111111';
END $simulate_deleted_clan$;
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $restore_after_source_deleted$
DECLARE v_original jsonb;v_receipt uuid;v_pre jsonb;v_restored jsonb;
 v_target uuid:='99999999-9999-4999-8999-999999999999';
BEGIN
 SELECT payload,receipt INTO v_original,v_receipt FROM original_witness;
 IF EXISTS(SELECT 1 FROM public.cwl_clans
  WHERE id='11111111-1111-4111-8111-111111111111') THEN
  RAISE EXCEPTION 'Disaster simulation failed: source still present';END IF;
 v_pre:=public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,v_target,1,NULL,false,NULL);
 v_restored:=public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,v_target,1,v_pre->>'target_fingerprint',
   true,'RESTORE_ORIGINAL_TO_EMPTY_CLAN');
 IF v_restored->>'applied'<>'true' OR
   v_restored->>'source_clan_id'<>'11111111-1111-4111-8111-111111111111' OR
   (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>2 OR
   NOT EXISTS(SELECT 1 FROM public.cwl_plan_review_state
      WHERE clan_id=v_target AND locked) OR
   (SELECT count(*) FROM public.cwl_stat_attacks WHERE clan_id=v_target)<>2 OR
   NOT EXISTS(SELECT 1 FROM public.cwl_own_lineup_archives
      WHERE clan_id=v_target AND state='warEnded') THEN
   RAISE EXCEPTION 'Deleted original clan was not restored from independent witness';
 END IF;
 RAISE NOTICE 'PASS: original clan completely deleted, private receipt survived and the full 17-dataset/locked CWL history was reconstructed';
END $restore_after_source_deleted$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $foreign_owner$
DECLARE v_original jsonb;v_receipt uuid;
BEGIN
 SELECT payload,receipt INTO v_original,v_receipt FROM original_witness;
 BEGIN
  PERFORM public.cwl_restore_witnessed_pristine_clan(
   v_receipt,v_original,
   '88888888-8888-4888-8888-888888888888',2,NULL,false,NULL);
  RAISE EXCEPTION 'Foreign actor could validate original private witness';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $foreign_owner$;
RESET ROLE;

-- Revoked owner must lose ability to read entire private before snapshot.
UPDATE public.cwl_clan_memberships SET role='viewer'
 WHERE clan_id='88888888-8888-4888-8888-888888888888'
  AND user_id='33333333-3333-4333-8333-333333333333';
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $revoked$
BEGIN
 IF (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints
   WHERE target_clan_id='88888888-8888-4888-8888-888888888888')<>0 OR
   (SELECT count(*) FROM private.cwl_portable_fresh_clan_recovery_checkpoints)<>1
 THEN RAISE EXCEPTION 'Former owner retained revoked target snapshot or lost authorized snapshot access';END IF;
 RAISE NOTICE 'PASS: owner role revoked, before-state RLS deny enforced';
END $revoked$;
RESET ROLE;

DO $privileges$
DECLARE v_portable integer;
BEGIN
 IF has_function_privilege('anon',
   'public.cwl_restore_witnessed_pristine_clan(uuid,jsonb,uuid,bigint,text,boolean,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
   'public.cwl_restore_witnessed_pristine_clan(uuid,jsonb,uuid,bigint,text,boolean,text)','EXECUTE')
 OR has_table_privilege('anon','private.cwl_portable_fresh_clan_recovery_checkpoints','SELECT')
 OR has_table_privilege('authenticated','private.cwl_portable_fresh_clan_recovery_checkpoints','INSERT')
 OR has_table_privilege('authenticated','private.cwl_portable_fresh_clan_recovery_checkpoints','UPDATE')
 OR has_table_privilege('authenticated','private.cwl_portable_fresh_clan_recovery_checkpoints','DELETE')
 OR NOT (SELECT relrowsecurity FROM pg_class
   WHERE oid='private.cwl_portable_fresh_clan_recovery_checkpoints'::regclass)
 THEN RAISE EXCEPTION 'Unsafe new fresh-clan restore RPC/owner RLS grants';END IF;
 RAISE NOTICE 'PASS: private SECURITY DEFINER, public invoker, protected checkpoint and anonymous deny';
END $privileges$;
