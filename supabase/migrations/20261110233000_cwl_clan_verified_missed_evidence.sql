-- #183 Phase 2f1: read-only owner-only, fail-closed CWL missed evidence.
-- The API-source collector attestation MUST be true AND the fully observed
-- roster / attack / missed rows must reconcile. A partial war is UNKNOWN,
-- never 0 missed; imports and normal CW do not qualify for discipline.
-- This function NEVER creates a violation, sanction, player record or write.
CREATE FUNCTION public.cwl_clan_verified_missed_evidence(
  p_clan uuid, p_source_clash_tag text, p_lookback_days integer
) RETURNS TABLE (
  war_key text, war_type text, started_at timestamptz,
  coverage text, player_tag text, missed_count integer
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $verified_missed$
WITH sampled AS (
 SELECT w.clan_id,w.war_key,w.war_type,w.started_at,
   w.finalized,w.missed_log_complete,w.team_size,
   ro.tag_count,ro.unique_tags,ro.tags_valid,
   att.attack_rows,att.unique_attackers,att.attacks_valid,
   mi.missed_rows,mi.unique_missed,mi.misses_valid
 FROM public.cwl_stat_wars AS w
 INNER JOIN public.cwl_clans AS c ON c.id=w.clan_id
  AND c.clash_tag=p_source_clash_tag
 CROSS JOIN LATERAL (
  SELECT COUNT(*)::integer AS tag_count,
    COUNT(DISTINCT t.tag)::integer AS unique_tags,
    COALESCE(BOOL_AND(t.tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),false) AS tags_valid
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(w.roster_tags)='array' THEN w.roster_tags
         ELSE '[]'::jsonb END
  ) AS t(tag)
 ) AS ro
 CROSS JOIN LATERAL (
  SELECT COUNT(*)::integer AS attack_rows,
    COUNT(DISTINCT a.attacker_tag)::integer AS unique_attackers,
    COALESCE(BOOL_AND(
      a.attacker_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'
      AND w.roster_tags ? a.attacker_tag
      AND a.attack_order=1
      AND a.stars BETWEEN 0 AND 3
    ),true) AS attacks_valid
  FROM public.cwl_stat_attacks AS a
  WHERE a.clan_id=w.clan_id AND a.war_key=w.war_key
 ) AS att
 CROSS JOIN LATERAL (
  SELECT COUNT(*)::integer AS missed_rows,
    COUNT(DISTINCT m.player_tag)::integer AS unique_missed,
    COALESCE(BOOL_AND(
      m.player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'
      AND w.roster_tags ? m.player_tag
      AND m.missed_count=1
      AND NOT EXISTS (
        SELECT 1 FROM public.cwl_stat_attacks AS a
        WHERE a.clan_id=m.clan_id AND a.war_key=m.war_key
          AND a.attacker_tag=m.player_tag
      )
    ),true) AS misses_valid
  FROM public.cwl_stat_missed AS m
  WHERE m.clan_id=w.clan_id AND m.war_key=w.war_key
 ) AS mi
 WHERE private.cwl_is_owner(p_clan)
   AND p_lookback_days BETWEEN 7 AND 730
   AND w.clan_id=p_clan
   AND w.source='api'
   AND w.war_type IN ('normal','cwl')
   AND w.started_at IS NOT NULL
   AND w.started_at BETWEEN now()-make_interval(days=>p_lookback_days) AND now()
), checked AS (
 SELECT s.*,
  CASE
   WHEN s.finalized IS DISTINCT FROM TRUE THEN 'provisional'
   WHEN s.war_type='cwl'
    AND s.missed_log_complete IS TRUE
    AND s.team_size BETWEEN 5 AND 50
    AND s.tag_count=s.team_size
    AND s.unique_tags=s.team_size
    AND s.tags_valid
    AND s.attack_rows=s.unique_attackers
    AND s.attacks_valid
    AND s.missed_rows=s.unique_missed
    AND s.misses_valid
    AND s.attack_rows+s.missed_rows=s.team_size
   THEN 'verified'
   ELSE 'unknown'
  END AS evidence_coverage
 FROM sampled AS s
)
SELECT w.war_key,w.war_type,w.started_at,
 w.evidence_coverage AS coverage,
 CASE WHEN w.evidence_coverage='verified' THEN m.player_tag ELSE NULL END AS player_tag,
 CASE WHEN w.evidence_coverage='verified' THEN m.missed_count::integer ELSE NULL END AS missed_count
FROM checked AS w
LEFT JOIN public.cwl_stat_missed AS m
 ON w.evidence_coverage='verified'
 AND m.clan_id=w.clan_id AND m.war_key=w.war_key
ORDER BY w.started_at DESC,w.war_key,m.player_tag;
$verified_missed$;
REVOKE ALL ON FUNCTION public.cwl_clan_verified_missed_evidence(uuid,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_clan_verified_missed_evidence(uuid,text,integer)
 TO authenticated;
COMMENT ON FUNCTION public.cwl_clan_verified_missed_evidence(uuid,text,integer) IS
 'Owner-only, current linked Clash clan: verified complete final API CWL roster/attack/missed evidence and explicit unknown/provisional API war coverage. Not proof of intent and NEVER a sanction. Imported and normal CW missed data excluded from verified misses.';
