-- Read-only CWL-Missed coverage audit for Issue #104.
-- Run as SELECT in an authorized Supabase SQL session. Never use the output
-- to auto-update missed_log_complete or fabricate a zero missed count.
-- Counts are first per app-clan record; distinct war keys are a separate metric
-- because multiple app clans may deliberately refer to one Clash war.
WITH incomplete AS (
  SELECT
    w.clan_id,
    w.war_key,
    w.source,
    w.team_size,
    CASE WHEN jsonb_typeof(w.roster_tags)='array'
      THEN jsonb_array_length(w.roster_tags) ELSE NULL END AS roster_size,
    count(a.war_key) AS recorded_attacks,
    count(DISTINCT a.attacker_tag) AS distinct_attackers,
    count(a.war_key) FILTER (
      WHERE NOT (coalesce(w.roster_tags,'[]'::jsonb) ? a.attacker_tag)
    ) AS attacks_outside_saved_roster,
    count(a.war_key) FILTER (
      WHERE a.attack_order<>1
    ) AS unexpected_extra_attacks
  FROM public.cwl_stat_wars w
  LEFT JOIN public.cwl_stat_attacks a
    ON a.clan_id=w.clan_id AND a.war_key=w.war_key
  WHERE w.war_type='cwl'
    AND w.finalized=true
    AND w.missed_log_complete=false
  GROUP BY w.clan_id,w.war_key,w.source,w.team_size,w.roster_tags
),
classified AS (
  SELECT *,
    CASE
      WHEN roster_size=team_size
       AND recorded_attacks=team_size
       AND distinct_attackers=team_size
       AND attacks_outside_saved_roster=0
       AND unexpected_extra_attacks=0
      THEN 'all_slots_recorded_official_counter_unstored'
      ELSE 'partial_evidence_missed_unknown'
    END AS evidence_class
  FROM incomplete
)
SELECT
  evidence_class,
  source,
  team_size,
  recorded_attacks,
  distinct_attackers,
  count(*) AS app_clan_records,
  count(DISTINCT war_key) AS distinct_clash_wars
FROM classified
GROUP BY evidence_class,source,team_size,recorded_attacks,distinct_attackers
ORDER BY recorded_attacks,evidence_class;
