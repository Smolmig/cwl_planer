-- #178 Phase 3a – deliberately LIMITED restore of raw CW/CWL facts only.
-- This is not a full cloud-app restore: never mutates profile, locks, lineup,
-- archive, owner decisions, presence, Auth or audit/observer tables.
-- All mutations are one PostgREST RPC transaction; any exception rolls back.
-- Incoming "api" provenance is NOT trustworthy in an unsigned user file:
-- a newly restored war is always SOURCE='import', missed_log_complete=false,
-- source_clash_tag=NULL. Never manufacture collector-verified misconduct.
-- Existing API war rows always win; no novel missed/attacks are injected into
-- those wars. No deletions, updates, or changes to previously stored facts.
CREATE OR REPLACE FUNCTION public.cwl_restore_portable_facts_atomic(
 p_target uuid, p_source jsonb, p_expected_revision bigint,
 p_apply boolean DEFAULT false, p_confirmation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $restore_facts$
DECLARE
 v_owner uuid := auth.uid();
 v_tag text;
 v_source_tag text;
 v_source_id text;
 v_revision bigint;
 v_tables jsonb;
 v_table_name text;
 v_array jsonb;
 v_table_record jsonb;
 v_wars jsonb;
 v_attacks jsonb;
 v_missed jsonb;
 v_war jsonb;
 v_attack jsonb;
 v_miss jsonb;
 v_war_key text;
 v_player text;
 v_order integer;
 v_started timestamptz;
 v_team integer;
 v_type text;
 v_stars integer;
 v_destruction integer;
 v_missed_count integer;
 v_old_war public.cwl_stat_wars%rowtype;
 v_old_attack public.cwl_stat_attacks%rowtype;
 v_old_miss public.cwl_stat_missed%rowtype;
 v_existing_source text;
 v_found boolean;
 v_delta integer;
 v_new_wars integer := 0;
 v_new_attacks integer := 0;
 v_new_missed integer := 0;
 v_same_wars integer := 0;
 v_same_attacks integer := 0;
 v_same_missed integer := 0;
 v_conflict_wars integer := 0;
 v_conflict_attacks integer := 0;
 v_conflict_missed integer := 0;
 v_downgraded_api integer := 0;
 v_review_only integer := 0;
BEGIN
 -- Both auth identity and actual current owner membership are mandatory.
 IF p_target IS NULL OR v_owner IS NULL OR
    p_expected_revision IS NULL OR p_expected_revision < 1 OR
    p_apply IS NULL OR
    (p_apply AND p_confirmation IS DISTINCT FROM 'RESTORE_VERIFIED_WAR_FACTS') THEN
   RAISE EXCEPTION 'portable restore requires owner, revision and explicit confirmation'
     USING ERRCODE='42501';
 END IF;
 -- Consistent lock ordering with existing ClashPerk atomic importers.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_target::text,424242));
 SELECT c.clash_tag INTO v_tag
 FROM public.cwl_clans c
 JOIN public.cwl_clan_memberships m
   ON m.clan_id=c.id AND m.user_id=v_owner AND m.role='owner'
 WHERE c.id=p_target AND c.owner_user_id=v_owner;
 IF NOT FOUND OR v_tag IS NULL OR
    v_tag !~ '^#[0289PYLQGRJCUV]{3,15}$' THEN
   RAISE EXCEPTION 'portable restore target is not an owned linked clan'
     USING ERRCODE='42501';
 END IF;
 -- Locks the current planning revision even for fact-only restore, so a
 -- reviewer cannot apply against a plan changing between preview and commit.
 SELECT revision INTO v_revision FROM public.cwl_cloud_profiles
 WHERE clan_id=p_target FOR UPDATE;
 IF NOT FOUND OR v_revision IS DISTINCT FROM p_expected_revision THEN
   RAISE EXCEPTION 'portable restore target revision changed; rerun preview'
     USING ERRCODE='40001';
 END IF;
 IF pg_catalog.jsonb_typeof(p_source) IS DISTINCT FROM 'object' OR
    pg_catalog.octet_length(p_source::text)>12582912 THEN
   RAISE EXCEPTION 'invalid or oversized portable restore clan'
     USING ERRCODE='22023';
 END IF;
 v_source_tag := p_source->>'clash_tag';
 v_source_id := p_source->>'source_clan_id';
 IF v_source_tag IS DISTINCT FROM v_tag OR
    v_source_id IS NULL OR
    v_source_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
   RAISE EXCEPTION 'portable restore clan tag / source id mismatch'
     USING ERRCODE='22023';
 END IF;
 v_tables := p_source->'tables';
 IF pg_catalog.jsonb_typeof(v_tables) IS DISTINCT FROM 'object' OR
    (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_tables))<>17 OR
    EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(v_tables) AS names(name)
      WHERE names.name NOT IN (
        'cwl_cloud_profiles','cwl_profile_snapshots','cwl_change_events',
        'cwl_stat_wars','cwl_stat_attacks','cwl_stat_missed',
        'cwl_plan_review_state','cwl_plan_suggestions',
        'cwl_group_archives','cwl_own_lineup_archives',
        'cwl_missed_owner_decisions','cwl_clan_member_tenure',
        'cwl_clan_management_rules','cwl_clan_donation_observations',
        'cwl_clan_absence_observations','cwl_clan_review_decisions',
        'cwl_clan_cw_missed_decisions'
      )
    ) THEN
   RAISE EXCEPTION 'incomplete or unknown portable backup dataset'
     USING ERRCODE='22023';
 END IF;
 -- Reject any foreign/source-mismatched row even in the audit-only datasets.
 -- Verify that a table represented as [] was not silently dropped.
 FOR v_table_name,v_array IN
   SELECT key,value FROM pg_catalog.jsonb_each(v_tables)
 LOOP
   IF pg_catalog.jsonb_typeof(v_array) IS DISTINCT FROM 'array' OR
      pg_catalog.jsonb_array_length(v_array)>100000 THEN
     RAISE EXCEPTION 'invalid table in portable backup: %',v_table_name
       USING ERRCODE='22023';
   END IF;
   IF EXISTS (
     SELECT 1 FROM pg_catalog.jsonb_array_elements(v_array) AS rec(row_data)
     WHERE pg_catalog.jsonb_typeof(rec.row_data) IS DISTINCT FROM 'object'
       OR rec.row_data->>'clan_id' IS DISTINCT FROM v_source_id
   ) THEN
     RAISE EXCEPTION 'foreign or malformed row in %',v_table_name
       USING ERRCODE='22023';
   END IF;
   IF v_table_name NOT IN ('cwl_stat_wars','cwl_stat_attacks','cwl_stat_missed') THEN
      v_review_only:=v_review_only+pg_catalog.jsonb_array_length(v_array);
   END IF;
 END LOOP;
 IF pg_catalog.jsonb_array_length(v_tables->'cwl_cloud_profiles')<>1 OR
    (v_tables->'cwl_cloud_profiles'->0->>'data_version') IS DISTINCT FROM '9' THEN
   RAISE EXCEPTION 'portable restore requires exactly one v9 plan profile'
     USING ERRCODE='22023';
 END IF;
 v_wars:=v_tables->'cwl_stat_wars';
 v_attacks:=v_tables->'cwl_stat_attacks';
 v_missed:=v_tables->'cwl_stat_missed';
 IF pg_catalog.jsonb_array_length(v_wars)>2000 OR
    pg_catalog.jsonb_array_length(v_attacks)>25000 OR
    pg_catalog.jsonb_array_length(v_missed)>8000 THEN
    RAISE EXCEPTION 'portable restore fact count limit exceeded'
      USING ERRCODE='54000';
 END IF;
 -- No repeated identities and no orphaned attack/missed facts.
 IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_wars)) <>
    (SELECT count(DISTINCT row_data->>'war_key')
     FROM pg_catalog.jsonb_array_elements(v_wars) AS r(row_data)) OR
    (SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_attacks)) <>
    (SELECT count(DISTINCT pg_catalog.jsonb_build_array(
       row_data->>'war_key',row_data->>'attacker_tag',row_data->>'attack_order')::text)
     FROM pg_catalog.jsonb_array_elements(v_attacks) AS r(row_data)) OR
    (SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_missed)) <>
    (SELECT count(DISTINCT pg_catalog.jsonb_build_array(
       row_data->>'war_key',row_data->>'player_tag')::text)
     FROM pg_catalog.jsonb_array_elements(v_missed) AS r(row_data)) OR
    EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_attacks || v_missed) AS r(row_data)
      WHERE NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(v_wars) AS w(row_data)
        WHERE w.row_data->>'war_key'=r.row_data->>'war_key'
      )
    ) THEN
   RAISE EXCEPTION 'duplicate identity or orphaned portable war fact'
     USING ERRCODE='22023';
 END IF;

 FOR v_war IN SELECT value FROM pg_catalog.jsonb_array_elements(v_wars) AS x(value)
 LOOP
   v_war_key:=v_war->>'war_key';
   v_type:=v_war->>'war_type';
   IF v_war_key IS NULL OR length(v_war_key) NOT BETWEEN 4 AND 100 OR
      v_type NOT IN ('normal','cwl') OR
      v_war->>'source' NOT IN ('import','api') OR
      pg_catalog.jsonb_typeof(v_war->'roster_tags') NOT IN ('null','array') OR
      v_war->>'started_at' IS NULL OR
      v_war->>'team_size' IS NULL THEN
     RAISE EXCEPTION 'invalid portable war row'
       USING ERRCODE='22023';
   END IF;
   v_started:=(v_war->>'started_at')::timestamptz;
   v_team:=(v_war->>'team_size')::integer;
   IF v_team NOT BETWEEN 1 AND 50 THEN
     RAISE EXCEPTION 'invalid team size' USING ERRCODE='22023';
   END IF;
   SELECT * INTO v_old_war FROM public.cwl_stat_wars
     WHERE clan_id=p_target AND war_key=v_war_key;
   v_found:=FOUND;
   IF v_found THEN
     -- Identical natural identity only. NEVER downgrade existing API quality,
     -- finalized state, missed coverage, or last collector update timestamp.
     IF v_old_war.war_type IS DISTINCT FROM v_type OR
        v_old_war.started_at IS DISTINCT FROM v_started OR
        v_old_war.team_size IS DISTINCT FROM v_team OR
        v_old_war.opponent_tag IS DISTINCT FROM (v_war->>'opponent_tag') OR
        v_old_war.opponent_name IS DISTINCT FROM coalesce(v_war->>'opponent_name','') THEN
       v_conflict_wars:=v_conflict_wars+1;
     ELSE
       v_same_wars:=v_same_wars+1;
     END IF;
   ELSE
     v_new_wars:=v_new_wars+1;
     IF v_war->>'source'='api' THEN
       v_downgraded_api:=v_downgraded_api+1;
     END IF;
     IF p_apply THEN
       INSERT INTO public.cwl_stat_wars (
         clan_id,war_key,war_type,started_at,team_size,
         opponent_tag,opponent_name,source,roster_tags,
         finalized,missed_log_complete,source_clash_tag
       ) VALUES (
         p_target,v_war_key,v_type,v_started,v_team,
         v_war->>'opponent_tag',coalesce(v_war->>'opponent_name',''),
         'import',CASE WHEN pg_catalog.jsonb_typeof(v_war->'roster_tags')='array'
           THEN v_war->'roster_tags' ELSE NULL END,
         coalesce((v_war->>'finalized')::boolean,false),false,NULL
       )
       ON CONFLICT (clan_id,war_key) DO NOTHING;
       GET DIAGNOSTICS v_delta=ROW_COUNT;
       IF v_delta=0 THEN
         RAISE EXCEPTION 'war inserted concurrently; rerun preview'
           USING ERRCODE='40001';
       END IF;
     END IF;
   END IF;
 END LOOP;

 FOR v_attack IN SELECT value FROM pg_catalog.jsonb_array_elements(v_attacks) AS x(value)
 LOOP
   v_war_key:=v_attack->>'war_key';
   v_player:=v_attack->>'attacker_tag';
   IF v_player IS NULL OR v_player !~ '^#[0289PYLQGRJCUV]{3,15}$' OR
      v_attack->>'attack_order' IS NULL OR
      v_attack->>'stars' IS NULL OR v_attack->>'destruction' IS NULL THEN
     RAISE EXCEPTION 'invalid portable attack identity' USING ERRCODE='22023';
   END IF;
   v_order:=(v_attack->>'attack_order')::integer;
   v_stars:=(v_attack->>'stars')::integer;
   v_destruction:=(v_attack->>'destruction')::integer;
   IF v_order NOT BETWEEN 0 AND 200 OR
      v_stars NOT BETWEEN 0 AND 3 OR
      v_destruction NOT BETWEEN 0 AND 100 THEN
     RAISE EXCEPTION 'invalid attack result' USING ERRCODE='22023';
   END IF;
   SELECT * INTO v_old_attack FROM public.cwl_stat_attacks
    WHERE clan_id=p_target AND war_key=v_war_key
      AND attacker_tag=v_player AND attack_order=v_order;
   IF FOUND THEN
     IF v_old_attack.stars IS DISTINCT FROM v_stars OR
        v_old_attack.destruction IS DISTINCT FROM v_destruction OR
        v_old_attack.defender_tag IS DISTINCT FROM (v_attack->>'defender_tag') OR
        v_old_attack.defender_th IS DISTINCT FROM (v_attack->>'defender_th')::smallint OR
        v_old_attack.attacker_th IS DISTINCT FROM (v_attack->>'attacker_th')::smallint THEN
       v_conflict_attacks:=v_conflict_attacks+1;
     ELSE
       v_same_attacks:=v_same_attacks+1;
     END IF;
   ELSE
     -- Existing API war is a trusted collector row: never graft unverified
     -- portable attacks onto it (same rule for missed rows below).
     SELECT source INTO v_existing_source FROM public.cwl_stat_wars
       WHERE clan_id=p_target AND war_key=v_war_key;
     IF v_existing_source='api' THEN
       v_conflict_attacks:=v_conflict_attacks+1;
     ELSE
       v_new_attacks:=v_new_attacks+1;
       IF p_apply THEN
         INSERT INTO public.cwl_stat_attacks (
           clan_id,war_key,attacker_tag,attack_order,
           attacker_name,attacker_th,defender_tag,defender_name,
           defender_th,stars,destruction
         ) VALUES (
           p_target,v_war_key,v_player,v_order,
           coalesce(v_attack->>'attacker_name',''),
           (v_attack->>'attacker_th')::smallint,
           v_attack->>'defender_tag',
           coalesce(v_attack->>'defender_name',''),
           (v_attack->>'defender_th')::smallint,
           v_stars,v_destruction
         ) ON CONFLICT (clan_id,war_key,attacker_tag,attack_order) DO NOTHING;
         GET DIAGNOSTICS v_delta=ROW_COUNT;
         IF v_delta=0 THEN
           RAISE EXCEPTION 'attack inserted concurrently; rerun preview'
             USING ERRCODE='40001';
         END IF;
       END IF;
     END IF;
   END IF;
 END LOOP;

 FOR v_miss IN SELECT value FROM pg_catalog.jsonb_array_elements(v_missed) AS x(value)
 LOOP
   v_war_key:=v_miss->>'war_key';
   v_player:=v_miss->>'player_tag';
   IF v_player IS NULL OR v_player !~ '^#[0289PYLQGRJCUV]{3,15}$' OR
      v_miss->>'missed_count' IS NULL THEN
     RAISE EXCEPTION 'invalid portable missed identity' USING ERRCODE='22023';
   END IF;
   v_missed_count:=(v_miss->>'missed_count')::integer;
   IF v_missed_count NOT BETWEEN 1 AND 2 THEN
     RAISE EXCEPTION 'invalid missed count' USING ERRCODE='22023';
   END IF;
   SELECT * INTO v_old_miss FROM public.cwl_stat_missed
     WHERE clan_id=p_target AND war_key=v_war_key AND player_tag=v_player;
   IF FOUND THEN
     IF v_old_miss.missed_count IS DISTINCT FROM v_missed_count THEN
       v_conflict_missed:=v_conflict_missed+1;
     ELSE
       v_same_missed:=v_same_missed+1;
     END IF;
   ELSE
     SELECT source INTO v_existing_source FROM public.cwl_stat_wars
       WHERE clan_id=p_target AND war_key=v_war_key;
     IF v_existing_source='api' THEN
       v_conflict_missed:=v_conflict_missed+1;
     ELSE
       v_new_missed:=v_new_missed+1;
       IF p_apply THEN
         INSERT INTO public.cwl_stat_missed(
           clan_id,war_key,player_tag,player_name,missed_count
         ) VALUES (
           p_target,v_war_key,v_player,
           coalesce(v_miss->>'player_name',''),v_missed_count
         ) ON CONFLICT (clan_id,war_key,player_tag) DO NOTHING;
         GET DIAGNOSTICS v_delta=ROW_COUNT;
         IF v_delta=0 THEN
           RAISE EXCEPTION 'missed row inserted concurrently; rerun preview'
             USING ERRCODE='40001';
         END IF;
       END IF;
     END IF;
   END IF;
 END LOOP;
 -- Any disagreement aborts all earlier INSERTs in this very same RPC TXN.
 IF p_apply AND v_conflict_wars+v_conflict_attacks+v_conflict_missed<>0 THEN
   RAISE EXCEPTION 'portable war facts conflict with newer/existing evidence; no changes committed'
     USING ERRCODE='40001';
 END IF;
 RETURN pg_catalog.jsonb_build_object(
   'target_clan_id',p_target,
   'target_clash_tag',v_tag,
   'target_revision',v_revision,
   'scope','war-facts-only',
   'applied',p_apply,
   'mutation_permitted',p_apply AND
     v_conflict_wars+v_conflict_attacks+v_conflict_missed=0,
   'review_only_other_rows',v_review_only,
   'api_wars_imported_as_unverified',v_downgraded_api,
   'wars',pg_catalog.jsonb_build_object(
     'new',v_new_wars,'identical',v_same_wars,'conflict',v_conflict_wars),
   'attacks',pg_catalog.jsonb_build_object(
     'new',v_new_attacks,'identical',v_same_attacks,'conflict',v_conflict_attacks),
   'missed',pg_catalog.jsonb_build_object(
     'new',v_new_missed,'identical',v_same_missed,'conflict',v_conflict_missed)
 );
END
$restore_facts$;
REVOKE ALL ON FUNCTION public.cwl_restore_portable_facts_atomic(uuid,jsonb,bigint,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_restore_portable_facts_atomic(uuid,jsonb,bigint,boolean,text)
 TO authenticated;
COMMENT ON FUNCTION public.cwl_restore_portable_facts_atomic(uuid,jsonb,bigint,boolean,text) IS
 'Owner-only, RLS-invoker preview and all-or-nothing raw war fact import; no plan/audit/decision writes; API provenance downgraded, no overwrites; not a complete app restore.';
