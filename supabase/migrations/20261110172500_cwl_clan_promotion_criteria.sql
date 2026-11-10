-- #183 Phase 2c: individually configurable per-app-clan promotion criteria.
-- No cross-tenant player-history sharing, rank change, player-profile write,
-- solver mutation, or retroactive membership/attack inference.
CREATE TABLE public.cwl_clan_management_rules (
  clan_id uuid PRIMARY KEY REFERENCES public.cwl_clans(id) ON DELETE CASCADE,
  performance_enabled boolean NOT NULL DEFAULT true,
  performance_min_days integer NOT NULL DEFAULT 14
    CHECK (performance_min_days BETWEEN 1 AND 365),
  performance_min_attacks integer NOT NULL DEFAULT 10
    CHECK (performance_min_attacks BETWEEN 1 AND 100),
  performance_three_star_percent integer NOT NULL DEFAULT 80
    CHECK (performance_three_star_percent BETWEEN 0 AND 100),
  performance_lookback_days integer NOT NULL DEFAULT 14
    CHECK (performance_lookback_days BETWEEN 7 AND 730),
  loyalty_min_days integer NOT NULL DEFAULT 60
    CHECK (loyalty_min_days BETWEEN 1 AND 730),
  absence_reset_days integer
    CHECK (absence_reset_days IS NULL OR absence_reset_days BETWEEN 1 AND 365),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cwl_clan_management_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY cwl_management_rules_owner_read
  ON public.cwl_clan_management_rules
  FOR SELECT TO authenticated
  USING (private.cwl_is_owner(clan_id));
CREATE POLICY cwl_management_rules_owner_create
  ON public.cwl_clan_management_rules
  FOR INSERT TO authenticated
  WITH CHECK (private.cwl_is_owner(clan_id));
CREATE POLICY cwl_management_rules_owner_edit
  ON public.cwl_clan_management_rules
  FOR UPDATE TO authenticated
  USING (private.cwl_is_owner(clan_id))
  WITH CHECK (private.cwl_is_owner(clan_id));
REVOKE ALL ON public.cwl_clan_management_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cwl_clan_management_rules TO authenticated;
COMMENT ON TABLE public.cwl_clan_management_rules IS
 'Owner-only per-app-clan policy. Loyalty/absence settings reserved; no automatic sanction or in-game action.';

-- Owner-only read-only evidence projection for the selected app clan.
-- Duplicate polling is neutral because of the underlying attack primary key.
-- Only *finished* locally archived API war rows are eligible. Imports,
-- provisional wars and foreign tenant rows are excluded entirely.
-- The API flag is archived-source metadata, not a cryptographic guarantee:
-- recommendations remain explicitly manual and require leader review.
CREATE FUNCTION public.cwl_promotion_attack_evidence(
  p_clan uuid, p_lookback_days integer
) RETURNS TABLE (
  player_tag text,
  attack_count integer,
  three_star_count integer,
  relevant_wars integer
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $evidence$
 SELECT a.attacker_tag AS player_tag,
        count(*)::integer AS attack_count,
        count(*) FILTER (WHERE a.stars = 3)::integer AS three_star_count,
        count(DISTINCT w.war_key)::integer AS relevant_wars
 FROM public.cwl_stat_attacks a
 INNER JOIN public.cwl_stat_wars w
   ON w.clan_id = a.clan_id AND w.war_key = a.war_key
 WHERE private.cwl_is_owner(p_clan)
   AND p_lookback_days BETWEEN 7 AND 730
   AND a.clan_id = p_clan
   AND w.clan_id = p_clan
   AND w.finalized IS TRUE
   AND w.source = 'api'
   AND w.war_type IN ('normal', 'cwl')
   AND w.started_at >= now() - make_interval(days => p_lookback_days)
   AND w.started_at <= now()
   AND a.stars BETWEEN 0 AND 3
   AND a.attacker_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'
 GROUP BY a.attacker_tag;
$evidence$;
REVOKE ALL ON FUNCTION public.cwl_promotion_attack_evidence(uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_promotion_attack_evidence(uuid,integer)
  TO authenticated;
COMMENT ON FUNCTION public.cwl_promotion_attack_evidence(uuid,integer) IS
 'Read-only owner-checked, tenant-isolated counts from finalized API-source own-clan wars; never proof of missed attacks.';
