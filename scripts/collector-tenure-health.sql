-- #104/#183: READ-ONLY, aggregate health check for clan-time collection.
-- NO player/clan identifiers, names, tags or per-member values are returned.
-- A successful status row is NOT proof of an autonomous GitHub schedule event.
-- Correlate GitHub Actions event=schedule with verified Edge logs separately.
WITH tenure AS (
 SELECT
   count(*) AS observed_member_rows,
   count(DISTINCT clan_id) AS observed_app_clans,
   count(*) FILTER (WHERE is_present IS TRUE) AS members_last_seen_present,
   min(first_observed_at) AS oldest_baseline_utc,
   max(last_observed_at) AS newest_roster_utc,
   count(*) FILTER (WHERE last_observed_at > first_observed_at) AS members_reobserved,
   count(*) FILTER (WHERE confirmed_seconds > 0) AS members_with_confirmed_time,
   coalesce(sum(confirmed_seconds), 0) AS aggregate_confirmed_member_seconds,
   count(*) FILTER (WHERE last_donation_increase_at IS NOT NULL) AS members_with_donation_increase,
   count(*) FILTER (WHERE observed_visits > 1) AS members_with_observed_return
 FROM public.cwl_clan_member_tenure
), health AS (
 SELECT
   count(*) AS collector_profiles,
   count(*) FILTER (WHERE last_error IS NOT NULL) AS collector_profiles_with_error,
   count(*) FILTER (WHERE last_success_at IS NULL) AS collector_profiles_without_success,
   count(*) FILTER (WHERE last_success_at < now() - interval '3 hours') AS collector_profiles_stale_gt_3h,
   min(last_success_at) AS oldest_profile_last_success_utc,
   max(last_success_at) AS newest_profile_last_success_utc
 FROM public.cwl_stat_collector_status
)
SELECT now() AS audited_at_utc, tenure.*, health.*,
 CASE
   WHEN tenure.observed_member_rows = 0 THEN 'no_baseline'
   WHEN tenure.members_reobserved = 0 THEN 'awaiting_reobservation'
   WHEN tenure.members_with_confirmed_time = 0 THEN 'reobserved_without_confirmed_interval'
   ELSE 'confirmed_intervals_observed'
 END AS roster_progress,
 CASE
   WHEN tenure.newest_roster_utc IS NULL THEN 'no_roster'
   WHEN tenure.newest_roster_utc < now() - interval '3 hours' THEN 'stale_over_3h'
   ELSE 'roster_within_3h'
 END AS roster_freshness
FROM tenure CROSS JOIN health;
