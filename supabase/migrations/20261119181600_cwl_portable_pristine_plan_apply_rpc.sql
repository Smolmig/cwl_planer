-- #178 phase 3c – REAL profile apply, deliberately ONLY on unused targets.
-- The source is an UNTRUSTED owner-staged candidate: it contributes only
-- planning members, day goals and planner config. Never trusts source id,
-- played locks, historic archives, member permissions or API observations.
-- No UPDATE to cwl_plan_review_state / archive / facts / decisions / auth.
-- The checkpoint INSERT and profile UPDATE run within one PostgREST txn.
CREATE OR REPLACE FUNCTION public.cwl_apply_portable_pristine_plan(
 p_candidate uuid,p_expected_revision bigint,
 p_apply boolean DEFAULT false,p_confirmation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $apply_pristine$
DECLARE
 v_user uuid:=auth.uid();
 v_candidate public.cwl_portable_plan_recovery_candidates%rowtype;
 v_target uuid;
 v_owner_tag text;
 v_profile jsonb;
 v_source jsonb;
 v_after jsonb;
 v_after_db jsonb;
 v_review jsonb;
 v_revision bigint;
 v_changed_revision bigint;
 v_protected integer:=0;
 v_other_archives integer:=0;
 v_pending integer:=0;
 v_wars integer:=0;
 v_clean boolean:=false;
 v_current_same boolean:=false;
 v_current_guard boolean:=false;
 v_stage_same boolean:=false;
 v_has_changes boolean:=false;
 v_allowed boolean:=false;
 v_checkpoint_id uuid;
BEGIN
 IF p_candidate IS NULL OR p_expected_revision IS NULL OR
   p_expected_revision<1 OR p_apply IS NULL OR
   (p_apply AND p_confirmation IS DISTINCT FROM 'APPLY_TO_EMPTY_CWL_PLAN') THEN
   RAISE EXCEPTION 'Owner, checked revision and explicit plan apply confirmation required'
     USING ERRCODE='42501';
 END IF;
 -- The candidate row itself is owner-actor RLS protected and immutable.
 SELECT * INTO v_candidate
 FROM public.cwl_portable_plan_recovery_candidates
 WHERE id=p_candidate;
 IF NOT FOUND OR v_user IS NULL THEN
   RAISE EXCEPTION 'No readable owner recovery candidate'
     USING ERRCODE='42501';
 END IF;
 v_target:=v_candidate.clan_id;
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(v_target::text,424242));
 SELECT c.clash_tag INTO v_owner_tag
 FROM public.cwl_clans c
 JOIN public.cwl_clan_memberships m
   ON m.clan_id=c.id AND m.user_id=v_user AND m.role='owner'
 WHERE c.id=v_target AND c.owner_user_id=v_user;
 IF NOT FOUND OR v_owner_tag IS NULL OR
    v_candidate.actor_user_id IS DISTINCT FROM v_user OR
    v_candidate.source_clash_tag IS DISTINCT FROM v_owner_tag THEN
   RAISE EXCEPTION 'Owner or Clash tag mismatch for plan apply'
     USING ERRCODE='42501';
 END IF;
 IF p_expected_revision IS DISTINCT FROM v_candidate.target_revision THEN
   RAISE EXCEPTION 'Candidate target revision differs from confirmed preview'
     USING ERRCODE='40001';
 END IF;
 -- Approval is intentionally SELECT-only for app users. Keep existing
 -- project-wide policies/triggers intact and recheck before and after UPDATE.
 SELECT to_jsonb(s) INTO v_review
 FROM public.cwl_plan_review_state s WHERE s.clan_id=v_target;

 IF p_apply THEN
   SELECT p.profile_json,p.revision INTO v_profile,v_revision
   FROM public.cwl_cloud_profiles p
   WHERE p.clan_id=v_target FOR UPDATE;
 ELSE
   SELECT p.profile_json,p.revision INTO v_profile,v_revision
   FROM public.cwl_cloud_profiles p WHERE p.clan_id=v_target;
 END IF;
 IF NOT FOUND OR v_revision IS DISTINCT FROM p_expected_revision THEN
   RAISE EXCEPTION 'Active plan revision changed; preview again'
     USING ERRCODE='40001';
 END IF;
 v_source:=v_candidate.source_profile_json;
 IF pg_catalog.jsonb_typeof(v_source) IS DISTINCT FROM 'object'
   OR pg_catalog.jsonb_typeof(v_source->'members') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_typeof(v_source->'dayGoals') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_typeof(v_source->'config') IS DISTINCT FROM 'object'
   OR pg_catalog.jsonb_typeof(v_source->'locks') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_typeof(v_source->'archives') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_typeof(v_source->'archivedMembers') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_typeof(v_source->'cwlLive') IS DISTINCT FROM 'object'
   OR pg_catalog.jsonb_array_length(v_source->'locks')<>7
   OR pg_catalog.jsonb_array_length(v_source->'members')>100
   OR pg_catalog.jsonb_array_length(v_source->'dayGoals')>7
   OR pg_catalog.octet_length(v_source::text)>5242880 THEN
   RAISE EXCEPTION 'Invalid or unsupported source planning fields'
     USING ERRCODE='22023';
 END IF;
 IF EXISTS (
   SELECT 1 FROM pg_catalog.jsonb_array_elements(v_source->'members') AS m(row_data)
   WHERE pg_catalog.jsonb_typeof(m.row_data) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(m.row_data->'id') IS DISTINCT FROM 'string'
      OR length(m.row_data->>'id') NOT BETWEEN 1 AND 100
      OR (m.row_data ? 'playerTag'
          AND m.row_data->>'playerTag' IS NOT NULL
          AND m.row_data->>'playerTag' !~ '^#[0289PYLQGRJCUV]{3,15}$')
 ) OR (
   SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_source->'members')
 ) IS DISTINCT FROM (
   SELECT count(DISTINCT row_data->>'id')
   FROM pg_catalog.jsonb_array_elements(v_source->'members') AS m(row_data)
 ) THEN
   RAISE EXCEPTION 'Invalid or duplicate source plan-member identities'
     USING ERRCODE='22023';
 END IF;
 -- Only a genuinely UNUSED target qualifies. No archivedMembers, historical
 -- season archives, war rounds, locked/played day, verified collector rows,
 -- or pending editor changes may be overwritten.
 SELECT count(*) INTO v_protected
 FROM pg_catalog.jsonb_array_elements(
   CASE WHEN pg_catalog.jsonb_typeof(v_profile->'locks')='array'
        THEN v_profile->'locks' ELSE '[]'::jsonb END
 ) AS d(day_slot)
 WHERE d.day_slot->>'locked' IS DISTINCT FROM 'false'
   OR coalesce(d.day_slot->>'warTag','')<>''
   OR coalesce(d.day_slot->>'endTime','')<>''
   OR pg_catalog.jsonb_typeof(d.day_slot->'lineup') IS DISTINCT FROM 'array'
   OR pg_catalog.jsonb_array_length(
      CASE WHEN pg_catalog.jsonb_typeof(d.day_slot->'lineup')='array'
           THEN d.day_slot->'lineup' ELSE '[]'::jsonb END)>0
   OR d.day_slot->'snapshots' IS DISTINCT FROM '{}'::jsonb;
 SELECT (
   (SELECT count(*) FROM public.cwl_group_archives WHERE clan_id=v_target)
   +(SELECT count(*) FROM public.cwl_own_lineup_archives WHERE clan_id=v_target)
 ) INTO v_other_archives;
 SELECT count(*) INTO v_pending
 FROM public.cwl_plan_suggestions
 WHERE clan_id=v_target AND status='pending';
 SELECT count(*) INTO v_wars
 FROM public.cwl_stat_wars WHERE clan_id=v_target;

 v_clean:=pg_catalog.jsonb_typeof(v_profile)='object'
   AND pg_catalog.jsonb_typeof(v_profile->'members')='array'
   AND v_profile->'members'='[]'::jsonb
   AND v_profile->'archivedMembers'='[]'::jsonb
   AND v_profile->'archives'='[]'::jsonb
   AND pg_catalog.jsonb_typeof(v_profile->'locks')='array'
   AND pg_catalog.jsonb_array_length(v_profile->'locks')=7
   AND v_protected=0
   AND pg_catalog.jsonb_typeof(v_profile->'cwlLive')='object'
   AND v_profile->'cwlLive'->'rounds'='[]'::jsonb
   AND COALESCE((v_profile->'cwlLive'->>'warCount')::integer,0)=0
   AND v_other_archives=0
   AND v_pending=0
   AND v_wars=0
   AND COALESCE((v_review->>'locked')::boolean,false)=false;
 v_current_same:=
   (v_candidate.target_before->'profile_json') IS NOT DISTINCT FROM v_profile;
 v_stage_same:=
   (v_candidate.target_before->'review_state')
     IS NOT DISTINCT FROM COALESCE(v_review,'null'::jsonb)
   AND (v_candidate.target_before->'group_archives')='[]'::jsonb
   AND (v_candidate.target_before->'own_lineup_archives')='[]'::jsonb;
 v_has_changes:=(v_source->'members') IS DISTINCT FROM (v_profile->'members')
   OR (v_source->'dayGoals') IS DISTINCT FROM (v_profile->'dayGoals')
   OR (v_source->'config') IS DISTINCT FROM (v_profile->'config');

 v_allowed:=v_clean AND v_current_same AND v_stage_same AND v_has_changes;
 v_after:=v_profile || pg_catalog.jsonb_build_object(
   'members',v_source->'members',
   'dayGoals',v_source->'dayGoals',
   'config',v_source->'config',
   'updatedAt',
   pg_catalog.floor(EXTRACT(EPOCH FROM pg_catalog.clock_timestamp())*1000)::bigint
 );
 IF pg_catalog.octet_length(v_after::text)>5242880 THEN
   RAISE EXCEPTION 'Restored planning fields exceed Cloud profile byte limit'
     USING ERRCODE='54000';
 END IF;
 IF p_apply THEN
   IF NOT v_allowed THEN
     RAISE EXCEPTION 'Target contains work, history, locks or a changed staging baseline; only empty target plans may be restored'
       USING ERRCODE='40001';
   END IF;
   -- No UPDATE or DELETE occurs on existing candidates, archives or audit.
   -- If the upcoming profile UPDATE fails, this checkpoint is rolled back.
   INSERT INTO public.cwl_portable_plan_apply_checkpoints(
     clan_id,candidate_id,source_clan_id,before_revision,applied_revision,
     before_profile_json,applied_profile_json,before_review_state
   ) VALUES(
     v_target,v_candidate.id,v_candidate.source_clan_id,
     v_revision,v_revision+1,v_profile,v_after,
     COALESCE(v_review,'null'::jsonb)
   ) RETURNING id INTO v_checkpoint_id;

   UPDATE public.cwl_cloud_profiles
      SET profile_json=v_after
      WHERE clan_id=v_target AND revision=v_revision
      RETURNING revision,profile_json
      INTO v_changed_revision,v_after_db;
   IF NOT FOUND OR v_changed_revision<>v_revision+1
      OR v_after_db IS DISTINCT FROM v_after THEN
     RAISE EXCEPTION 'Profile CAS, trigger or before-state checkpoint failed; rollback'
       USING ERRCODE='40001';
   END IF;
   -- The source's locks, played-day snapshots, verified archive/cache data
   -- and live CWL observation are NEVER adopted. Extra trigger safety check.
   IF (v_after_db->'locks') IS DISTINCT FROM (v_profile->'locks') OR
      (v_after_db->'archives') IS DISTINCT FROM (v_profile->'archives') OR
      (v_after_db->'archivedMembers') IS DISTINCT FROM (v_profile->'archivedMembers') OR
      (v_after_db->'cwlLive') IS DISTINCT FROM (v_profile->'cwlLive') OR
      (v_after_db->'id') IS DISTINCT FROM (v_profile->'id') THEN
      RAISE EXCEPTION 'Protected target profile sections changed; rollback'
        USING ERRCODE='40001';
   END IF;
   -- Reject a concurrently changed plan-approval state. No lock mutation.
   SELECT to_jsonb(s) INTO v_review
   FROM public.cwl_plan_review_state s WHERE s.clan_id=v_target;
   IF (v_candidate.target_before->'review_state')
        IS DISTINCT FROM COALESCE(v_review,'null'::jsonb) OR
      COALESCE((v_review->>'locked')::boolean,false) THEN
     RAISE EXCEPTION 'Plan approval changed during apply; rollback'
       USING ERRCODE='40001';
   END IF;
 END IF;

 RETURN pg_catalog.jsonb_build_object(
   'scope','pristine-plan-planning-only',
   'target_clan_id',v_target,
   'candidate_id',v_candidate.id,
   'expected_revision',v_revision,
   'result_revision',CASE WHEN p_apply THEN v_changed_revision ELSE v_revision END,
   'applied',p_apply,
   'eligible_for_empty_target_apply',v_allowed,
   'has_changes',v_has_changes,
   'target_is_empty',v_clean,
   'matches_staging_baseline',v_current_same AND v_stage_same,
   'protected_days',v_protected,
   'existing_archive_rows',v_other_archives,
   'existing_wars',v_wars,
   'pending_editor_suggestions',v_pending,
   'member_count',pg_catalog.jsonb_array_length(v_source->'members'),
   'checkpoint_id',v_checkpoint_id,
   'restored_fields',pg_catalog.jsonb_build_array('members','dayGoals','config'),
   'locks_preserved',true,
   'archives_preserved',true,
   'plan_approval_preserved',true
 );
END;
$apply_pristine$;
REVOKE ALL ON FUNCTION public.cwl_apply_portable_pristine_plan(uuid,bigint,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_apply_portable_pristine_plan(uuid,bigint,boolean,text)
 TO authenticated;
COMMENT ON FUNCTION public.cwl_apply_portable_pristine_plan(uuid,bigint,boolean,text) IS
 'Owner-only transactionally checkpointed planning fields apply to UNUSED clean clan plans only; never restores played days or verified archive evidence; no public UI.';
