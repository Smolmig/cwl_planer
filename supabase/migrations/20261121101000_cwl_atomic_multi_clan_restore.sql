-- #178: one-RPC, all-or-nothing restore of multiple originally witnessed
-- CLOUD CLANS (2..10) to individually owner-linked, UNUSED replacement clans.
-- Built on the proven PR #333 17-dataset fresh-clan restore semantics.
--
-- The helper below is a deliberately private copy of the already PG17-tested
-- single-clan transaction, extended to select one item FROM THE SAME signed
-- multi-clan source and reverify the WHOLE ORIGINAL private server witness.
-- It has NO EXECUTE grant for authenticated or anon, and is accessible only
-- through the multi-owner worker that checks all tenants in advance.
-- Existing public single-clan restore remains unchanged.
-- Stable sorted advisory/profile/review locks precede ALL writes. Every inner
-- call and the final durable group manifest live in ONE PostgreSQL transaction:
-- a failure on the last target undoes ALL previous plans, stats, archives,
-- actor audits, per-clan checkpoints, and the group manifest.
--
-- No service-role/browser bypass; no auth/credentials/roles restore, no
-- merging new data into an active target, no total-DB-origin fabrication.
CREATE OR REPLACE FUNCTION private.cwl_restore_witnessed_multi_member_worker(
 p_receipt_id uuid,p_payload jsonb,p_source_index integer,
 p_target_clan_ids uuid[],p_target_clan_id uuid,
 p_expected_revision bigint,p_expected_target_fingerprint text,
 p_apply boolean,p_confirmation text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fresh_owner_restore$
DECLARE
 v_actor uuid:=auth.uid();
 v_proof jsonb;
 v_src jsonb;
 v_src_id uuid;
 v_src_tag text;
 v_target_tag text;
 v_before jsonb;
 v_after jsonb;
 v_src_tables jsonb;
 v_target_tables jsonb;
 v_after_tables jsonb;
 v_original_target_profile jsonb;
 v_original_target_revision bigint;
 v_src_profile jsonb;
 v_src_profile_row jsonb;
 v_review_rows jsonb;
 v_row jsonb;
 v_set record;
 v_insert_sql text;
 v_table_count integer:=0;
 v_restored_rows integer:=0;
 v_locked_count integer:=0;
 v_new_revision bigint;
 v_new_profile jsonb;
 v_checkpoint uuid;
 v_target_digest text;
 v_source_identities jsonb;
 v_missing_auth integer;
 v_expected jsonb;
 v_actual jsonb;
 v_expected_group jsonb;
 v_actual_group jsonb;
 v_key text;
 v_expected_n bigint;
 v_actual_n bigint;
BEGIN
 IF v_actor IS NULL OR p_receipt_id IS NULL OR
    p_target_clan_id IS NULL OR p_expected_revision IS NULL OR
    p_expected_revision<1 OR p_apply IS NULL OR
    pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR
    pg_catalog.octet_length(p_payload::text)>67108864 THEN
   RAISE EXCEPTION 'Original owner, payload, target and revision required'
     USING ERRCODE='42501';
 END IF;
 IF p_apply AND (p_confirmation IS DISTINCT FROM 'RESTORE_ORIGINAL_TO_EMPTY_CLAN'
      OR p_expected_target_fingerprint !~ '^[0-9a-f]{64}$') THEN
   RAISE EXCEPTION 'Reconfirm the current pristine-clan target fingerprint and restore scope'
     USING ERRCODE='42501';
 END IF;
 IF pg_catalog.jsonb_typeof(p_payload->'clans') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(p_payload->'clans')<>pg_catalog.cardinality(p_target_clan_ids)
    OR pg_catalog.cardinality(p_target_clan_ids) NOT BETWEEN 2 AND 10
    OR p_source_index IS NULL OR p_source_index<0
    OR p_source_index>=pg_catalog.cardinality(p_target_clan_ids)
    OR p_target_clan_ids[p_source_index+1] IS DISTINCT FROM p_target_clan_id THEN
   RAISE EXCEPTION 'Each signed source must map once to its exact authorized replacement target'
     USING ERRCODE='22023';
 END IF;
 v_src:=p_payload->'clans'->p_source_index;
 v_src_tag:=v_src->>'clash_tag';
 IF (v_src->>'source_clan_id') !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
   RAISE EXCEPTION 'Invalid original source clan ID' USING ERRCODE='22023';
 END IF;
 v_src_id:=(v_src->>'source_clan_id')::uuid;
 IF v_src_id=p_target_clan_id THEN
   RAISE EXCEPTION 'This is not a fresh replacement target; same-clan history restore is separate'
     USING ERRCODE='22023';
 END IF;
 IF p_apply THEN
   PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_target_clan_id::text,424242));
 END IF;
 SELECT c.clash_tag INTO v_target_tag
 FROM public.cwl_clans c
 JOIN public.cwl_clan_memberships m
   ON m.clan_id=c.id AND m.user_id=v_actor AND m.role='owner'
 WHERE c.id=p_target_clan_id AND c.owner_user_id=v_actor;
 IF NOT FOUND OR v_target_tag IS DISTINCT FROM v_src_tag THEN
   RAISE EXCEPTION 'Fresh target is not owned, linked and the identical Clash clan tag'
     USING ERRCODE='42501';
 END IF;
 -- A digest from a browser JSON file is not historic collector evidence.
 -- Re-evaluate a protected private SQL receipt on every preview and apply.
 v_proof:=public.cwl_verify_owned_backup_witness(
   p_receipt_id,p_payload,p_target_clan_ids);
 IF v_proof->>'verified' IS DISTINCT FROM 'true'
   OR v_proof->>'owner_user_id' IS DISTINCT FROM v_actor::text
   OR v_proof->>'receipt_id' IS DISTINCT FROM p_receipt_id::text THEN
   RAISE EXCEPTION 'Original server-origin witness did not validate the replacement clan'
     USING ERRCODE='42501';
 END IF;
 IF p_apply THEN
   PERFORM 1 FROM public.cwl_clans WHERE id=p_target_clan_id FOR UPDATE;
   SELECT revision,profile_json
     INTO v_original_target_revision,v_original_target_profile
   FROM public.cwl_cloud_profiles
   WHERE clan_id=p_target_clan_id FOR UPDATE;
 ELSE
   SELECT revision,profile_json
     INTO v_original_target_revision,v_original_target_profile
   FROM public.cwl_cloud_profiles WHERE clan_id=p_target_clan_id;
 END IF;
 IF NOT FOUND OR v_original_target_revision IS DISTINCT FROM p_expected_revision THEN
   RAISE EXCEPTION 'Target plan changed since preview'
     USING ERRCODE='40001';
 END IF;
 IF p_apply THEN
   PERFORM 1 FROM public.cwl_plan_review_state
    WHERE clan_id=p_target_clan_id FOR UPDATE;
 END IF;
 v_before:=public.cwl_export_owned_backup(ARRAY[p_target_clan_id]);
 v_target_digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   private.cwl_canonical_backup_payload(
     pg_catalog.jsonb_build_object('clans',v_before->'clans'))::text,'UTF8')),'hex');
 IF p_apply AND v_target_digest IS DISTINCT FROM p_expected_target_fingerprint THEN
   RAISE EXCEPTION 'Target data changed after comparison; refusing to overwrite any work'
     USING ERRCODE='40001';
 END IF;
 v_src_tables:=v_src->'tables';
 v_target_tables:=v_before->'clans'->0->'tables';
 IF pg_catalog.jsonb_typeof(v_src_tables) IS DISTINCT FROM 'object'
  OR pg_catalog.jsonb_typeof(v_target_tables) IS DISTINCT FROM 'object'
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_src_tables))<>17
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_target_tables))<>17 THEN
   RAISE EXCEPTION 'Signed snapshot and empty target must each provide all 17 datasets'
     USING ERRCODE='22023';
 END IF;
 IF pg_catalog.jsonb_array_length(v_src_tables->'cwl_cloud_profiles') IS DISTINCT FROM 1
 OR pg_catalog.jsonb_array_length(v_target_tables->'cwl_cloud_profiles') IS DISTINCT FROM 1 THEN
   RAISE EXCEPTION 'Both original and replacement require exactly one Cloud profile'
     USING ERRCODE='22023';
 END IF;
 v_src_profile_row:=v_src_tables->'cwl_cloud_profiles'->0;
 v_src_profile:=v_src_profile_row->'profile_json';
 IF v_src_profile_row->>'data_version' IS DISTINCT FROM '9'
    OR pg_catalog.jsonb_typeof(v_src_profile) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(v_src_profile->'members') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(v_src_profile->'archives') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(v_src_profile->'archivedMembers') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(v_src_profile->'dayGoals') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(v_src_profile->'config') IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(v_src_profile->'cwlLive') IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(v_src_profile->'locks') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(v_src_profile->'locks')<>7
    OR pg_catalog.octet_length(v_src_profile::text)>5242880 THEN
   RAISE EXCEPTION 'Original v9 Cloud profile cannot safely be reconstructed'
     USING ERRCODE='22023';
 END IF;
 -- Strong empty-target gate: archive, completed war, collector evidence,
 -- decisions, configured clan rules and historical plans always block.
 IF pg_catalog.jsonb_typeof(v_original_target_profile) IS DISTINCT FROM 'object'
    OR v_original_target_profile->'members' IS DISTINCT FROM '[]'::jsonb
    OR v_original_target_profile->'archivedMembers' IS DISTINCT FROM '[]'::jsonb
    OR v_original_target_profile->'archives' IS DISTINCT FROM '[]'::jsonb
    OR pg_catalog.jsonb_typeof(v_original_target_profile->'locks') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(v_original_target_profile->'locks')<>7
    OR v_original_target_profile#>'{cwlLive,rounds}' IS DISTINCT FROM '[]'::jsonb
    OR COALESCE((v_original_target_profile#>>'{cwlLive,warCount}')::integer,0)<>0
    OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_original_target_profile->'locks') d(day)
      WHERE d.day->>'locked' IS DISTINCT FROM 'false'
         OR COALESCE(d.day->>'warTag','')<>''
         OR COALESCE(d.day->>'endTime','')<>''
         OR d.day->'lineup' IS DISTINCT FROM '[]'::jsonb
         OR d.day->'snapshots' IS DISTINCT FROM '{}'::jsonb
    ) THEN
   RAISE EXCEPTION 'Only an unused replacement with seven empty, unlocked CWL days is eligible'
     USING ERRCODE='40001';
 END IF;
 IF pg_catalog.jsonb_array_length(v_target_tables->'cwl_change_events')>1
   OR EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(v_target_tables->'cwl_change_events') e(row_data)
    WHERE e.row_data->>'event_type' IS DISTINCT FROM 'profile_created'
   ) THEN
   RAISE EXCEPTION 'Target already contains non-creation audit activity'
     USING ERRCODE='40001';
 END IF;
 v_review_rows:=v_target_tables->'cwl_plan_review_state';
 IF pg_catalog.jsonb_array_length(v_review_rows)>1 OR EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(v_review_rows) r(row_data)
    WHERE r.row_data->>'locked' IS DISTINCT FROM 'false'
       OR r.row_data->>'locked_by' IS NOT NULL
       OR r.row_data->>'locked_at' IS NOT NULL
   ) THEN
   RAISE EXCEPTION 'Existing target plan approval state cannot be replaced'
     USING ERRCODE='40001';
 END IF;
 -- No other table may contain even one row. In particular, not even a
 -- partially-verified API war or a custom clan rule may be overwritten.
 FOR v_set IN SELECT * FROM (VALUES
  ('cwl_stat_wars','war_key,war_type,started_at,team_size,opponent_tag,opponent_name,source,roster_tags,finalized,updated_at,missed_log_complete,source_clash_tag','r."war_key",r."war_type",r."started_at",r."team_size",r."opponent_tag",r."opponent_name",r."source",r."roster_tags",r."finalized",r."updated_at",r."missed_log_complete",r."source_clash_tag"'),
  ('cwl_stat_attacks','war_key,attacker_tag,attack_order,attacker_name,attacker_th,defender_tag,defender_name,defender_th,stars,destruction,created_at','r."war_key",r."attacker_tag",r."attack_order",r."attacker_name",r."attacker_th",r."defender_tag",r."defender_name",r."defender_th",r."stars",r."destruction",r."created_at"'),
  ('cwl_stat_missed','war_key,player_tag,player_name,missed_count,created_at','r."war_key",r."player_tag",r."player_name",r."missed_count",r."created_at"'),
  ('cwl_group_archives','season,clan_tag,group_json,created_at,updated_at','r."season",r."clan_tag",r."group_json",r."created_at",r."updated_at"'),
  ('cwl_own_lineup_archives','season,day,war_tag,state,team_size,lineup_json,created_at,updated_at','r."season",r."day",r."war_tag",r."state",r."team_size",r."lineup_json",r."created_at",r."updated_at"'),
  ('cwl_profile_snapshots','revision,profile_json,created_at','r."revision",r."profile_json",r."created_at"'),
  ('cwl_change_events','actor_id,revision,event_type,details,created_at','r."actor_id",r."revision",r."event_type",r."details",r."created_at"'),
  ('cwl_plan_suggestions','cycle_id,author_id,base_revision,suggested_profile,status,submitted_at,decided_at,decided_by','r."cycle_id",r."author_id",r."base_revision",r."suggested_profile",r."status",r."submitted_at",r."decided_at",r."decided_by"'),
  ('cwl_missed_owner_decisions','season,war_key,day,target_day,player_tag,decision,note,actor_id,created_at','r."season",r."war_key",r."day",r."target_day",r."player_tag",r."decision",r."note",r."actor_id",r."created_at"'),
  ('cwl_clan_member_tenure','source_clash_tag,player_tag,first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits,last_clash_rank,last_clash_rank_at,rank_before_leave,rank_before_leave_at,last_donations,last_donations_at,last_donation_increase_at,last_donation_increase_by','r."source_clash_tag",r."player_tag",r."first_observed_at",r."last_present_at",r."last_observed_at",r."state_changed_at",r."is_present",r."confirmed_seconds",r."observed_visits",r."last_clash_rank",r."last_clash_rank_at",r."rank_before_leave",r."rank_before_leave_at",r."last_donations",r."last_donations_at",r."last_donation_increase_at",r."last_donation_increase_by"'),
  ('cwl_clan_management_rules','performance_enabled,performance_min_days,performance_min_attacks,performance_three_star_percent,performance_lookback_days,loyalty_min_days,absence_reset_days,revision,updated_at,loyalty_enabled,loyalty_min_donations,loyalty_min_active_days,loyalty_lookback_days','r."performance_enabled",r."performance_min_days",r."performance_min_attacks",r."performance_three_star_percent",r."performance_lookback_days",r."loyalty_min_days",r."absence_reset_days",r."revision",r."updated_at",r."loyalty_enabled",r."loyalty_min_donations",r."loyalty_min_active_days",r."loyalty_lookback_days"'),
  ('cwl_clan_donation_observations','source_clash_tag,player_tag,observed_at,positive_delta','r."source_clash_tag",r."player_tag",r."observed_at",r."positive_delta"'),
  ('cwl_clan_absence_observations','source_clash_tag,player_tag,prior_visit_number,leave_observed_at,last_absent_observed_at,return_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds','r."source_clash_tag",r."player_tag",r."prior_visit_number",r."leave_observed_at",r."last_absent_observed_at",r."return_observed_at",r."observed_absent_snapshots",r."current_streak_seconds",r."max_streak_seconds"'),
  ('cwl_clan_review_decisions','source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at','r."source_clash_tag",r."player_tag",r."review_kind",r."disposition",r."evidence_fingerprint",r."revision",r."updated_at"'),
  ('cwl_clan_cw_missed_decisions','source_clash_tag,war_key,player_tag,decision,note,actor_id,created_at','r."source_clash_tag",r."war_key",r."player_tag",r."decision",r."note",r."actor_id",r."created_at"')
 ) AS contract(table_name,insert_columns,select_columns)
 LOOP
   v_row:=v_src_tables->v_set.table_name;
   IF pg_catalog.jsonb_typeof(v_row) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_row)>100000
     OR pg_catalog.jsonb_typeof(v_target_tables->v_set.table_name) IS DISTINCT FROM 'array' THEN
     RAISE EXCEPTION 'Corrupt or oversized signed 17-table dataset'
       USING ERRCODE='22023';
   END IF;
   IF v_set.table_name NOT IN ('cwl_change_events')
      AND pg_catalog.jsonb_array_length(v_target_tables->v_set.table_name)<>0 THEN
     RAISE EXCEPTION 'Replacement clan is no longer empty; restore is forbidden'
       USING ERRCODE='40001';
   END IF;
   v_restored_rows:=v_restored_rows+pg_catalog.jsonb_array_length(v_row);
   v_table_count:=v_table_count+1;
 END LOOP;
 IF pg_catalog.jsonb_typeof(v_src_tables->'cwl_plan_review_state') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(v_src_tables->'cwl_plan_review_state')>1 THEN
   RAISE EXCEPTION 'Original plan review state is not valid'
     USING ERRCODE='22023';
 END IF;
 -- Verify that every non-null historical actor (rather than silently
 -- substituting the current actor) still exists in this Auth database.
 SELECT count(*) INTO v_missing_auth
 FROM (SELECT DISTINCT u.actor_id FROM (
   SELECT x.value->>'actor_id' AS actor_id FROM pg_catalog.jsonb_array_elements(
     v_src_tables->'cwl_change_events') x
   UNION ALL SELECT x.value->>'actor_id' FROM pg_catalog.jsonb_array_elements(
     v_src_tables->'cwl_missed_owner_decisions') x
   UNION ALL SELECT x.value->>'actor_id' FROM pg_catalog.jsonb_array_elements(
     v_src_tables->'cwl_clan_cw_missed_decisions') x
   UNION ALL SELECT x.value->>'author_id' FROM pg_catalog.jsonb_array_elements(
     v_src_tables->'cwl_plan_suggestions') x
   UNION ALL SELECT x.value->>'decided_by' FROM pg_catalog.jsonb_array_elements(
     v_src_tables->'cwl_plan_suggestions') x
   UNION ALL SELECT x.value->>'locked_by' FROM pg_catalog.jsonb_array_elements(
     v_src_tables->'cwl_plan_review_state') x
 ) u WHERE u.actor_id IS NOT NULL) names
 WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text=names.actor_id);
 IF v_missing_auth>0 THEN
   RAISE EXCEPTION 'Historical author account missing: cannot recreate user, provenance or membership'
     USING ERRCODE='23503';
 END IF;
 SELECT count(*) INTO v_locked_count
 FROM pg_catalog.jsonb_array_elements(v_src_profile->'locks') d(day)
 WHERE d.day->>'locked'='true';
 IF NOT p_apply THEN
   RETURN pg_catalog.jsonb_build_object(
    'scope','verified-pristine-new-clan-17-datasets',
    'source_clan_id',v_src_id,'target_clan_id',p_target_clan_id,
    'original_receipt_id',p_receipt_id,'original_digest',v_proof->>'payload_sha256',
    'target_fingerprint',v_target_digest,
    'expected_revision',v_original_target_revision,
    'source_rows',v_restored_rows,'restored_table_count',17,
    'source_locked_days',v_locked_count,
    'source_archive_rows',pg_catalog.jsonb_array_length(v_src_tables->'cwl_group_archives')
      +pg_catalog.jsonb_array_length(v_src_tables->'cwl_own_lineup_archives'),
    'applied',false,'mutation_permitted',false,'public_full_restore_available',false,
    'warning','Only unused owner-linked replacement clan; original authors preserved, synthetic target audit remains, source receipt must survive'
   );
 END IF;
 INSERT INTO private.cwl_portable_fresh_clan_recovery_checkpoints(
  actor_user_id,source_clan_id,target_clan_id,source_receipt_id,
  source_digest,before_fingerprint,before_snapshot,source_rows,
  before_revision,after_revision
 ) VALUES (
  v_actor,v_src_id,p_target_clan_id,p_receipt_id,
  v_proof->>'payload_sha256',v_target_digest,v_before,
  v_restored_rows+1,v_original_target_revision,v_original_target_revision+1
 ) RETURNING id INTO v_checkpoint;
 -- Restores the ENTIRE signed profile JSON, including 7 historical day locks,
 -- all members, archives and live observations. Normal profile guards,
 -- bump-revision and a current-actor audit event intentionally remain active.
 UPDATE public.cwl_cloud_profiles
   SET profile_json=v_src_profile
   WHERE clan_id=p_target_clan_id AND revision=v_original_target_revision
   RETURNING revision,profile_json INTO v_new_revision,v_new_profile;
 IF NOT FOUND OR v_new_revision IS DISTINCT FROM v_original_target_revision+1
     OR v_new_profile IS DISTINCT FROM v_src_profile THEN
   RAISE EXCEPTION 'Source plan content, trigger revision or CAS mismatch; whole restore rolled back'
     USING ERRCODE='40001';
 END IF;
 -- Auto-snapshot creates a synthetic empty-target profile on plan UPDATE.
 -- A genuinely fresh target had NO snapshots before this transaction; remove
 -- only that just-generated blank predecessor, then insert real source history.
 DELETE FROM public.cwl_profile_snapshots
  WHERE clan_id=p_target_clan_id AND revision=v_original_target_revision
   AND profile_json=v_original_target_profile;
 IF pg_catalog.jsonb_array_length(v_src_tables->'cwl_plan_review_state')=1 THEN
   v_row:=v_src_tables->'cwl_plan_review_state'->0;
   IF pg_catalog.jsonb_array_length(v_review_rows)=1 THEN
     UPDATE public.cwl_plan_review_state s
     SET cycle_id=(v_row->>'cycle_id')::uuid,
         season=v_row->>'season',
         locked=(v_row->>'locked')::boolean,
         locked_by=(v_row->>'locked_by')::uuid,
         locked_at=(v_row->>'locked_at')::timestamptz,
         updated_at=(v_row->>'updated_at')::timestamptz
     WHERE s.clan_id=p_target_clan_id;
   ELSE
     INSERT INTO public.cwl_plan_review_state (
      clan_id,cycle_id,season,locked,locked_by,locked_at,updated_at)
     SELECT p_target_clan_id,r.cycle_id,r.season,r.locked,r.locked_by,
       r.locked_at,r.updated_at
     FROM pg_catalog.jsonb_populate_record(
       NULL::public.cwl_plan_review_state,v_row) r;
   END IF;
 ELSIF pg_catalog.jsonb_array_length(v_review_rows)=1 THEN
   -- Pristine, unlocked target approval stub, never an active review.
   DELETE FROM public.cwl_plan_review_state WHERE clan_id=p_target_clan_id;
 END IF;
 -- Fixed dependency order: wars before attacks/misses; member-tenure before
 -- donation/absence/review evidence. Historical identity PKs are regenerated
 -- from target sequences/default gen_random_uuid(). No attack key rewrites.
 FOR v_set IN SELECT * FROM (VALUES
  ('cwl_stat_wars','war_key,war_type,started_at,team_size,opponent_tag,opponent_name,source,roster_tags,finalized,updated_at,missed_log_complete,source_clash_tag','r."war_key",r."war_type",r."started_at",r."team_size",r."opponent_tag",r."opponent_name",r."source",r."roster_tags",r."finalized",r."updated_at",r."missed_log_complete",r."source_clash_tag"'),
  ('cwl_stat_attacks','war_key,attacker_tag,attack_order,attacker_name,attacker_th,defender_tag,defender_name,defender_th,stars,destruction,created_at','r."war_key",r."attacker_tag",r."attack_order",r."attacker_name",r."attacker_th",r."defender_tag",r."defender_name",r."defender_th",r."stars",r."destruction",r."created_at"'),
  ('cwl_stat_missed','war_key,player_tag,player_name,missed_count,created_at','r."war_key",r."player_tag",r."player_name",r."missed_count",r."created_at"'),
  ('cwl_group_archives','season,clan_tag,group_json,created_at,updated_at','r."season",r."clan_tag",r."group_json",r."created_at",r."updated_at"'),
  ('cwl_own_lineup_archives','season,day,war_tag,state,team_size,lineup_json,created_at,updated_at','r."season",r."day",r."war_tag",r."state",r."team_size",r."lineup_json",r."created_at",r."updated_at"'),
  ('cwl_profile_snapshots','revision,profile_json,created_at','r."revision",r."profile_json",r."created_at"'),
  ('cwl_change_events','actor_id,revision,event_type,details,created_at','r."actor_id",r."revision",r."event_type",r."details",r."created_at"'),
  ('cwl_plan_suggestions','cycle_id,author_id,base_revision,suggested_profile,status,submitted_at,decided_at,decided_by','r."cycle_id",r."author_id",r."base_revision",r."suggested_profile",r."status",r."submitted_at",r."decided_at",r."decided_by"'),
  ('cwl_missed_owner_decisions','season,war_key,day,target_day,player_tag,decision,note,actor_id,created_at','r."season",r."war_key",r."day",r."target_day",r."player_tag",r."decision",r."note",r."actor_id",r."created_at"'),
  ('cwl_clan_member_tenure','source_clash_tag,player_tag,first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits,last_clash_rank,last_clash_rank_at,rank_before_leave,rank_before_leave_at,last_donations,last_donations_at,last_donation_increase_at,last_donation_increase_by','r."source_clash_tag",r."player_tag",r."first_observed_at",r."last_present_at",r."last_observed_at",r."state_changed_at",r."is_present",r."confirmed_seconds",r."observed_visits",r."last_clash_rank",r."last_clash_rank_at",r."rank_before_leave",r."rank_before_leave_at",r."last_donations",r."last_donations_at",r."last_donation_increase_at",r."last_donation_increase_by"'),
  ('cwl_clan_management_rules','performance_enabled,performance_min_days,performance_min_attacks,performance_three_star_percent,performance_lookback_days,loyalty_min_days,absence_reset_days,revision,updated_at,loyalty_enabled,loyalty_min_donations,loyalty_min_active_days,loyalty_lookback_days','r."performance_enabled",r."performance_min_days",r."performance_min_attacks",r."performance_three_star_percent",r."performance_lookback_days",r."loyalty_min_days",r."absence_reset_days",r."revision",r."updated_at",r."loyalty_enabled",r."loyalty_min_donations",r."loyalty_min_active_days",r."loyalty_lookback_days"'),
  ('cwl_clan_donation_observations','source_clash_tag,player_tag,observed_at,positive_delta','r."source_clash_tag",r."player_tag",r."observed_at",r."positive_delta"'),
  ('cwl_clan_absence_observations','source_clash_tag,player_tag,prior_visit_number,leave_observed_at,last_absent_observed_at,return_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds','r."source_clash_tag",r."player_tag",r."prior_visit_number",r."leave_observed_at",r."last_absent_observed_at",r."return_observed_at",r."observed_absent_snapshots",r."current_streak_seconds",r."max_streak_seconds"'),
  ('cwl_clan_review_decisions','source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at','r."source_clash_tag",r."player_tag",r."review_kind",r."disposition",r."evidence_fingerprint",r."revision",r."updated_at"'),
  ('cwl_clan_cw_missed_decisions','source_clash_tag,war_key,player_tag,decision,note,actor_id,created_at','r."source_clash_tag",r."war_key",r."player_tag",r."decision",r."note",r."actor_id",r."created_at"')
 ) AS contract(table_name,insert_columns,select_columns)
 LOOP
   v_insert_sql:=pg_catalog.format(
     'INSERT INTO public.%I (clan_id,%s) SELECT $1::uuid,%s FROM pg_catalog.jsonb_populate_recordset(NULL::public.%I,$2) AS r',
     v_set.table_name,v_set.insert_columns,v_set.select_columns,v_set.table_name);
   EXECUTE v_insert_sql USING p_target_clan_id,v_src_tables->v_set.table_name;
 END LOOP;
 -- Canonical 17-table postcondition: for every source business data row,
 -- target preserves every original field except its tenant UUID and surrogate
 -- generated PK. Source audit/decision creators are NEVER rewritten.
 v_after:=public.cwl_export_owned_backup(ARRAY[p_target_clan_id]);
 v_after_tables:=v_after->'clans'->0->'tables';
 IF v_after_tables->'cwl_cloud_profiles'->0->'profile_json' IS DISTINCT FROM v_src_profile
   OR (v_after_tables->'cwl_cloud_profiles'->0->>'revision')::bigint
       IS DISTINCT FROM v_new_revision THEN
   RAISE EXCEPTION 'Restored profile or revision is not the verified content'
     USING ERRCODE='40001';
 END IF;
 -- Approval state has a stable business identity (the target clan).
 v_expected:=v_src_tables->'cwl_plan_review_state';
 v_actual:=v_after_tables->'cwl_plan_review_state';
 IF (SELECT COALESCE(pg_catalog.jsonb_agg(x.value-'clan_id'),'[]'::jsonb)
       FROM pg_catalog.jsonb_array_elements(v_expected) x)
    IS DISTINCT FROM
    (SELECT COALESCE(pg_catalog.jsonb_agg(x.value-'clan_id'),'[]'::jsonb)
       FROM pg_catalog.jsonb_array_elements(v_actual) x) THEN
   RAISE EXCEPTION 'Restored locked plan approval state differs from original'
     USING ERRCODE='40001';
 END IF;
 FOR v_set IN SELECT * FROM (VALUES
  ('cwl_stat_wars','war_key,war_type,started_at,team_size,opponent_tag,opponent_name,source,roster_tags,finalized,updated_at,missed_log_complete,source_clash_tag','r."war_key",r."war_type",r."started_at",r."team_size",r."opponent_tag",r."opponent_name",r."source",r."roster_tags",r."finalized",r."updated_at",r."missed_log_complete",r."source_clash_tag"'),
  ('cwl_stat_attacks','war_key,attacker_tag,attack_order,attacker_name,attacker_th,defender_tag,defender_name,defender_th,stars,destruction,created_at','r."war_key",r."attacker_tag",r."attack_order",r."attacker_name",r."attacker_th",r."defender_tag",r."defender_name",r."defender_th",r."stars",r."destruction",r."created_at"'),
  ('cwl_stat_missed','war_key,player_tag,player_name,missed_count,created_at','r."war_key",r."player_tag",r."player_name",r."missed_count",r."created_at"'),
  ('cwl_group_archives','season,clan_tag,group_json,created_at,updated_at','r."season",r."clan_tag",r."group_json",r."created_at",r."updated_at"'),
  ('cwl_own_lineup_archives','season,day,war_tag,state,team_size,lineup_json,created_at,updated_at','r."season",r."day",r."war_tag",r."state",r."team_size",r."lineup_json",r."created_at",r."updated_at"'),
  ('cwl_profile_snapshots','revision,profile_json,created_at','r."revision",r."profile_json",r."created_at"'),
  ('cwl_change_events','actor_id,revision,event_type,details,created_at','r."actor_id",r."revision",r."event_type",r."details",r."created_at"'),
  ('cwl_plan_suggestions','cycle_id,author_id,base_revision,suggested_profile,status,submitted_at,decided_at,decided_by','r."cycle_id",r."author_id",r."base_revision",r."suggested_profile",r."status",r."submitted_at",r."decided_at",r."decided_by"'),
  ('cwl_missed_owner_decisions','season,war_key,day,target_day,player_tag,decision,note,actor_id,created_at','r."season",r."war_key",r."day",r."target_day",r."player_tag",r."decision",r."note",r."actor_id",r."created_at"'),
  ('cwl_clan_member_tenure','source_clash_tag,player_tag,first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits,last_clash_rank,last_clash_rank_at,rank_before_leave,rank_before_leave_at,last_donations,last_donations_at,last_donation_increase_at,last_donation_increase_by','r."source_clash_tag",r."player_tag",r."first_observed_at",r."last_present_at",r."last_observed_at",r."state_changed_at",r."is_present",r."confirmed_seconds",r."observed_visits",r."last_clash_rank",r."last_clash_rank_at",r."rank_before_leave",r."rank_before_leave_at",r."last_donations",r."last_donations_at",r."last_donation_increase_at",r."last_donation_increase_by"'),
  ('cwl_clan_management_rules','performance_enabled,performance_min_days,performance_min_attacks,performance_three_star_percent,performance_lookback_days,loyalty_min_days,absence_reset_days,revision,updated_at,loyalty_enabled,loyalty_min_donations,loyalty_min_active_days,loyalty_lookback_days','r."performance_enabled",r."performance_min_days",r."performance_min_attacks",r."performance_three_star_percent",r."performance_lookback_days",r."loyalty_min_days",r."absence_reset_days",r."revision",r."updated_at",r."loyalty_enabled",r."loyalty_min_donations",r."loyalty_min_active_days",r."loyalty_lookback_days"'),
  ('cwl_clan_donation_observations','source_clash_tag,player_tag,observed_at,positive_delta','r."source_clash_tag",r."player_tag",r."observed_at",r."positive_delta"'),
  ('cwl_clan_absence_observations','source_clash_tag,player_tag,prior_visit_number,leave_observed_at,last_absent_observed_at,return_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds','r."source_clash_tag",r."player_tag",r."prior_visit_number",r."leave_observed_at",r."last_absent_observed_at",r."return_observed_at",r."observed_absent_snapshots",r."current_streak_seconds",r."max_streak_seconds"'),
  ('cwl_clan_review_decisions','source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at','r."source_clash_tag",r."player_tag",r."review_kind",r."disposition",r."evidence_fingerprint",r."revision",r."updated_at"'),
  ('cwl_clan_cw_missed_decisions','source_clash_tag,war_key,player_tag,decision,note,actor_id,created_at','r."source_clash_tag",r."war_key",r."player_tag",r."decision",r."note",r."actor_id",r."created_at"')
 ) AS contract(table_name,insert_columns,select_columns)
 LOOP
   v_expected:=v_src_tables->v_set.table_name;
   v_actual:=v_after_tables->v_set.table_name;
   SELECT COALESCE(pg_catalog.jsonb_object_agg(x.key,x.cnt),'{}'::jsonb)
     INTO v_expected_group FROM (
      SELECT (e.value-'id'-'clan_id')::text AS key,count(*) AS cnt
      FROM pg_catalog.jsonb_array_elements(v_expected) e
      GROUP BY (e.value-'id'-'clan_id')
     ) x;
   SELECT COALESCE(pg_catalog.jsonb_object_agg(x.key,x.cnt),'{}'::jsonb)
     INTO v_actual_group FROM (
      SELECT (e.value-'id'-'clan_id')::text AS key,count(*) AS cnt
      FROM pg_catalog.jsonb_array_elements(v_actual) e
      GROUP BY (e.value-'id'-'clan_id')
     ) x;
   IF v_set.table_name='cwl_change_events' THEN
      -- New owner-created and restore audit are honest additional events,
      -- NEVER substituted for historic source activities.
      FOR v_key,v_expected_n IN SELECT key,(value #>> '{}')::bigint
        FROM pg_catalog.jsonb_each(v_expected_group)
      LOOP
        v_actual_n:=COALESCE((v_actual_group->>v_key)::bigint,0);
        IF v_actual_n<v_expected_n THEN
          RAISE EXCEPTION 'Audit lineage was lost during restore; rollback'
            USING ERRCODE='40001';
        END IF;
      END LOOP;
   ELSIF v_expected_group IS DISTINCT FROM v_actual_group THEN
     RAISE EXCEPTION '17-table restored dataset % differs; rollback',v_set.table_name
       USING ERRCODE='40001';
   END IF;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
  'scope','verified-pristine-new-clan-17-datasets',
  'source_clan_id',v_src_id,'target_clan_id',p_target_clan_id,
  'original_receipt_id',p_receipt_id,'checkpoint_id',v_checkpoint,
  'expected_revision',v_original_target_revision,
  'applied_revision',v_new_revision,
  'original_digest',v_proof->>'payload_sha256',
  'source_rows',v_restored_rows,'restored_table_count',17,
  'source_locked_days',v_locked_count,
  'applied',true,'mutation_permitted',false,
  'public_full_restore_available',false,
  'note','Historical evidence retained; restored profile carries a NEW current-actor audit and new revision; generated record IDs remapped'
 );
END;
$fresh_owner_restore$;
REVOKE ALL ON FUNCTION private.cwl_restore_witnessed_multi_member_worker(
 uuid,jsonb,integer,uuid[],uuid,bigint,text,boolean,text)
 FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS private.cwl_portable_multi_clan_recovery_sessions (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 actor_user_id uuid NOT NULL,
 source_receipt_id uuid NOT NULL,
 source_digest text NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
 source_clan_ids uuid[] NOT NULL,
 target_clan_ids uuid[] NOT NULL,
 checkpoint_ids uuid[] NOT NULL,
 source_rows bigint NOT NULL CHECK (source_rows>=0),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 CONSTRAINT multi_clan_check_length CHECK(
  pg_catalog.cardinality(source_clan_ids) BETWEEN 2 AND 10
  AND pg_catalog.cardinality(source_clan_ids)=pg_catalog.cardinality(target_clan_ids)
  AND pg_catalog.cardinality(source_clan_ids)=pg_catalog.cardinality(checkpoint_ids))
);
ALTER TABLE private.cwl_portable_multi_clan_recovery_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.cwl_portable_multi_clan_recovery_sessions
 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.cwl_portable_multi_clan_recovery_sessions TO authenticated;
DROP POLICY IF EXISTS cwl_multi_restore_current_owner_read
 ON private.cwl_portable_multi_clan_recovery_sessions;
CREATE POLICY cwl_multi_restore_current_owner_read
 ON private.cwl_portable_multi_clan_recovery_sessions
 FOR SELECT TO authenticated USING(
  actor_user_id=(SELECT auth.uid())
  AND NOT EXISTS(
   SELECT 1 FROM pg_catalog.unnest(
     private.cwl_portable_multi_clan_recovery_sessions.target_clan_ids) x(clan_id)
   WHERE NOT EXISTS(
     SELECT 1 FROM public.cwl_clans c
     JOIN public.cwl_clan_memberships m
       ON m.clan_id=c.id
      AND m.user_id=private.cwl_portable_multi_clan_recovery_sessions.actor_user_id
      AND m.role='owner'
     WHERE c.id=x.clan_id
       AND c.owner_user_id=private.cwl_portable_multi_clan_recovery_sessions.actor_user_id
   )
  )
 );
COMMENT ON TABLE private.cwl_portable_multi_clan_recovery_sessions IS
 'Original source witness, complete target mapping and individual atomic checkpoints for ALL-or-NOTHING multi-clan restore. SELECT only while owner of EVERY target.';

CREATE OR REPLACE FUNCTION private.cwl_restore_witnessed_multi_clans_worker(
 p_receipt_id uuid,p_payload jsonb,p_target_clan_ids uuid[],
 p_expected_revisions bigint[],p_expected_target_fingerprints text[],
 p_apply boolean,p_confirmation text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $multi_atomic$
DECLARE
 v_actor uuid:=auth.uid();
 v_count integer;
 v_i integer;
 v_target uuid;
 v_src_ids uuid[]:=ARRAY[]::uuid[];
 v_checkpoints uuid[]:=ARRAY[]::uuid[];
 v_proof jsonb;
 v_preview jsonb;
 v_applied jsonb;
 v_previews jsonb:='[]'::jsonb;
 v_result_rows jsonb:='[]'::jsonb;
 v_total_rows bigint:=0;
 v_session_id uuid;
 v_target_tag text;
 v_current_revision bigint;
 v_source_id_text text;
BEGIN
 IF v_actor IS NULL OR p_receipt_id IS NULL
    OR p_apply IS NULL OR
    pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR pg_catalog.octet_length(p_payload::text)>67108864
    OR pg_catalog.jsonb_typeof(p_payload->'clans') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Original authenticated multi-clan snapshot required'
      USING ERRCODE='42501';
 END IF;
 v_count:=pg_catalog.jsonb_array_length(p_payload->'clans');
 IF v_count NOT BETWEEN 2 AND 10
    OR p_target_clan_ids IS NULL
    OR p_expected_revisions IS NULL
    OR pg_catalog.cardinality(p_target_clan_ids)<>v_count
    OR pg_catalog.cardinality(p_expected_revisions)<>v_count
    OR (SELECT count(DISTINCT t.id)
        FROM pg_catalog.unnest(p_target_clan_ids) t(id))<>v_count
    OR (SELECT count(*) FROM pg_catalog.unnest(p_expected_revisions) r(x)
        WHERE r.x IS NULL OR r.x<1)<>0 THEN
    RAISE EXCEPTION 'Expected 2–10 distinct targets and matching non-null plan revisions'
      USING ERRCODE='22023';
 END IF;
 IF p_apply AND (
   p_confirmation IS DISTINCT FROM 'RESTORE_ALL_VERIFIED_EMPTY_CLANS'
   OR p_expected_target_fingerprints IS NULL
   OR pg_catalog.cardinality(p_expected_target_fingerprints)<>v_count
   OR EXISTS(
     SELECT 1 FROM pg_catalog.unnest(p_expected_target_fingerprints) x(digest)
     WHERE x.digest IS NULL OR x.digest !~ '^[a-f0-9]{64}$')) THEN
   RAISE EXCEPTION 'All owner targets must be previewed and explicitly confirmed together'
     USING ERRCODE='42501';
 END IF;
 -- Check ALL memberships against the user's actual current identity and
 -- legal owner role, never from tenant names, JWT-editable metadata or backup.
 FOR v_i IN 1..v_count LOOP
   v_target:=p_target_clan_ids[v_i];
   v_source_id_text:=p_payload#>>ARRAY['clans',(v_i-1)::text,'source_clan_id'];
   IF v_target IS NULL OR v_source_id_text IS NULL OR
      v_source_id_text !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}
   IF v_src_ids[v_i]=v_target THEN
      RAISE EXCEPTION 'Existing original clan is not a pristine replacement'
        USING ERRCODE='22023';
   END IF;
   SELECT c.clash_tag INTO v_target_tag
   FROM public.cwl_clans c
   JOIN public.cwl_clan_memberships m
     ON m.clan_id=c.id AND m.user_id=v_actor AND m.role='owner'
   WHERE c.id=v_target AND c.owner_user_id=v_actor;
   IF NOT FOUND OR v_target_tag IS DISTINCT FROM
       p_payload->'clans'->(v_i-1)->>'clash_tag' THEN
     RAISE EXCEPTION 'All replacement clans must be currently owned with matching Clash tags'
       USING ERRCODE='42501';
   END IF;
 END LOOP;
 IF (SELECT count(DISTINCT x.id) FROM pg_catalog.unnest(v_src_ids) x(id))
    <>v_count THEN
   RAISE EXCEPTION 'Duplicate original clan in multi-clan recovery'
      USING ERRCODE='22023';
 END IF;
 -- Verify the COMPLETE single signed backup against a single private
 -- server-origin witness. Partial inputs or malicious per-clan splicing fail.
 v_proof:=public.cwl_verify_owned_backup_witness(
   p_receipt_id,p_payload,p_target_clan_ids);
 IF v_proof->>'verified' IS DISTINCT FROM 'true'
    OR v_proof->>'owner_user_id' IS DISTINCT FROM v_actor::text
    OR (v_proof->>'source_clan_count')::integer<>v_count THEN
   RAISE EXCEPTION 'Incomplete or modified multi-clan server-origin witness'
     USING ERRCODE='42501';
 END IF;
 IF p_apply THEN
   -- Avoid inverted lock ordering between two simultaneous multi-clan
   -- transactions that supply the same targets in different source orders.
   -- Profile-before-review order agrees with the existing plan-write guard.
   FOR v_target IN SELECT x.id FROM pg_catalog.unnest(p_target_clan_ids) x(id)
     ORDER BY x.id
   LOOP
     PERFORM pg_catalog.pg_advisory_xact_lock(
       pg_catalog.hashtextextended(v_target::text,424242));
     PERFORM 1 FROM public.cwl_clans WHERE id=v_target FOR UPDATE;
     PERFORM 1 FROM public.cwl_cloud_profiles WHERE clan_id=v_target FOR UPDATE;
     PERFORM 1 FROM public.cwl_plan_review_state
       WHERE clan_id=v_target FOR UPDATE;
   END LOOP;
 END IF;
 -- Execute ALL DRY RUNS first. Nothing is written if ANY target contains
 -- wars/old CWL, a different source tag, missing authors or a stale revision.
 FOR v_i IN 1..v_count LOOP
   v_preview:=private.cwl_restore_witnessed_multi_member_worker(
     p_receipt_id,p_payload,v_i-1,p_target_clan_ids,
     p_target_clan_ids[v_i],p_expected_revisions[v_i],
     NULL,false,NULL);
   IF v_preview->>'applied' IS DISTINCT FROM 'false'
      OR v_preview->>'scope' IS DISTINCT FROM 'verified-pristine-new-clan-17-datasets'
      OR (v_preview->>'restored_table_count')::integer<>17 OR
      v_preview->>'target_clan_id' IS DISTINCT FROM p_target_clan_ids[v_i]::text THEN
     RAISE EXCEPTION 'One of the full 17-area previews could not be validated'
       USING ERRCODE='40001';
   END IF;
   IF p_apply AND v_preview->>'target_fingerprint'
         IS DISTINCT FROM p_expected_target_fingerprints[v_i] THEN
     RAISE EXCEPTION 'One replacement changed after multi-clan preview; abort ALL clans'
       USING ERRCODE='40001';
   END IF;
   v_previews:=v_previews||pg_catalog.jsonb_build_array(v_preview);
   v_total_rows:=v_total_rows+(v_preview->>'source_rows')::bigint;
 END LOOP;
 IF NOT p_apply THEN
   RETURN pg_catalog.jsonb_build_object(
     'scope','verified-multi-pristine-clan-17-datasets',
     'source_clan_count',v_count,'target_clan_count',v_count,
     'source_clan_ids',pg_catalog.to_jsonb(v_src_ids),
     'target_clan_ids',pg_catalog.to_jsonb(p_target_clan_ids),
     'original_receipt_id',p_receipt_id,
     'original_digest',v_proof->>'payload_sha256',
     'expected_revisions',pg_catalog.to_jsonb(p_expected_revisions),
     'source_rows',v_total_rows,
     'previews',v_previews,'applied',false,
     'mutation_permitted',false,'public_full_restore_available',false,
     'warning','All-or-nothing only on original-witnessed owned pristine replacement clans. Original user accounts and server receipt must still exist.'
   );
 END IF;
 -- All N replays happen without independent exception handlers in this
 -- one RPC transaction. Any failure anywhere in any target rolls back all.
 FOR v_i IN 1..v_count LOOP
   v_applied:=private.cwl_restore_witnessed_multi_member_worker(
     p_receipt_id,p_payload,v_i-1,p_target_clan_ids,
     p_target_clan_ids[v_i],p_expected_revisions[v_i],
     p_expected_target_fingerprints[v_i],true,
     'RESTORE_ORIGINAL_TO_EMPTY_CLAN');
   IF v_applied->>'applied' IS DISTINCT FROM 'true'
      OR v_applied->>'scope' IS DISTINCT FROM 'verified-pristine-new-clan-17-datasets'
      OR (v_applied->>'restored_table_count')::integer<>17
      OR v_applied->>'source_clan_id' IS DISTINCT FROM v_src_ids[v_i]::text
      OR v_applied->>'target_clan_id' IS DISTINCT FROM p_target_clan_ids[v_i]::text
      OR v_applied->>'checkpoint_id' IS NULL THEN
     RAISE EXCEPTION 'A verified full restore member failed; rollback ALL targets'
       USING ERRCODE='40001';
   END IF;
   v_checkpoints:=pg_catalog.array_append(
     v_checkpoints,(v_applied->>'checkpoint_id')::uuid);
   v_result_rows:=v_result_rows||pg_catalog.jsonb_build_array(v_applied);
 END LOOP;
 INSERT INTO private.cwl_portable_multi_clan_recovery_sessions(
   actor_user_id,source_receipt_id,source_digest,source_clan_ids,
   target_clan_ids,checkpoint_ids,source_rows
 ) VALUES(
   v_actor,p_receipt_id,v_proof->>'payload_sha256',v_src_ids,
   p_target_clan_ids,v_checkpoints,v_total_rows
 ) RETURNING id INTO v_session_id;
 RETURN pg_catalog.jsonb_build_object(
    'scope','verified-multi-pristine-clan-17-datasets',
    'applied',true,'mutation_permitted',false,'public_full_restore_available',false,
    'source_clan_count',v_count,'target_clan_count',v_count,
    'source_clan_ids',pg_catalog.to_jsonb(v_src_ids),
    'target_clan_ids',pg_catalog.to_jsonb(p_target_clan_ids),
    'original_receipt_id',p_receipt_id,
    'original_digest',v_proof->>'payload_sha256',
    'recovery_session_id',v_session_id,
    'checkpoints',pg_catalog.to_jsonb(v_checkpoints),
    'source_rows',v_total_rows,'restores',v_result_rows
 );
END;
$multi_atomic$;
REVOKE ALL ON FUNCTION private.cwl_restore_witnessed_multi_clans_worker(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.cwl_restore_witnessed_multi_clans_worker(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.cwl_restore_witnessed_multi_clans(
 p_receipt_id uuid,p_payload jsonb,p_target_clan_ids uuid[],
 p_expected_revisions bigint[],p_expected_target_fingerprints text[] DEFAULT NULL,
 p_apply boolean DEFAULT false,p_confirmation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $public_multi$
 SELECT private.cwl_restore_witnessed_multi_clans_worker(
   p_receipt_id,p_payload,p_target_clan_ids,p_expected_revisions,
   p_expected_target_fingerprints,p_apply,p_confirmation);
$public_multi$;
REVOKE ALL ON FUNCTION public.cwl_restore_witnessed_multi_clans(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_restore_witnessed_multi_clans(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text) TO authenticated;
COMMENT ON FUNCTION public.cwl_restore_witnessed_multi_clans(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text) IS
 'One verified original multi-clan witness; one all-or-nothing PostgreSQL-17 17-area restore for 2..10 distinct, unused, newly owned same-Clash-tag replacement targets. No public UI, auth recreation or merge of active plans.';
 THEN
     RAISE EXCEPTION 'Invalid source/target clan identity at position % (source %, target %)',v_i,v_source_id_text,v_target
       USING ERRCODE='22023';
   END IF;
   v_src_ids:=pg_catalog.array_append(
     v_src_ids,v_source_id_text::uuid);
   IF v_src_ids[v_i]=v_target THEN
      RAISE EXCEPTION 'Existing original clan is not a pristine replacement'
        USING ERRCODE='22023';
   END IF;
   SELECT c.clash_tag INTO v_target_tag
   FROM public.cwl_clans c
   JOIN public.cwl_clan_memberships m
     ON m.clan_id=c.id AND m.user_id=v_actor AND m.role='owner'
   WHERE c.id=v_target AND c.owner_user_id=v_actor;
   IF NOT FOUND OR v_target_tag IS DISTINCT FROM
       p_payload->'clans'->(v_i-1)->>'clash_tag' THEN
     RAISE EXCEPTION 'All replacement clans must be currently owned with matching Clash tags'
       USING ERRCODE='42501';
   END IF;
 END LOOP;
 IF (SELECT count(DISTINCT x.id) FROM pg_catalog.unnest(v_src_ids) x(id))
    <>v_count THEN
   RAISE EXCEPTION 'Duplicate original clan in multi-clan recovery'
      USING ERRCODE='22023';
 END IF;
 -- Verify the COMPLETE single signed backup against a single private
 -- server-origin witness. Partial inputs or malicious per-clan splicing fail.
 v_proof:=public.cwl_verify_owned_backup_witness(
   p_receipt_id,p_payload,p_target_clan_ids);
 IF v_proof->>'verified' IS DISTINCT FROM 'true'
    OR v_proof->>'owner_user_id' IS DISTINCT FROM v_actor::text
    OR (v_proof->>'source_clan_count')::integer<>v_count THEN
   RAISE EXCEPTION 'Incomplete or modified multi-clan server-origin witness'
     USING ERRCODE='42501';
 END IF;
 IF p_apply THEN
   -- Avoid inverted lock ordering between two simultaneous multi-clan
   -- transactions that supply the same targets in different source orders.
   -- Profile-before-review order agrees with the existing plan-write guard.
   FOR v_target IN SELECT x.id FROM pg_catalog.unnest(p_target_clan_ids) x(id)
     ORDER BY x.id
   LOOP
     PERFORM pg_catalog.pg_advisory_xact_lock(
       pg_catalog.hashtextextended(v_target::text,424242));
     PERFORM 1 FROM public.cwl_clans WHERE id=v_target FOR UPDATE;
     PERFORM 1 FROM public.cwl_cloud_profiles WHERE clan_id=v_target FOR UPDATE;
     PERFORM 1 FROM public.cwl_plan_review_state
       WHERE clan_id=v_target FOR UPDATE;
   END LOOP;
 END IF;
 -- Execute ALL DRY RUNS first. Nothing is written if ANY target contains
 -- wars/old CWL, a different source tag, missing authors or a stale revision.
 FOR v_i IN 1..v_count LOOP
   v_preview:=private.cwl_restore_witnessed_multi_member_worker(
     p_receipt_id,p_payload,v_i-1,p_target_clan_ids,
     p_target_clan_ids[v_i],p_expected_revisions[v_i],
     NULL,false,NULL);
   IF v_preview->>'applied' IS DISTINCT FROM 'false'
      OR v_preview->>'scope' IS DISTINCT FROM 'verified-pristine-new-clan-17-datasets'
      OR (v_preview->>'restored_table_count')::integer<>17 OR
      v_preview->>'target_clan_id' IS DISTINCT FROM p_target_clan_ids[v_i]::text THEN
     RAISE EXCEPTION 'One of the full 17-area previews could not be validated'
       USING ERRCODE='40001';
   END IF;
   IF p_apply AND v_preview->>'target_fingerprint'
         IS DISTINCT FROM p_expected_target_fingerprints[v_i] THEN
     RAISE EXCEPTION 'One replacement changed after multi-clan preview; abort ALL clans'
       USING ERRCODE='40001';
   END IF;
   v_previews:=v_previews||pg_catalog.jsonb_build_array(v_preview);
   v_total_rows:=v_total_rows+(v_preview->>'source_rows')::bigint;
 END LOOP;
 IF NOT p_apply THEN
   RETURN pg_catalog.jsonb_build_object(
     'scope','verified-multi-pristine-clan-17-datasets',
     'source_clan_count',v_count,'target_clan_count',v_count,
     'source_clan_ids',pg_catalog.to_jsonb(v_src_ids),
     'target_clan_ids',pg_catalog.to_jsonb(p_target_clan_ids),
     'original_receipt_id',p_receipt_id,
     'original_digest',v_proof->>'payload_sha256',
     'expected_revisions',pg_catalog.to_jsonb(p_expected_revisions),
     'source_rows',v_total_rows,
     'previews',v_previews,'applied',false,
     'mutation_permitted',false,'public_full_restore_available',false,
     'warning','All-or-nothing only on original-witnessed owned pristine replacement clans. Original user accounts and server receipt must still exist.'
   );
 END IF;
 -- All N replays happen without independent exception handlers in this
 -- one RPC transaction. Any failure anywhere in any target rolls back all.
 FOR v_i IN 1..v_count LOOP
   v_applied:=private.cwl_restore_witnessed_multi_member_worker(
     p_receipt_id,p_payload,v_i-1,p_target_clan_ids,
     p_target_clan_ids[v_i],p_expected_revisions[v_i],
     p_expected_target_fingerprints[v_i],true,
     'RESTORE_ORIGINAL_TO_EMPTY_CLAN');
   IF v_applied->>'applied' IS DISTINCT FROM 'true'
      OR v_applied->>'scope' IS DISTINCT FROM 'verified-pristine-new-clan-17-datasets'
      OR (v_applied->>'restored_table_count')::integer<>17
      OR v_applied->>'source_clan_id' IS DISTINCT FROM v_src_ids[v_i]::text
      OR v_applied->>'target_clan_id' IS DISTINCT FROM p_target_clan_ids[v_i]::text
      OR v_applied->>'checkpoint_id' IS NULL THEN
     RAISE EXCEPTION 'A verified full restore member failed; rollback ALL targets'
       USING ERRCODE='40001';
   END IF;
   v_checkpoints:=pg_catalog.array_append(
     v_checkpoints,(v_applied->>'checkpoint_id')::uuid);
   v_result_rows:=v_result_rows||pg_catalog.jsonb_build_array(v_applied);
 END LOOP;
 INSERT INTO private.cwl_portable_multi_clan_recovery_sessions(
   actor_user_id,source_receipt_id,source_digest,source_clan_ids,
   target_clan_ids,checkpoint_ids,source_rows
 ) VALUES(
   v_actor,p_receipt_id,v_proof->>'payload_sha256',v_src_ids,
   p_target_clan_ids,v_checkpoints,v_total_rows
 ) RETURNING id INTO v_session_id;
 RETURN pg_catalog.jsonb_build_object(
    'scope','verified-multi-pristine-clan-17-datasets',
    'applied',true,'mutation_permitted',false,'public_full_restore_available',false,
    'source_clan_count',v_count,'target_clan_count',v_count,
    'source_clan_ids',pg_catalog.to_jsonb(v_src_ids),
    'target_clan_ids',pg_catalog.to_jsonb(p_target_clan_ids),
    'original_receipt_id',p_receipt_id,
    'original_digest',v_proof->>'payload_sha256',
    'recovery_session_id',v_session_id,
    'checkpoints',pg_catalog.to_jsonb(v_checkpoints),
    'source_rows',v_total_rows,'restores',v_result_rows
 );
END;
$multi_atomic$;
REVOKE ALL ON FUNCTION private.cwl_restore_witnessed_multi_clans_worker(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.cwl_restore_witnessed_multi_clans_worker(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.cwl_restore_witnessed_multi_clans(
 p_receipt_id uuid,p_payload jsonb,p_target_clan_ids uuid[],
 p_expected_revisions bigint[],p_expected_target_fingerprints text[] DEFAULT NULL,
 p_apply boolean DEFAULT false,p_confirmation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $public_multi$
 SELECT private.cwl_restore_witnessed_multi_clans_worker(
   p_receipt_id,p_payload,p_target_clan_ids,p_expected_revisions,
   p_expected_target_fingerprints,p_apply,p_confirmation);
$public_multi$;
REVOKE ALL ON FUNCTION public.cwl_restore_witnessed_multi_clans(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_restore_witnessed_multi_clans(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text) TO authenticated;
COMMENT ON FUNCTION public.cwl_restore_witnessed_multi_clans(
 uuid,jsonb,uuid[],bigint[],text[],boolean,text) IS
 'One verified original multi-clan witness; one all-or-nothing PostgreSQL-17 17-area restore for 2..10 distinct, unused, newly owned same-Clash-tag replacement targets. No public UI, auth recreation or merge of active plans.';
