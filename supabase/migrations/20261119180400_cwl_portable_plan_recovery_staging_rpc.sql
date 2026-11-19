-- #178 Phase 3b: atomic owner-only PREVIEW + private recovery candidate.
-- Crucially this never mutates active profiles, CWL plan lock, saved played
-- days, group archives, verified own lineups, clan rules, or auth identities.
-- SECURITY INVOKER preserves RLS. No service-role/SECURITY DEFINER bypass.
CREATE OR REPLACE FUNCTION public.cwl_stage_portable_plan_recovery(
 p_target uuid,p_source jsonb,p_expected_revision bigint,
 p_stage boolean DEFAULT false,p_confirmation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $plan_stage$
DECLARE
 v_owner uuid := auth.uid();
 v_clan_tag text;
 v_source_id uuid;
 v_source_tag text;
 v_tables jsonb;
 v_arr jsonb;
 v_table text;
 v_source_profile jsonb;
 v_source_revision bigint;
 v_current_profile jsonb;
 v_current_revision bigint;
 v_review_state jsonb;
 v_target_before jsonb;
 v_existing public.cwl_portable_plan_recovery_candidates%rowtype;
 v_candidate_id uuid;
 v_protected_days integer := 0;
 v_current_members integer;
 v_current_archives integer;
 v_group_new integer:=0;
 v_group_same integer:=0;
 v_group_conflict integer:=0;
 v_lineup_new integer:=0;
 v_lineup_same integer:=0;
 v_lineup_conflict integer:=0;
 v_state_conflict boolean:=false;
BEGIN
 IF v_owner IS NULL OR p_target IS NULL OR
    p_expected_revision IS NULL OR p_expected_revision<1 OR
    p_stage IS NULL OR
    (p_stage AND p_confirmation IS DISTINCT FROM 'STAGE_PLAN_FOR_MANUAL_REVIEW') THEN
   RAISE EXCEPTION 'Owner and explicit plan-staging confirmation required'
     USING ERRCODE='42501';
 END IF;
 -- Same serialization convention as the statistics import; a staging
 -- candidate does not interfere with normal collector archive privileges.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_target::text,424242));
 SELECT c.clash_tag INTO v_clan_tag
 FROM public.cwl_clans c JOIN public.cwl_clan_memberships m
   ON m.clan_id=c.id AND m.user_id=v_owner AND m.role='owner'
 WHERE c.id=p_target AND c.owner_user_id=v_owner;
 IF NOT FOUND OR v_clan_tag IS NULL OR
    v_clan_tag !~ '^#[0289PYLQGRJCUV]{3,15}$' THEN
   RAISE EXCEPTION 'No permission to stage another clan plan'
     USING ERRCODE='42501';
 END IF;
 IF pg_catalog.jsonb_typeof(p_source) IS DISTINCT FROM 'object'
   OR pg_catalog.octet_length(p_source::text)>12582912 THEN
   RAISE EXCEPTION 'Invalid or oversized portable plan proposal'
     USING ERRCODE='22023';
 END IF;
 v_source_tag:=p_source->>'clash_tag';
 IF v_source_tag IS DISTINCT FROM v_clan_tag OR
    (p_source->>'source_clan_id') IS NULL OR
    (p_source->>'source_clan_id') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
   RAISE EXCEPTION 'Source/target Clash clan identity mismatch'
     USING ERRCODE='22023';
 END IF;
 v_source_id:=(p_source->>'source_clan_id')::uuid;
 v_tables:=p_source->'tables';
 IF pg_catalog.jsonb_typeof(v_tables) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Plan proposal tables are not an object'
     USING ERRCODE='22023';
 END IF;
 IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_tables))<>4
  OR EXISTS(
   SELECT 1 FROM pg_catalog.jsonb_object_keys(v_tables) AS names(name)
   WHERE names.name NOT IN (
    'cwl_cloud_profiles','cwl_plan_review_state',
    'cwl_group_archives','cwl_own_lineup_archives')
  ) THEN
   RAISE EXCEPTION 'Plan proposal must contain exactly four named datasets'
     USING ERRCODE='22023';
 END IF;
 FOR v_table,v_arr IN
   SELECT key,value FROM pg_catalog.jsonb_each(v_tables)
 LOOP
   IF pg_catalog.jsonb_typeof(v_arr) IS DISTINCT FROM 'array' THEN
     RAISE EXCEPTION 'Plan dataset must be a JSON array: %',v_table
       USING ERRCODE='22023';
   END IF;
   IF (v_table='cwl_cloud_profiles' AND pg_catalog.jsonb_array_length(v_arr)<>1)
     OR (v_table='cwl_plan_review_state' AND pg_catalog.jsonb_array_length(v_arr)>1)
     OR (v_table='cwl_group_archives' AND pg_catalog.jsonb_array_length(v_arr)>120)
     OR (v_table='cwl_own_lineup_archives' AND pg_catalog.jsonb_array_length(v_arr)>840) THEN
      RAISE EXCEPTION 'Invalid dataset count in %',v_table
        USING ERRCODE='22023';
   END IF;
   IF EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_arr) AS x(row_data)
      WHERE pg_catalog.jsonb_typeof(x.row_data) IS DISTINCT FROM 'object'
      OR x.row_data->>'clan_id' IS DISTINCT FROM v_source_id::text
   ) THEN
     RAISE EXCEPTION 'Foreign or malformed plan row in %',v_table
       USING ERRCODE='22023';
   END IF;
 END LOOP;
 v_source_profile:=v_tables->'cwl_cloud_profiles'->0->'profile_json';
 IF v_tables->'cwl_cloud_profiles'->0->>'data_version' IS DISTINCT FROM '9'
    OR (v_tables->'cwl_cloud_profiles'->0->>'revision') IS NULL
    OR pg_catalog.jsonb_typeof(v_source_profile) IS DISTINCT FROM 'object'
    OR pg_catalog.octet_length(v_source_profile::text)>5242880 THEN
   RAISE EXCEPTION 'Unsupported source plan format/version'
     USING ERRCODE='22023';
 END IF;
 v_source_revision:=(v_tables->'cwl_cloud_profiles'->0->>'revision')::bigint;
 IF v_source_revision<1 OR
    pg_catalog.jsonb_typeof(v_source_profile->'members') IS DISTINCT FROM 'array' OR
    pg_catalog.jsonb_typeof(v_source_profile->'locks') IS DISTINCT FROM 'array' OR
    pg_catalog.jsonb_typeof(v_source_profile->'archives') IS DISTINCT FROM 'array' OR
    pg_catalog.jsonb_typeof(v_source_profile->'archivedMembers') IS DISTINCT FROM 'array' OR
    pg_catalog.jsonb_typeof(v_source_profile->'config') IS DISTINCT FROM 'object' OR
    pg_catalog.jsonb_typeof(v_source_profile->'dayGoals') IS DISTINCT FROM 'array' OR
    pg_catalog.jsonb_typeof(v_source_profile->'cwlLive') IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Incomplete source plan: members/locks/archives/config missing'
     USING ERRCODE='22023';
 END IF;
 IF pg_catalog.jsonb_array_length(v_source_profile->'locks')<>7 THEN
   RAISE EXCEPTION 'A portable CWL plan requires all seven day slots'
     USING ERRCODE='22023';
 END IF;
 IF EXISTS(
   SELECT 1 FROM pg_catalog.jsonb_array_elements(v_source_profile->'locks') AS day_slot(row_data)
   WHERE pg_catalog.jsonb_typeof(day_slot.row_data) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(day_slot.row_data->'locked') IS DISTINCT FROM 'boolean'
      OR pg_catalog.jsonb_typeof(day_slot.row_data->'lineup') IS DISTINCT FROM 'array'
 ) THEN
   RAISE EXCEPTION 'Invalid day-slot structure in source plan'
     USING ERRCODE='22023';
 END IF;
 -- Validate only identities needed to compare official archives. The
 -- original collector-only archive schema/guards remain unchanged.
 IF EXISTS(
   SELECT 1 FROM pg_catalog.jsonb_array_elements(
     v_tables->'cwl_group_archives') AS x(row_data)
   WHERE x.row_data->>'clan_tag' IS DISTINCT FROM v_clan_tag
     OR x.row_data->>'season' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     OR x.row_data->'group_json'->>'season'
       IS DISTINCT FROM x.row_data->>'season'
     OR x.row_data->'group_json'->>'clanTag'
       IS DISTINCT FROM v_clan_tag
     OR pg_catalog.jsonb_typeof(x.row_data->'group_json'->'rounds')
       IS DISTINCT FROM 'array'
 ) THEN
   RAISE EXCEPTION 'Invalid group archive source identity'
     USING ERRCODE='22023';
 END IF;
 IF EXISTS(
   SELECT 1 FROM pg_catalog.jsonb_array_elements(
     v_tables->'cwl_own_lineup_archives') AS x(row_data)
   WHERE x.row_data->>'season' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     OR (x.row_data->>'day')::int NOT BETWEEN 1 AND 7
     OR x.row_data->>'state' NOT IN ('inWar','warEnded')
     OR x.row_data->>'war_tag' !~ '^#[0289PYLQGRJCUV]{3,15}$'
     OR pg_catalog.jsonb_typeof(x.row_data->'lineup_json'->'members')
       IS DISTINCT FROM 'array'
 ) THEN
   RAISE EXCEPTION 'Invalid own-lineup archive source identity'
     USING ERRCODE='22023';
 END IF;
 IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(
       v_tables->'cwl_group_archives')) IS DISTINCT FROM
    (SELECT count(DISTINCT row_data->>'season')
     FROM pg_catalog.jsonb_array_elements(
       v_tables->'cwl_group_archives') AS x(row_data))
 OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(
       v_tables->'cwl_own_lineup_archives')) IS DISTINCT FROM
    (SELECT count(DISTINCT pg_catalog.jsonb_build_array(
       row_data->>'season',row_data->>'day')::text)
     FROM pg_catalog.jsonb_array_elements(
       v_tables->'cwl_own_lineup_archives') AS x(row_data)) THEN
   RAISE EXCEPTION 'Duplicate source archive identity'
     USING ERRCODE='22023';
 END IF;
 -- Approval/archive tables are intentionally SELECT-only to app owners.
 -- An informational candidate cannot require collector write privileges.
 -- Recheck all current rows in the FUTURE apply transaction.
 SELECT to_jsonb(s) INTO v_review_state FROM public.cwl_plan_review_state s
  WHERE s.clan_id=p_target;
 SELECT p.profile_json,p.revision
   INTO v_current_profile,v_current_revision
 FROM public.cwl_cloud_profiles p WHERE p.clan_id=p_target;
 IF NOT FOUND OR v_current_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Plan changed; recheck the target before staging'
      USING ERRCODE='40001';
 END IF;
 -- Immutable candidate staging does NOT lock official collector archives;
 -- their state may advance, and a later real apply MUST recheck it.
 SELECT count(*) INTO v_protected_days
 FROM pg_catalog.jsonb_array_elements(v_current_profile->'locks') AS day_slot(row_data)
 WHERE day_slot.row_data->>'locked'='true'
    OR coalesce(day_slot.row_data->>'warTag','')<>''
    OR (day_slot.row_data->'snapshots') IS DISTINCT FROM '{}'::jsonb;
 v_current_members:=pg_catalog.jsonb_array_length(v_current_profile->'members');
 v_current_archives:=pg_catalog.jsonb_array_length(v_current_profile->'archives');

 SELECT count(*) FILTER (WHERE old_a.clan_id IS NULL),
        count(*) FILTER (WHERE old_a.clan_id IS NOT NULL AND
          old_a.group_json=r.row_data->'group_json'),
        count(*) FILTER (WHERE old_a.clan_id IS NOT NULL AND
          old_a.group_json IS DISTINCT FROM r.row_data->'group_json')
   INTO v_group_new,v_group_same,v_group_conflict
 FROM pg_catalog.jsonb_array_elements(
   v_tables->'cwl_group_archives') AS r(row_data)
 LEFT JOIN public.cwl_group_archives old_a
   ON old_a.clan_id=p_target AND old_a.season=r.row_data->>'season';
 SELECT count(*) FILTER (WHERE old_a.clan_id IS NULL),
        count(*) FILTER (WHERE old_a.clan_id IS NOT NULL AND
          old_a.war_tag=r.row_data->>'war_tag' AND
          old_a.state=r.row_data->>'state' AND
          old_a.lineup_json=r.row_data->'lineup_json'),
        count(*) FILTER (WHERE old_a.clan_id IS NOT NULL AND (
          old_a.war_tag IS DISTINCT FROM r.row_data->>'war_tag' OR
          old_a.state IS DISTINCT FROM r.row_data->>'state' OR
          old_a.lineup_json IS DISTINCT FROM r.row_data->'lineup_json'))
   INTO v_lineup_new,v_lineup_same,v_lineup_conflict
 FROM pg_catalog.jsonb_array_elements(
   v_tables->'cwl_own_lineup_archives') AS r(row_data)
 LEFT JOIN public.cwl_own_lineup_archives old_a
   ON old_a.clan_id=p_target AND old_a.season=r.row_data->>'season'
   AND old_a.day=(r.row_data->>'day')::int;
 v_state_conflict:=v_review_state IS NOT NULL AND
   (v_tables->'cwl_plan_review_state'='[]'::jsonb OR
    (v_tables->'cwl_plan_review_state'->0->>'locked')
       IS DISTINCT FROM v_review_state->>'locked' OR
    (v_tables->'cwl_plan_review_state'->0->>'cycle_id')
       IS DISTINCT FROM v_review_state->>'cycle_id');

 -- Full target before-state is retained with the immutable candidate.
 -- It is protected owner-private metadata, NEVER applied to current archives.
 SELECT pg_catalog.jsonb_build_object(
  'profile_json',v_current_profile,
  'profile_revision',v_current_revision,
  'review_state',v_review_state,
  'group_archives',COALESCE((
    SELECT pg_catalog.jsonb_agg(to_jsonb(x))
    FROM (SELECT clan_id,season,clan_tag,group_json,created_at,updated_at
      FROM public.cwl_group_archives WHERE clan_id=p_target
      ORDER BY season LIMIT 121) AS x),'[]'::jsonb),
  'own_lineup_archives',COALESCE((
    SELECT pg_catalog.jsonb_agg(to_jsonb(x))
    FROM (SELECT clan_id,season,day,war_tag,state,team_size,lineup_json,
      created_at,updated_at
      FROM public.cwl_own_lineup_archives WHERE clan_id=p_target
      ORDER BY season,day LIMIT 841) AS x),'[]'::jsonb)
 ) INTO v_target_before;
 IF pg_catalog.octet_length(v_target_before::text)>12582912 THEN
   RAISE EXCEPTION 'Target recovery before-state too large'
     USING ERRCODE='54000';
 END IF;
 IF p_stage THEN
  -- One canonical candidate for a given source revision + target revision.
  -- Changed payload with same revision is a conflict, not an overwrite.
  INSERT INTO public.cwl_portable_plan_recovery_candidates (
   clan_id,source_clan_id,source_revision,source_clash_tag,target_revision,
   source_profile_json,source_review_state,source_group_archives,
   source_own_lineup_archives,target_before
  ) VALUES (
   p_target,v_source_id,v_source_revision,v_source_tag,v_current_revision,
   v_source_profile,v_tables->'cwl_plan_review_state',
   v_tables->'cwl_group_archives',v_tables->'cwl_own_lineup_archives',
   v_target_before
  ) ON CONFLICT (clan_id,source_clan_id,source_revision,target_revision)
    DO NOTHING RETURNING id INTO v_candidate_id;
  IF v_candidate_id IS NULL THEN
    SELECT * INTO v_existing
      FROM public.cwl_portable_plan_recovery_candidates
      WHERE clan_id=p_target AND source_clan_id=v_source_id AND
        source_revision=v_source_revision AND target_revision=v_current_revision
      ;
    IF NOT FOUND OR
      v_existing.source_clash_tag IS DISTINCT FROM v_source_tag OR
      v_existing.source_profile_json IS DISTINCT FROM v_source_profile OR
      v_existing.source_review_state IS DISTINCT FROM
        v_tables->'cwl_plan_review_state' OR
      v_existing.source_group_archives IS DISTINCT FROM
        v_tables->'cwl_group_archives' OR
      v_existing.source_own_lineup_archives IS DISTINCT FROM
        v_tables->'cwl_own_lineup_archives' OR
      v_existing.target_before IS DISTINCT FROM v_target_before THEN
       RAISE EXCEPTION 'Source or live target changed; stage a new checked candidate'
         USING ERRCODE='40001';
    END IF;
    v_candidate_id:=v_existing.id;
  END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'scope','plan-archive-review-only',
  'target_clan_id',p_target,
  'target_revision',v_current_revision,
  'staged',p_stage,
  'candidate_id',v_candidate_id,
  'active_plan_modified',false,
  'archives_modified',false,
  'mutation_permitted',false,
  'source_members',pg_catalog.jsonb_array_length(v_source_profile->'members'),
  'target_members',v_current_members,
  'target_protected_days',v_protected_days,
  'target_profile_archives',v_current_archives,
  'plan_identical',v_source_profile=v_current_profile,
  'review_state_conflict',v_state_conflict,
  'group_archives',pg_catalog.jsonb_build_object(
    'new',COALESCE(v_group_new,0),'identical',COALESCE(v_group_same,0),
    'conflict',COALESCE(v_group_conflict,0)),
  'own_lineup_archives',pg_catalog.jsonb_build_object(
    'new',COALESCE(v_lineup_new,0),'identical',COALESCE(v_lineup_same,0),
    'conflict',COALESCE(v_lineup_conflict,0))
 );
END
$plan_stage$;
REVOKE ALL ON FUNCTION public.cwl_stage_portable_plan_recovery(uuid,jsonb,bigint,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_stage_portable_plan_recovery(uuid,jsonb,bigint,boolean,text)
 TO authenticated;
COMMENT ON FUNCTION public.cwl_stage_portable_plan_recovery(uuid,jsonb,bigint,boolean,text) IS
 'Owner-only read-only plan/archive restore preview and optional private immutable candidate staging; never changes live CWL plan or collector-only archives.';
