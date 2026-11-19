-- #178 Phase 2 – one MVCC-consistent, owner-scoped read-only app snapshot.
-- Deliberately NOT a restore RPC. The hosted SQL function is dormant until the
-- client/UX is explicitly wired, but is safe to invoke as an authenticated owner.
-- PostgreSQL 17 STABLE functions use the calling query's MVCC snapshot for all
-- inner SELECTs (including multiple SELECTs in PL/pgSQL).
-- SECURITY INVOKER preserves all existing table SELECT grants and RLS policies.
-- No service_role, no SECURITY DEFINER, no auth/users/session/invite secrets.
-- Tables and ordered column projections mirror cloud-portable-backup-core.mjs.
CREATE OR REPLACE FUNCTION public.cwl_export_owned_backup(p_clan_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $portable_export$
DECLARE
  v_owner uuid := auth.uid();
  v_requested integer;
  v_count integer;
  v_clan record;
  v_clans jsonb := '[]'::jsonb;
  v_tables jsonb;
  v_table_name text;
  v_table_rows jsonb;
BEGIN
  IF v_owner IS NULL OR p_clan_ids IS NULL OR
     cardinality(p_clan_ids) NOT BETWEEN 1 AND 30 OR
     EXISTS (SELECT 1 FROM unnest(p_clan_ids) AS ids(id) WHERE ids.id IS NULL) THEN
    RAISE EXCEPTION 'invalid or unauthenticated cloud export selection'
      USING ERRCODE = '42501';
  END IF;
  v_requested := cardinality(p_clan_ids);
  IF (SELECT COUNT(DISTINCT ids.id) FROM unnest(p_clan_ids) AS ids(id)) <> v_requested THEN
    RAISE EXCEPTION 'duplicate source clan in cloud export'
      USING ERRCODE = '22023';
  END IF;

  -- Both the Auth UID's ownership and an actual owner membership must match
  -- for ALL requested tenants. We never rely on IDs supplied by JSON/clients.
  SELECT COUNT(*) INTO v_count
  FROM public.cwl_clans AS c
  JOIN public.cwl_clan_memberships AS m
    ON m.clan_id = c.id AND m.user_id = v_owner AND m.role = 'owner'
  WHERE c.id = ANY(p_clan_ids) AND c.owner_user_id = v_owner;
  IF v_count <> v_requested THEN
    RAISE EXCEPTION 'not authorized to export every requested clan'
      USING ERRCODE = '42501';
  END IF;

  FOR v_clan IN
    SELECT id, name, clash_tag
    FROM public.cwl_clans
    WHERE id = ANY(p_clan_ids) AND owner_user_id = v_owner
    ORDER BY id
  LOOP
    -- Each projection is explicit: future table columns (incl. secrets) cannot
    -- quietly enter the backup. A table read failure aborts the entire RPC.
    -- LIMIT 100001 is a fail-closed sentinel; NEVER return a truncated table.
    SELECT jsonb_build_object(
   'cwl_cloud_profiles', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, profile_json, data_version, revision, created_at, updated_at
       FROM public.cwl_cloud_profiles
       WHERE clan_id = v_clan.id
       ORDER BY clan_id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_profile_snapshots', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT id, clan_id, revision, profile_json, created_at
       FROM public.cwl_profile_snapshots
       WHERE clan_id = v_clan.id
       ORDER BY id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_change_events', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT id, clan_id, actor_id, revision, event_type, details, created_at
       FROM public.cwl_change_events
       WHERE clan_id = v_clan.id
       ORDER BY id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_stat_wars', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, war_key, war_type, started_at, team_size, opponent_tag, opponent_name, source, roster_tags, finalized, updated_at, missed_log_complete, source_clash_tag
       FROM public.cwl_stat_wars
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, war_key
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_stat_attacks', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, war_key, attacker_tag, attack_order, attacker_name, attacker_th, defender_tag, defender_name, defender_th, stars, destruction, created_at
       FROM public.cwl_stat_attacks
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, war_key, attacker_tag, attack_order
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_stat_missed', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, war_key, player_tag, player_name, missed_count, created_at
       FROM public.cwl_stat_missed
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, war_key, player_tag
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_plan_review_state', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, cycle_id, season, locked, locked_by, locked_at, updated_at
       FROM public.cwl_plan_review_state
       WHERE clan_id = v_clan.id
       ORDER BY clan_id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_plan_suggestions', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT id, clan_id, cycle_id, author_id, base_revision, suggested_profile, status, submitted_at, decided_at, decided_by
       FROM public.cwl_plan_suggestions
       WHERE clan_id = v_clan.id
       ORDER BY id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_group_archives', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, season, clan_tag, group_json, created_at, updated_at
       FROM public.cwl_group_archives
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, season
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_own_lineup_archives', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, season, day, war_tag, state, team_size, lineup_json, created_at, updated_at
       FROM public.cwl_own_lineup_archives
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, season, day
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_missed_owner_decisions', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT id, clan_id, season, war_key, day, target_day, player_tag, decision, note, actor_id, created_at
       FROM public.cwl_missed_owner_decisions
       WHERE clan_id = v_clan.id
       ORDER BY id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_clan_member_tenure', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, source_clash_tag, player_tag, first_observed_at, last_present_at, last_observed_at, state_changed_at, is_present, confirmed_seconds, observed_visits, last_clash_rank, last_clash_rank_at, rank_before_leave, rank_before_leave_at, last_donations, last_donations_at, last_donation_increase_at, last_donation_increase_by
       FROM public.cwl_clan_member_tenure
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, source_clash_tag, player_tag
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_clan_management_rules', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, performance_enabled, performance_min_days, performance_min_attacks, performance_three_star_percent, performance_lookback_days, loyalty_min_days, absence_reset_days, revision, updated_at, loyalty_enabled, loyalty_min_donations, loyalty_min_active_days, loyalty_lookback_days
       FROM public.cwl_clan_management_rules
       WHERE clan_id = v_clan.id
       ORDER BY clan_id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_clan_donation_observations', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, source_clash_tag, player_tag, observed_at, positive_delta
       FROM public.cwl_clan_donation_observations
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, source_clash_tag, player_tag, observed_at
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_clan_absence_observations', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, source_clash_tag, player_tag, prior_visit_number, leave_observed_at, last_absent_observed_at, return_observed_at, observed_absent_snapshots, current_streak_seconds, max_streak_seconds
       FROM public.cwl_clan_absence_observations
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, source_clash_tag, player_tag, prior_visit_number
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_clan_review_decisions', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT clan_id, source_clash_tag, player_tag, review_kind, disposition, evidence_fingerprint, revision, updated_at
       FROM public.cwl_clan_review_decisions
       WHERE clan_id = v_clan.id
       ORDER BY clan_id, source_clash_tag, player_tag, review_kind
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb),
   'cwl_clan_cw_missed_decisions', COALESCE((
     SELECT jsonb_agg(to_jsonb(item))
     FROM (
       SELECT id, clan_id, source_clash_tag, war_key, player_tag, decision, note, actor_id, created_at
       FROM public.cwl_clan_cw_missed_decisions
       WHERE clan_id = v_clan.id
       ORDER BY id
       LIMIT 100001
     ) AS item
   ), '[]'::jsonb)
    ) INTO v_tables;

    FOR v_table_name, v_table_rows IN
      SELECT key, value FROM jsonb_each(v_tables)
    LOOP
      IF jsonb_array_length(v_table_rows) > 100000 THEN
        RAISE EXCEPTION 'cloud export table exceeds row limit'
          USING ERRCODE = '54000';
      END IF;
    END LOOP;
    IF jsonb_array_length(v_tables->'cwl_cloud_profiles') <> 1 THEN
      RAISE EXCEPTION 'cloud export requires exactly one clan profile'
        USING ERRCODE = '22023';
    END IF;
    IF octet_length(v_tables::text) > 67108864 THEN
      RAISE EXCEPTION 'cloud export exceeds 64 MiB per clan'
        USING ERRCODE = '54000';
    END IF;
    v_clans := v_clans || jsonb_build_array(jsonb_build_object(
      'source_clan_id',v_clan.id,
      'name',v_clan.name,
      'clash_tag',v_clan.clash_tag,
      'tables',v_tables
    ));
    -- Bound the total server response, not only each clan's dataset.
    -- Aborts without returning even a partial multi-clan backup.
    IF octet_length(v_clans::text) > 67108864 THEN
      RAISE EXCEPTION 'cloud export exceeds 64 MiB overall'
        USING ERRCODE = '54000';
    END IF;
  END LOOP;
  -- No checksum yet: the browser verifies/serializes this same trusted RPC
  -- response into the portable format and computes its canonical SHA-256.
  RETURN jsonb_build_object(
    'kind','cwl-cloud-app-backup',
    'format_version',1,
    'created_at',transaction_timestamp(),
    'consistency','server-stable-statement',
    'clans',v_clans
  );
END;
$portable_export$;

-- Default PostgreSQL EXECUTE is granted to PUBLIC unless explicitly revoked.
REVOKE ALL ON FUNCTION public.cwl_export_owned_backup(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_export_owned_backup(uuid[]) TO authenticated;
COMMENT ON FUNCTION public.cwl_export_owned_backup(uuid[]) IS
 'Read-only owner+membership+RLS checked portable app snapshot, consistent under one STABLE statement; no auth/secret data, no restore or mutation.';
