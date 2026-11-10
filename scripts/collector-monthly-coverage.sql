-- #104: repeatable READ-ONLY monthly CWL coverage and collector health audit.
-- This is an operational report, NEVER a missed-attack reconciliation.
-- Every saved app-clan war is counted separately; distinct_clash_wars is only
-- context for overlapping linked app clans, not authorization to merge tenants.
-- All output fields are aggregates; no clan_id, war_key, tags or player rows.
WITH monthly AS (
 SELECT date_trunc('month',started_at)::date AS month_utc, source,
   count(*) AS app_clan_wars,
   count(DISTINCT war_key) AS distinct_clash_wars,
   count(*) FILTER (WHERE finalized IS TRUE) AS finalized_wars,
   count(*) FILTER (WHERE finalized IS TRUE AND missed_log_complete IS TRUE)
     AS finalized_coverage_complete,
   count(*) FILTER (WHERE finalized IS TRUE AND missed_log_complete IS DISTINCT FROM TRUE)
     AS finalized_missed_unknown,
   count(*) FILTER (WHERE finalized IS DISTINCT FROM TRUE) AS provisional_wars
 FROM public.cwl_stat_wars
 WHERE war_type='cwl' AND started_at IS NOT NULL
 GROUP BY 1,2
), health AS (
 SELECT count(*) AS collector_profiles,
   count(*) FILTER (WHERE last_error IS NOT NULL) AS collector_profiles_with_error,
   min(last_success_at) AS earliest_profile_last_success_utc,
   max(last_success_at) AS latest_profile_last_success_utc
 FROM public.cwl_stat_collector_status
)
SELECT monthly.*, health.collector_profiles, health.collector_profiles_with_error,
 health.earliest_profile_last_success_utc, health.latest_profile_last_success_utc
FROM monthly CROSS JOIN health
ORDER BY month_utc DESC, source;
