-- Disposable PG17 contract/UAT. Never run against production.
-- Source fixture includes all 17 tables and a genuine privately minted receipt.
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users(id) VALUES
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.cwl_profile_snapshots(id,clan_id,revision,profile_json,created_at) VALUES
 (101,'11111111-1111-4111-8111-111111111111',3,'{"members":[]}'::jsonb,'2026-11-19T14:00Z');
INSERT INTO public.cwl_change_events(id,clan_id,actor_id,revision,event_type,details,created_at) VALUES
 (102,'11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',3,'profile_updated','{"plan":true}'::jsonb,'2026-11-19T15:00Z');
INSERT INTO public.cwl_plan_review_state(clan_id,cycle_id,season,locked,locked_by,updated_at)
 VALUES ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11',true,
 '33333333-3333-4333-8333-333333333333','2026-11-20T10:00Z');
INSERT INTO public.cwl_plan_suggestions(id,clan_id,cycle_id,author_id,base_revision,suggested_profile,status,submitted_at)
 VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',4,
 '{"members":[]}'::jsonb,'accepted','2026-11-20T10:00Z');
INSERT INTO public.cwl_own_lineup_archives(clan_id,season,day,war_tag,state,team_size,lineup_json)
 VALUES ('11111111-1111-4111-8111-111111111111','2026-11',1,'#P8Y2','warEnded',1,'{"members":[{"tag":"#P8Y2","attacks":[]}]}'::jsonb);
INSERT INTO public.cwl_missed_owner_decisions(id,clan_id,season,war_key,day,player_tag,decision,note,actor_id,created_at)
 VALUES (103,'11111111-1111-4111-8111-111111111111','2026-11','cwl:war2',1,'#P8Y2','excused',
 'historical owner action','33333333-3333-4333-8333-333333333333','2026-11-20T10:00Z');
INSERT INTO public.cwl_clan_member_tenure(clan_id,source_clash_tag,player_tag,
 first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits)
 VALUES ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2',
 '2026-10-01T10:00Z','2026-11-20T10:00Z','2026-11-20T10:00Z','2026-10-01T10:00Z',true,86400,4);
INSERT INTO public.cwl_clan_donation_observations(clan_id,source_clash_tag,player_tag,observed_at,positive_delta)
 VALUES ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2','2026-11-19T11:00Z',50);
INSERT INTO public.cwl_clan_absence_observations(clan_id,source_clash_tag,player_tag,prior_visit_number,leave_observed_at,last_absent_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds)
 VALUES ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2',2,'2026-11-01T10:00Z','2026-11-02T10:00Z',2,3600,3600);
INSERT INTO public.cwl_clan_review_decisions(clan_id,source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at)
 VALUES ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2','performance','acknowledged','verified-evidence-2026',2,'2026-11-19T11:00Z');

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
CREATE TEMP TABLE witnessed_backup_original AS
 SELECT a.r->'snapshot' AS payload,
        (a.r->'server_receipt'->>'id')::uuid AS receipt
 FROM (SELECT public.cwl_issue_owned_backup_witness(
   ARRAY['11111111-1111-4111-8111-111111111111'::uuid]) AS r) a;
DO $origin_check$
DECLARE v jsonb;
BEGIN
 SELECT payload INTO v FROM witnessed_backup_original;
 IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v#>'{clans,0,tables}'))<>17
 OR v#>>'{clans,0,tables,cwl_stat_attacks,0,stars}' IS NULL
 OR v#>>'{clans,0,tables,cwl_own_lineup_archives,0,state}'<>'warEnded'
 OR v#>>'{clans,0,tables,cwl_clan_review_decisions,0,disposition}'<>'acknowledged'
 THEN RAISE EXCEPTION 'Not a meaningful original 17-table fixture';END IF;
END $origin_check$;
RESET ROLE;

-- Simulate a same-tenant partial backend loss. Keep current plan untouched.
DO $delete_fixture$
DECLARE v_table text;
BEGIN
 FOREACH v_table IN ARRAY ARRAY[
  'cwl_clan_review_decisions','cwl_clan_donation_observations',
  'cwl_clan_absence_observations','cwl_clan_member_tenure',
  'cwl_clan_cw_missed_decisions','cwl_missed_owner_decisions',
  'cwl_profile_snapshots','cwl_change_events','cwl_plan_suggestions',
  'cwl_own_lineup_archives','cwl_group_archives',
  'cwl_clan_management_rules','cwl_plan_review_state',
  'cwl_stat_attacks','cwl_stat_missed','cwl_stat_wars'
 ] LOOP
  EXECUTE pg_catalog.format(
    'DELETE FROM public.%I WHERE clan_id=%L::uuid',
    v_table,'11111111-1111-4111-8111-111111111111');
 END LOOP;
END $delete_fixture$;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $roundtrip$
DECLARE v_pre jsonb;v_result jsonb;v_repeat jsonb;
 v_payload jsonb;v_receipt uuid;v_id uuid:='11111111-1111-4111-8111-111111111111';
BEGIN
 SELECT payload,receipt INTO v_payload,v_receipt FROM witnessed_backup_original;
 v_pre:=public.cwl_restore_witnessed_missing_history(
   v_receipt,v_payload,v_id,4,NULL,false,NULL);
 IF v_pre->>'scope'<>'witnessed-same-clan-missing-history' OR
   (v_pre->>'new')::integer<13 OR
   (v_pre->>'conflict')::integer<>0 OR
   v_pre->>'mutation_permitted'<>'false' THEN
   RAISE EXCEPTION 'Preview did not inspect full witnessed history: %',v_pre;
 END IF;
 IF (SELECT count(*) FROM private.cwl_portable_history_recovery_checkpoints)<>0 THEN
   RAISE EXCEPTION 'Preview wrote a checkpoint'; END IF;
 v_result:=public.cwl_restore_witnessed_missing_history(
   v_receipt,v_payload,v_id,4,v_pre->>'target_fingerprint',
   true,'RESTORE_WITNESSED_MISSING_HISTORY');
 IF v_result->>'applied'<>'true' OR
   (v_result->>'new')::integer<>(v_pre->>'new')::integer OR
   (SELECT count(*) FROM private.cwl_portable_history_recovery_checkpoints)<>1 THEN
   RAISE EXCEPTION 'Full history atom or durable checkpoint failed: %',v_result;
 END IF;
 v_repeat:=public.cwl_restore_witnessed_missing_history(
   v_receipt,v_payload,v_id,4,NULL,false,NULL);
 IF (v_repeat->>'new')::integer<>0 OR
   (v_repeat->>'conflict')::integer<>0 THEN
   RAISE EXCEPTION 'Roundtrip did not restore exact historical content';END IF;
 v_result:=public.cwl_restore_witnessed_missing_history(
   v_receipt,v_payload,v_id,4,v_repeat->>'target_fingerprint',
   true,'RESTORE_WITNESSED_MISSING_HISTORY');
 IF v_result->>'already_complete'<>'true' OR
   (SELECT count(*) FROM private.cwl_portable_history_recovery_checkpoints)<>1 THEN
   RAISE EXCEPTION 'Idempotent second apply wrote again'; END IF;
 RAISE NOTICE 'PASS: all original 17-table data now exact; one checkpoint; second restore no-op';
END $roundtrip$;
RESET ROLE;

-- Save a repeatable witness and post-restore rows for the forced rollback test.
-- Missing war fact is inserted first; an artificial later-category failure
-- MUST revert all previous inserts and the new checkpoint in one txn.
DELETE FROM public.cwl_stat_attacks
 WHERE clan_id='11111111-1111-4111-8111-111111111111' AND attack_order=1;
DELETE FROM public.cwl_clan_review_decisions
 WHERE clan_id='11111111-1111-4111-8111-111111111111';
CREATE FUNCTION public.synthetic_recovery_fail() RETURNS trigger
LANGUAGE plpgsql AS $fail$BEGIN RAISE EXCEPTION 'synthetic post-checkpoint failure';END$fail$;
CREATE TRIGGER synthetic_recovery_fail BEFORE INSERT ON public.cwl_clan_review_decisions
 FOR EACH ROW EXECUTE FUNCTION public.synthetic_recovery_fail();
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $rollback_check$
DECLARE v_pre jsonb;v_payload jsonb;v_receipt uuid;v_count integer;
BEGIN
 SELECT payload,receipt INTO v_payload,v_receipt FROM witnessed_backup_original;
 v_pre:=public.cwl_restore_witnessed_missing_history(v_receipt,v_payload,
   '11111111-1111-4111-8111-111111111111',4,NULL,false,NULL);
 IF (v_pre->>'new')::integer<>2 THEN
   RAISE EXCEPTION 'Synthetic rollback fixture is not two rows';END IF;
 BEGIN
   PERFORM public.cwl_restore_witnessed_missing_history(v_receipt,v_payload,
     '11111111-1111-4111-8111-111111111111',4,
     v_pre->>'target_fingerprint',true,'RESTORE_WITNESSED_MISSING_HISTORY');
   RAISE EXCEPTION 'Synthetic mid-transaction insert wrongly succeeded';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='Synthetic mid-transaction insert wrongly succeeded' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO v_count FROM public.cwl_stat_attacks
   WHERE clan_id='11111111-1111-4111-8111-111111111111' AND attack_order=1;
 IF v_count<>0 OR
    (SELECT count(*) FROM private.cwl_portable_history_recovery_checkpoints)<>1 THEN
   RAISE EXCEPTION 'Failure did not roll back earlier attacks AND checkpoint';
 END IF;
 RAISE NOTICE 'PASS: a late insert failure rolled back all prior inserts and checkpoint';
END $rollback_check$;
RESET ROLE;
DROP TRIGGER synthetic_recovery_fail ON public.cwl_clan_review_decisions;
DROP FUNCTION public.synthetic_recovery_fail();

-- Conflicting current evidence and a newer plan must ALWAYS be refused.
UPDATE public.cwl_stat_attacks SET stars=0
 WHERE clan_id='11111111-1111-4111-8111-111111111111' AND attack_order=2;
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $conflict$
DECLARE v_pre jsonb;v_payload jsonb;v_receipt uuid;
BEGIN
 SELECT payload,receipt INTO v_payload,v_receipt FROM witnessed_backup_original;
 v_pre:=public.cwl_restore_witnessed_missing_history(v_receipt,v_payload,
  '11111111-1111-4111-8111-111111111111',4,NULL,false,NULL);
 IF (v_pre->>'conflict')::integer<>1 THEN RAISE EXCEPTION 'API fact conflict hidden'; END IF;
 BEGIN
  PERFORM public.cwl_restore_witnessed_missing_history(v_receipt,v_payload,
  '11111111-1111-4111-8111-111111111111',4,
   v_pre->>'target_fingerprint',true,'RESTORE_WITNESSED_MISSING_HISTORY');
  RAISE EXCEPTION 'Conflicting API star was overwritten';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 -- Client content edits are not accepted even with a recomputed client hash.
 BEGIN
  PERFORM public.cwl_restore_witnessed_missing_history(v_receipt,
   pg_catalog.jsonb_set(v_payload,'{clans,0,tables,cwl_stat_attacks,0,stars}','0'::jsonb),
   '11111111-1111-4111-8111-111111111111',4,NULL,false,NULL);
  RAISE EXCEPTION 'Forged stars passed original server witness';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 RAISE NOTICE 'PASS: witnessed evidence immutable; conflicting API star denied';
END $conflict$;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $foreign$
DECLARE v_payload jsonb;v_receipt uuid;
BEGIN
 SELECT payload,receipt INTO v_payload,v_receipt FROM witnessed_backup_original;
 BEGIN
  PERFORM public.cwl_restore_witnessed_missing_history(v_receipt,v_payload,
    '11111111-1111-4111-8111-111111111111',4,NULL,false,NULL);
  RAISE EXCEPTION 'Foreign actor used another owner receipt';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $foreign$;
RESET ROLE;
DO $security$
BEGIN
 IF has_function_privilege('anon',
   'public.cwl_restore_witnessed_missing_history(uuid,jsonb,uuid,bigint,text,boolean,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
   'public.cwl_restore_witnessed_missing_history(uuid,jsonb,uuid,bigint,text,boolean,text)','EXECUTE')
 OR has_table_privilege('authenticated','private.cwl_portable_history_recovery_checkpoints','INSERT')
 OR has_table_privilege('authenticated','private.cwl_portable_history_recovery_checkpoints','UPDATE')
 OR has_table_privilege('authenticated','private.cwl_portable_history_recovery_checkpoints','DELETE')
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='private.cwl_portable_history_recovery_checkpoints'::regclass) THEN
  RAISE EXCEPTION 'RLS, public RPC, or checkpoint privileges unsafe';
 END IF;
 RAISE NOTICE 'PASS: only a valid owner may invoke protected atomic history recovery';
END $security$;


-- Once owner membership is revoked the old actor must no longer read their
-- full before-snapshot, even though the checkpoint was written by that actor.
UPDATE public.cwl_clan_memberships SET role='viewer'
 WHERE clan_id='11111111-1111-4111-8111-111111111111'
   AND user_id='33333333-3333-4333-8333-333333333333';
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $revoked_owner$
BEGIN
 IF (SELECT count(*) FROM private.cwl_portable_history_recovery_checkpoints)<>0
 THEN RAISE EXCEPTION 'Revoked owner can read private recovery data';END IF;
 RAISE NOTICE 'PASS: previous owner loses private checkpoint access immediately';
END $revoked_owner$;
RESET ROLE;
