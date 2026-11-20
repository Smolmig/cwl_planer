-- #178: REAL, one-RPC, all-dataset history recovery for a SAME-ID owner clan.
-- Intentionally NOT the public full Cloud-App restore. A matching current
-- cloud profile (including revisions and played/locked days) is mandatory.
-- This narrow transaction may recover MISSING witnessed history, never touch
-- existing history/plans or pretend it can recreate a lost account.
-- The original 17-table receipt remains mandatory in the live DB.
--
-- SECURITY DEFINER is strictly in the non-exposed private schema because
-- collector-only archive and audit INSERT rights must NOT be granted to users.
-- Its public wrapper is SECURITY INVOKER. The worker checks auth.uid(),
-- real owner/membership, original DB witness, SAME clan ID, current target
-- snapshot/CAS, and immutable conflicts *before* any write.
CREATE TABLE IF NOT EXISTS private.cwl_portable_history_recovery_checkpoints (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 actor_user_id uuid NOT NULL,
 clan_id uuid NOT NULL,
 source_receipt_id uuid NOT NULL,
 source_digest text NOT NULL,
 before_fingerprint text NOT NULL,
 before_snapshot jsonb NOT NULL,
 inserted_rows integer NOT NULL CHECK (inserted_rows BETWEEN 1 AND 1700000),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE private.cwl_portable_history_recovery_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.cwl_portable_history_recovery_checkpoints
 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.cwl_portable_history_recovery_checkpoints TO authenticated;
DROP POLICY IF EXISTS cwl_history_recovery_actor_read
 ON private.cwl_portable_history_recovery_checkpoints;
CREATE POLICY cwl_history_recovery_actor_read
 ON private.cwl_portable_history_recovery_checkpoints
 FOR SELECT TO authenticated USING (
  actor_user_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM public.cwl_clans c
   JOIN public.cwl_clan_memberships m
     ON m.clan_id=c.id AND m.user_id=actor_user_id AND m.role='owner'
   WHERE c.id=private.cwl_portable_history_recovery_checkpoints.clan_id
     AND c.owner_user_id=private.cwl_portable_history_recovery_checkpoints.actor_user_id
  )
 );
COMMENT ON TABLE private.cwl_portable_history_recovery_checkpoints IS
 'Append-only atomic before-snapshot checkpoint for strictly witnessed missing history. No direct client INSERT/UPDATE/DELETE.';

-- Stable composite-key encoding avoids quadratic scanning of multi-thousand-row
-- attack histories. Numeric IDs remain JSON numbers (not lossy JS doubles).
CREATE OR REPLACE FUNCTION private.cwl_witnessed_restore_row_key(
 p_row jsonb,p_keys text[]
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=''
AS $key$
 SELECT pg_catalog.jsonb_agg(p_row->k.col ORDER BY k.ord)::text
 FROM pg_catalog.unnest(p_keys) WITH ORDINALITY AS k(col,ord);
$key$;
REVOKE ALL ON FUNCTION private.cwl_witnessed_restore_row_key(jsonb,text[])
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.cwl_restore_witnessed_missing_history_worker(
 p_receipt_id uuid,p_payload jsonb,p_clan_id uuid,
 p_expected_revision bigint,p_expected_target_fingerprint text,
 p_apply boolean,p_confirmation text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $witnessed_missing_history$
DECLARE
 v_actor uuid:=auth.uid();
 v_target_tag text;
 v_proof jsonb;
 v_target jsonb;
 v_fingerprint text;
 v_src_clan jsonb;
 v_src_tables jsonb;
 v_target_tables jsonb;
 v_spec record;
 v_row jsonb;
 v_prior jsonb;
 v_rows jsonb;
 v_keys text[];
 v_existing_rows jsonb;
 v_key text;
 v_target_index jsonb;
 v_row_key text;
 v_missing integer:=0;
 v_identical integer:=0;
 v_conflicts integer:=0;
 v_table_missing integer;
 v_table_identical integer;
 v_table_conflicts integer;
 v_table_stats jsonb:='{}'::jsonb;
 v_conflict_tables text[]:=ARRAY[]::text[];
 v_cols text;
 v_insert_sql text;
 v_checkpoint uuid;
 v_after jsonb;
 v_after_tables jsonb;
 v_found jsonb;
 v_actual_revision bigint;
BEGIN
 IF v_actor IS NULL OR p_receipt_id IS NULL OR p_clan_id IS NULL OR
    p_expected_revision IS NULL OR p_expected_revision<1 OR
    p_apply IS NULL OR
    pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR
    pg_catalog.octet_length(p_payload::text)>67108864 THEN
   RAISE EXCEPTION 'Invalid owner, source, target or expected plan revision'
     USING ERRCODE='42501';
 END IF;
 IF p_apply AND (
     p_confirmation IS DISTINCT FROM 'RESTORE_WITNESSED_MISSING_HISTORY'
     OR p_expected_target_fingerprint !~ '^[a-f0-9]{64}$') THEN
   RAISE EXCEPTION 'Explicit confirmation and fresh target fingerprint required'
     USING ERRCODE='42501';
 END IF;
 IF pg_catalog.jsonb_array_length(p_payload->'clans') IS DISTINCT FROM 1
    OR p_payload#>>'{clans,0,source_clan_id}' IS DISTINCT FROM p_clan_id::text THEN
   RAISE EXCEPTION 'History recovery currently requires identical source and destination clan IDs'
     USING ERRCODE='22023';
 END IF;
 -- Locks share the existing WarFacts/ClashPerk order; private actor cannot
 -- bypass the authorization check just by passing an arbitrary clan UUID.
 IF p_apply THEN
   PERFORM pg_catalog.pg_advisory_xact_lock(
     pg_catalog.hashtextextended(p_clan_id::text,424242));
 END IF;
 SELECT c.clash_tag INTO v_target_tag FROM public.cwl_clans c
 JOIN public.cwl_clan_memberships m
   ON m.clan_id=c.id AND m.user_id=v_actor AND m.role='owner'
 WHERE c.id=p_clan_id AND c.owner_user_id=v_actor
 ;
 -- The owner query is intentionally unprivileged in its predicate and
 -- checked again by the RLS-aware origin-verification RPC.
 IF NOT FOUND OR v_target_tag IS NULL OR
   v_target_tag IS DISTINCT FROM p_payload#>>'{clans,0,clash_tag}' THEN
   RAISE EXCEPTION 'Target owner membership or original Clash tag changed'
     USING ERRCODE='42501';
 END IF;
 IF p_apply THEN
   PERFORM 1 FROM public.cwl_clans WHERE id=p_clan_id FOR UPDATE;
 END IF;
 -- This is the crucial provenance boundary. A user-editable SHA256 is NEVER
 -- sufficient for collector archives, author audit or past decisions.
 v_proof:=public.cwl_verify_owned_backup_witness(
   p_receipt_id,p_payload,ARRAY[p_clan_id]);
 IF v_proof->>'verified' IS DISTINCT FROM 'true' OR
    v_proof->>'owner_user_id' IS DISTINCT FROM v_actor::text THEN
   RAISE EXCEPTION 'Verified original 17-table receipt required'
     USING ERRCODE='42501';
 END IF;
 IF p_apply THEN
   SELECT revision INTO v_actual_revision FROM public.cwl_cloud_profiles
     WHERE clan_id=p_clan_id FOR UPDATE;
 ELSE
   SELECT revision INTO v_actual_revision FROM public.cwl_cloud_profiles
     WHERE clan_id=p_clan_id;
 END IF;
 IF NOT FOUND OR v_actual_revision IS DISTINCT FROM p_expected_revision THEN
   RAISE EXCEPTION 'Plan revision changed; original plan cannot be overwritten'
     USING ERRCODE='40001';
 END IF;
 -- Match normal planning writes: lock profile BEFORE review state to avoid
 -- inversion with the plan guard, which checks review state after profile.
 IF p_apply THEN
   PERFORM 1 FROM public.cwl_plan_review_state
     WHERE clan_id=p_clan_id FOR UPDATE;
 END IF;
 v_target:=public.cwl_export_owned_backup(ARRAY[p_clan_id]);
 v_fingerprint:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   private.cwl_canonical_backup_payload(
      pg_catalog.jsonb_build_object('clans',v_target->'clans'))::text,'UTF8')),'hex');
 IF p_apply AND v_fingerprint IS DISTINCT FROM p_expected_target_fingerprint THEN
   RAISE EXCEPTION 'Target changed after preview; rerun read-only comparison'
     USING ERRCODE='40001';
 END IF;
 v_src_clan:=p_payload->'clans'->0;
 v_src_tables:=v_src_clan->'tables';
 v_target_tables:=v_target->'clans'->0->'tables';
 -- The current profile MUST be byte-for-byte identical in its backup schema.
 -- Update triggers bump revision and issue audit records, so overwriting a
 -- profile here would irreversibly falsify a purported exact historical replay.
 IF v_src_tables->'cwl_cloud_profiles' IS DISTINCT FROM
      v_target_tables->'cwl_cloud_profiles' THEN
   RAISE EXCEPTION 'The current plan, played days, locks or revision differ; history recovery cannot change them'
     USING ERRCODE='40001';
 END IF;
 -- Every table/field/key comes from the reviewed allowlist, never a user
 -- identifier. The source signature makes even the missing rows original.
 FOR v_spec IN SELECT * FROM (VALUES
  ('cwl_cloud_profiles', ARRAY['clan_id']::text[], 'clan_id,profile_json,data_version,revision,created_at,updated_at'),
  ('cwl_stat_wars', ARRAY['clan_id','war_key']::text[], 'clan_id,war_key,war_type,started_at,team_size,opponent_tag,opponent_name,source,roster_tags,finalized,updated_at,missed_log_complete,source_clash_tag'),
  ('cwl_stat_attacks', ARRAY['clan_id','war_key','attacker_tag','attack_order']::text[], 'clan_id,war_key,attacker_tag,attack_order,attacker_name,attacker_th,defender_tag,defender_name,defender_th,stars,destruction,created_at'),
  ('cwl_stat_missed', ARRAY['clan_id','war_key','player_tag']::text[], 'clan_id,war_key,player_tag,player_name,missed_count,created_at'),
  ('cwl_plan_review_state', ARRAY['clan_id']::text[], 'clan_id,cycle_id,season,locked,locked_by,locked_at,updated_at'),
  ('cwl_group_archives', ARRAY['clan_id','season']::text[], 'clan_id,season,clan_tag,group_json,created_at,updated_at'),
  ('cwl_own_lineup_archives', ARRAY['clan_id','season','day']::text[], 'clan_id,season,day,war_tag,state,team_size,lineup_json,created_at,updated_at'),
  ('cwl_profile_snapshots', ARRAY['id']::text[], 'id,clan_id,revision,profile_json,created_at'),
  ('cwl_change_events', ARRAY['id']::text[], 'id,clan_id,actor_id,revision,event_type,details,created_at'),
  ('cwl_plan_suggestions', ARRAY['id']::text[], 'id,clan_id,cycle_id,author_id,base_revision,suggested_profile,status,submitted_at,decided_at,decided_by'),
  ('cwl_missed_owner_decisions', ARRAY['id']::text[], 'id,clan_id,season,war_key,day,target_day,player_tag,decision,note,actor_id,created_at'),
  ('cwl_clan_member_tenure', ARRAY['clan_id','source_clash_tag','player_tag']::text[], 'clan_id,source_clash_tag,player_tag,first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits,last_clash_rank,last_clash_rank_at,rank_before_leave,rank_before_leave_at,last_donations,last_donations_at,last_donation_increase_at,last_donation_increase_by'),
  ('cwl_clan_management_rules', ARRAY['clan_id']::text[], 'clan_id,performance_enabled,performance_min_days,performance_min_attacks,performance_three_star_percent,performance_lookback_days,loyalty_min_days,absence_reset_days,revision,updated_at,loyalty_enabled,loyalty_min_donations,loyalty_min_active_days,loyalty_lookback_days'),
  ('cwl_clan_donation_observations', ARRAY['clan_id','source_clash_tag','player_tag','observed_at']::text[], 'clan_id,source_clash_tag,player_tag,observed_at,positive_delta'),
  ('cwl_clan_absence_observations', ARRAY['clan_id','source_clash_tag','player_tag','prior_visit_number']::text[], 'clan_id,source_clash_tag,player_tag,prior_visit_number,leave_observed_at,last_absent_observed_at,return_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds'),
  ('cwl_clan_review_decisions', ARRAY['clan_id','source_clash_tag','player_tag','review_kind']::text[], 'clan_id,source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at'),
  ('cwl_clan_cw_missed_decisions', ARRAY['id']::text[], 'id,clan_id,source_clash_tag,war_key,player_tag,decision,note,actor_id,created_at')
 ) AS contract(table_name,key_columns,insert_columns)
 LOOP
   v_rows:=v_src_tables->v_spec.table_name;
   v_existing_rows:=v_target_tables->v_spec.table_name;
   v_keys:=v_spec.key_columns;
   v_table_missing:=0;
   v_table_identical:=0;
   v_table_conflicts:=0;
   IF pg_catalog.jsonb_typeof(v_rows) IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_typeof(v_existing_rows) IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_array_length(v_rows)>100000 THEN
     RAISE EXCEPTION 'Incomplete 17-table recovery payload'
       USING ERRCODE='22023';
   END IF;
   SELECT COALESCE(pg_catalog.jsonb_object_agg(
      private.cwl_witnessed_restore_row_key(existing.value,v_keys),
      existing.value),'{}'::jsonb)
     INTO v_target_index
     FROM pg_catalog.jsonb_array_elements(v_existing_rows) existing;
   FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(v_rows)
   LOOP
     v_row_key:=private.cwl_witnessed_restore_row_key(v_row,v_keys);
     v_prior:=v_target_index->v_row_key;
     IF v_prior IS NULL THEN
       v_table_missing:=v_table_missing+1;
     ELSIF v_prior=v_row THEN
       v_table_identical:=v_table_identical+1;
     ELSE
       v_table_conflicts:=v_table_conflicts+1;
     END IF;
   END LOOP;
   v_missing:=v_missing+v_table_missing;
   v_identical:=v_identical+v_table_identical;
   v_conflicts:=v_conflicts+v_table_conflicts;
   IF v_table_conflicts>0 THEN
     v_conflict_tables:=v_conflict_tables||v_spec.table_name;
   END IF;
   v_table_stats:=v_table_stats||pg_catalog.jsonb_build_object(
     v_spec.table_name,pg_catalog.jsonb_build_object(
       'new',v_table_missing,'identical',v_table_identical,
       'conflict',v_table_conflicts
     ));
 END LOOP;
 IF NOT p_apply THEN
   RETURN pg_catalog.jsonb_build_object(
     'scope','witnessed-same-clan-missing-history',
     'clan_id',p_clan_id,'receipt_id',p_receipt_id,
     'target_fingerprint',v_fingerprint,'expected_revision',v_actual_revision,
     'tables',v_table_stats,'new',v_missing,'identical',v_identical,
     'conflict',v_conflicts,'conflict_tables',pg_catalog.to_jsonb(v_conflict_tables),
     'applied',false,'mutation_permitted',false,
     'full_app_restore',false,
     'warning','Only original witnessed MISSING rows, existing identical plan mandatory; no new clan/account or conflict overwrites'
   );
 END IF;
 IF v_conflicts>0 THEN
   RAISE EXCEPTION 'Existing history conflicts with witnessed original rows'
     USING ERRCODE='40001';
 END IF;
 IF v_missing=0 THEN
   RETURN pg_catalog.jsonb_build_object(
      'scope','witnessed-same-clan-missing-history',
      'clan_id',p_clan_id,'applied',false,'already_complete',true,
      'new',0,'conflict',0,'checkpoint_id',NULL,
      'mutation_permitted',false,'full_app_restore',false);
 END IF;
 -- Some historical author/decision IDs refer to deleted auth accounts.
 -- Those are not reconstructible from an App backup and must not be invented.
 IF EXISTS (
   SELECT 1 FROM (
     SELECT x.value->>'author_id' AS id FROM
       pg_catalog.jsonb_array_elements(v_src_tables->'cwl_plan_suggestions') x
     UNION ALL SELECT x.value->>'decided_by' FROM
       pg_catalog.jsonb_array_elements(v_src_tables->'cwl_plan_suggestions') x
     UNION ALL SELECT x.value->>'actor_id' FROM
       pg_catalog.jsonb_array_elements(v_src_tables->'cwl_missed_owner_decisions') x
     UNION ALL SELECT x.value->>'actor_id' FROM
       pg_catalog.jsonb_array_elements(v_src_tables->'cwl_clan_cw_missed_decisions') x
     UNION ALL SELECT x.value->>'locked_by' FROM
       pg_catalog.jsonb_array_elements(v_src_tables->'cwl_plan_review_state') x
   ) identities
   WHERE identities.id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM auth.users u WHERE u.id::text=identities.id)
 ) THEN
   RAISE EXCEPTION 'Historical author account missing; do not fabricate owner or audit identity'
     USING ERRCODE='23503';
 END IF;
 -- Append-only before-image is inserted IN THE SAME TRANSACTION as all
 -- historical rows. Any constraint, trigger or mismatch error undoes both.
 INSERT INTO private.cwl_portable_history_recovery_checkpoints(
   actor_user_id,clan_id,source_receipt_id,source_digest,
   before_fingerprint,before_snapshot,inserted_rows)
 VALUES (v_actor,p_clan_id,p_receipt_id,v_proof->>'payload_sha256',
   v_fingerprint,v_target,v_missing)
 RETURNING id INTO v_checkpoint;
 -- Revisit the allowlisted 17 datasets in their stable dependency order.
 -- No UPDATE, DELETE, UPSERT, role change or migration of source UUIDs.
 FOR v_spec IN SELECT * FROM (VALUES
  ('cwl_cloud_profiles', ARRAY['clan_id']::text[], 'clan_id,profile_json,data_version,revision,created_at,updated_at'),
  ('cwl_stat_wars', ARRAY['clan_id','war_key']::text[], 'clan_id,war_key,war_type,started_at,team_size,opponent_tag,opponent_name,source,roster_tags,finalized,updated_at,missed_log_complete,source_clash_tag'),
  ('cwl_stat_attacks', ARRAY['clan_id','war_key','attacker_tag','attack_order']::text[], 'clan_id,war_key,attacker_tag,attack_order,attacker_name,attacker_th,defender_tag,defender_name,defender_th,stars,destruction,created_at'),
  ('cwl_stat_missed', ARRAY['clan_id','war_key','player_tag']::text[], 'clan_id,war_key,player_tag,player_name,missed_count,created_at'),
  ('cwl_plan_review_state', ARRAY['clan_id']::text[], 'clan_id,cycle_id,season,locked,locked_by,locked_at,updated_at'),
  ('cwl_group_archives', ARRAY['clan_id','season']::text[], 'clan_id,season,clan_tag,group_json,created_at,updated_at'),
  ('cwl_own_lineup_archives', ARRAY['clan_id','season','day']::text[], 'clan_id,season,day,war_tag,state,team_size,lineup_json,created_at,updated_at'),
  ('cwl_profile_snapshots', ARRAY['id']::text[], 'id,clan_id,revision,profile_json,created_at'),
  ('cwl_change_events', ARRAY['id']::text[], 'id,clan_id,actor_id,revision,event_type,details,created_at'),
  ('cwl_plan_suggestions', ARRAY['id']::text[], 'id,clan_id,cycle_id,author_id,base_revision,suggested_profile,status,submitted_at,decided_at,decided_by'),
  ('cwl_missed_owner_decisions', ARRAY['id']::text[], 'id,clan_id,season,war_key,day,target_day,player_tag,decision,note,actor_id,created_at'),
  ('cwl_clan_member_tenure', ARRAY['clan_id','source_clash_tag','player_tag']::text[], 'clan_id,source_clash_tag,player_tag,first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits,last_clash_rank,last_clash_rank_at,rank_before_leave,rank_before_leave_at,last_donations,last_donations_at,last_donation_increase_at,last_donation_increase_by'),
  ('cwl_clan_management_rules', ARRAY['clan_id']::text[], 'clan_id,performance_enabled,performance_min_days,performance_min_attacks,performance_three_star_percent,performance_lookback_days,loyalty_min_days,absence_reset_days,revision,updated_at,loyalty_enabled,loyalty_min_donations,loyalty_min_active_days,loyalty_lookback_days'),
  ('cwl_clan_donation_observations', ARRAY['clan_id','source_clash_tag','player_tag','observed_at']::text[], 'clan_id,source_clash_tag,player_tag,observed_at,positive_delta'),
  ('cwl_clan_absence_observations', ARRAY['clan_id','source_clash_tag','player_tag','prior_visit_number']::text[], 'clan_id,source_clash_tag,player_tag,prior_visit_number,leave_observed_at,last_absent_observed_at,return_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds'),
  ('cwl_clan_review_decisions', ARRAY['clan_id','source_clash_tag','player_tag','review_kind']::text[], 'clan_id,source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at'),
  ('cwl_clan_cw_missed_decisions', ARRAY['id']::text[], 'id,clan_id,source_clash_tag,war_key,player_tag,decision,note,actor_id,created_at')
 ) AS contract(table_name,key_columns,insert_columns)
 LOOP
   v_existing_rows:=v_target_tables->v_spec.table_name;
   v_rows:=v_src_tables->v_spec.table_name;
   v_insert_sql:=pg_catalog.format(
     'INSERT INTO public.%I (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM pg_catalog.jsonb_populate_record(NULL::public.%I, $1) AS data',
     v_spec.table_name,v_spec.insert_columns,v_spec.insert_columns,v_spec.table_name);
   SELECT COALESCE(pg_catalog.jsonb_object_agg(
      private.cwl_witnessed_restore_row_key(existing.value,v_spec.key_columns),
      existing.value),'{}'::jsonb)
      INTO v_target_index
      FROM pg_catalog.jsonb_array_elements(v_existing_rows) existing;
   FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(v_rows)
   LOOP
     v_row_key:=private.cwl_witnessed_restore_row_key(v_row,v_spec.key_columns);
     IF v_target_index->v_row_key IS NULL THEN
       EXECUTE v_insert_sql USING v_row;
     END IF;
   END LOOP;
 END LOOP;
 -- Reread every table: no source entry may have become a different value.
 v_after:=public.cwl_export_owned_backup(ARRAY[p_clan_id]);
 v_after_tables:=v_after->'clans'->0->'tables';
 FOR v_spec IN SELECT * FROM (VALUES
  ('cwl_cloud_profiles', ARRAY['clan_id']::text[], 'clan_id,profile_json,data_version,revision,created_at,updated_at'),
  ('cwl_stat_wars', ARRAY['clan_id','war_key']::text[], 'clan_id,war_key,war_type,started_at,team_size,opponent_tag,opponent_name,source,roster_tags,finalized,updated_at,missed_log_complete,source_clash_tag'),
  ('cwl_stat_attacks', ARRAY['clan_id','war_key','attacker_tag','attack_order']::text[], 'clan_id,war_key,attacker_tag,attack_order,attacker_name,attacker_th,defender_tag,defender_name,defender_th,stars,destruction,created_at'),
  ('cwl_stat_missed', ARRAY['clan_id','war_key','player_tag']::text[], 'clan_id,war_key,player_tag,player_name,missed_count,created_at'),
  ('cwl_plan_review_state', ARRAY['clan_id']::text[], 'clan_id,cycle_id,season,locked,locked_by,locked_at,updated_at'),
  ('cwl_group_archives', ARRAY['clan_id','season']::text[], 'clan_id,season,clan_tag,group_json,created_at,updated_at'),
  ('cwl_own_lineup_archives', ARRAY['clan_id','season','day']::text[], 'clan_id,season,day,war_tag,state,team_size,lineup_json,created_at,updated_at'),
  ('cwl_profile_snapshots', ARRAY['id']::text[], 'id,clan_id,revision,profile_json,created_at'),
  ('cwl_change_events', ARRAY['id']::text[], 'id,clan_id,actor_id,revision,event_type,details,created_at'),
  ('cwl_plan_suggestions', ARRAY['id']::text[], 'id,clan_id,cycle_id,author_id,base_revision,suggested_profile,status,submitted_at,decided_at,decided_by'),
  ('cwl_missed_owner_decisions', ARRAY['id']::text[], 'id,clan_id,season,war_key,day,target_day,player_tag,decision,note,actor_id,created_at'),
  ('cwl_clan_member_tenure', ARRAY['clan_id','source_clash_tag','player_tag']::text[], 'clan_id,source_clash_tag,player_tag,first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits,last_clash_rank,last_clash_rank_at,rank_before_leave,rank_before_leave_at,last_donations,last_donations_at,last_donation_increase_at,last_donation_increase_by'),
  ('cwl_clan_management_rules', ARRAY['clan_id']::text[], 'clan_id,performance_enabled,performance_min_days,performance_min_attacks,performance_three_star_percent,performance_lookback_days,loyalty_min_days,absence_reset_days,revision,updated_at,loyalty_enabled,loyalty_min_donations,loyalty_min_active_days,loyalty_lookback_days'),
  ('cwl_clan_donation_observations', ARRAY['clan_id','source_clash_tag','player_tag','observed_at']::text[], 'clan_id,source_clash_tag,player_tag,observed_at,positive_delta'),
  ('cwl_clan_absence_observations', ARRAY['clan_id','source_clash_tag','player_tag','prior_visit_number']::text[], 'clan_id,source_clash_tag,player_tag,prior_visit_number,leave_observed_at,last_absent_observed_at,return_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds'),
  ('cwl_clan_review_decisions', ARRAY['clan_id','source_clash_tag','player_tag','review_kind']::text[], 'clan_id,source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at'),
  ('cwl_clan_cw_missed_decisions', ARRAY['id']::text[], 'id,clan_id,source_clash_tag,war_key,player_tag,decision,note,actor_id,created_at')
 ) AS contract(table_name,key_columns,insert_columns)
 LOOP
   SELECT COALESCE(pg_catalog.jsonb_object_agg(
      private.cwl_witnessed_restore_row_key(existing.value,v_spec.key_columns),
      existing.value),'{}'::jsonb)
      INTO v_target_index
      FROM pg_catalog.jsonb_array_elements(
        v_after_tables->v_spec.table_name) existing;
   FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(
     v_src_tables->v_spec.table_name)
   LOOP
     v_row_key:=private.cwl_witnessed_restore_row_key(v_row,v_spec.key_columns);
     v_prior:=v_target_index->v_row_key;
     IF v_prior IS DISTINCT FROM v_row THEN
       RAISE EXCEPTION 'Restore postcondition mismatch; all writes and checkpoint rolled back'
         USING ERRCODE='40001';
     END IF;
   END LOOP;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
   'scope','witnessed-same-clan-missing-history',
   'clan_id',p_clan_id,'receipt_id',p_receipt_id,
   'checkpoint_id',v_checkpoint,'applied',true,
   'new',v_missing,'conflict',0,'tables',v_table_stats,
   'mutation_permitted',false,'full_app_restore',false);
END;
$witnessed_missing_history$;

REVOKE ALL ON FUNCTION private.cwl_restore_witnessed_missing_history_worker(
 uuid,jsonb,uuid,bigint,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.cwl_restore_witnessed_missing_history_worker(
 uuid,jsonb,uuid,bigint,text,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cwl_restore_witnessed_missing_history(
 p_receipt_id uuid,p_payload jsonb,p_clan_id uuid,
 p_expected_revision bigint,p_expected_target_fingerprint text DEFAULT NULL,
 p_apply boolean DEFAULT false,p_confirmation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $wrapper$
 SELECT private.cwl_restore_witnessed_missing_history_worker(
   p_receipt_id,p_payload,p_clan_id,p_expected_revision,
   p_expected_target_fingerprint,p_apply,p_confirmation);
$wrapper$;
REVOKE ALL ON FUNCTION public.cwl_restore_witnessed_missing_history(
 uuid,jsonb,uuid,bigint,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_restore_witnessed_missing_history(
 uuid,jsonb,uuid,bigint,text,boolean,text) TO authenticated;
COMMENT ON FUNCTION public.cwl_restore_witnessed_missing_history(
 uuid,jsonb,uuid,bigint,text,boolean,text) IS
 'One-transaction replay of verified MISSING rows in the SAME clan, ONLY while the full original plan is identical. No public UI and NOT a full disaster-recovery import.';
