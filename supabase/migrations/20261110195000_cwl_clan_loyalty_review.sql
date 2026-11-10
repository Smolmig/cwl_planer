-- #183 phase 2d2: optional, evidence-based, owner-reviewed loyalty path.
-- A long observed absence creates only a qualification REVIEW, never resets
-- confirmed clan time or mutates player/CWL/war/Clash records.
-- Cross-tenant player sharing (#212) remains disabled.
ALTER TABLE public.cwl_clan_management_rules
 ADD COLUMN loyalty_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN loyalty_min_donations integer NOT NULL DEFAULT 50
  CHECK (loyalty_min_donations BETWEEN 1 AND 100000),
 ADD COLUMN loyalty_min_active_days integer NOT NULL DEFAULT 3
  CHECK (loyalty_min_active_days BETWEEN 1 AND 365),
 ADD COLUMN loyalty_lookback_days integer NOT NULL DEFAULT 30
  CHECK (loyalty_lookback_days BETWEEN 7 AND 365),
 ADD CONSTRAINT cwl_rules_loyalty_day_window
  CHECK (loyalty_min_active_days <= loyalty_lookback_days);

COMMENT ON COLUMN public.cwl_clan_management_rules.loyalty_enabled IS
 'Off by default; optional manual loyalty promotion review, no rank automation.';
COMMENT ON COLUMN public.cwl_clan_management_rules.absence_reset_days IS
 'Observed >= threshold absence flags qualification for human review only; NEVER erases cumulative verified time.';

-- Returns one row per *currently observed member*, even when NO positive
-- donation changes were witnessed. Zero means "zero observed deltas in the
-- requested window", NOT no donations, no activity or offline.
-- Each tenant's snapshots are isolated by BOTH app-clan UUID and Clash tag.
-- UNDERLYING tables also enforce owner RLS. No foreign owner or unrestricted
-- member enumeration through this invoker projection.
CREATE FUNCTION public.cwl_clan_loyalty_evidence(
 p_clan uuid, p_source_clash_tag text, p_lookback_days integer
) RETURNS TABLE (
 player_tag text,
 observed_positive_donations bigint,
 observed_donation_events integer,
 observed_donation_days integer,
 last_positive_donation_at timestamptz,
 observed_absence_windows integer,
 longest_observed_absence_seconds bigint
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $loyalty$
 SELECT t.player_tag,
   COALESCE(d.donation_sum,0)::bigint,
   COALESCE(d.event_count,0)::integer,
   COALESCE(d.donation_days,0)::integer,
   d.last_positive_at,
   COALESCE(a.absence_count,0)::integer,
   COALESCE(a.longest_absence,0)::bigint
 FROM public.cwl_clan_member_tenure AS t
 INNER JOIN public.cwl_clans AS c
   ON c.id=t.clan_id AND c.clash_tag=t.source_clash_tag
 LEFT JOIN LATERAL (
   SELECT SUM(ev.positive_delta)::bigint AS donation_sum,
     COUNT(*)::integer AS event_count,
     COUNT(DISTINCT ((ev.observed_at AT TIME ZONE 'UTC')::date))::integer AS donation_days,
     MAX(ev.observed_at) AS last_positive_at
   FROM public.cwl_clan_donation_observations AS ev
   WHERE ev.clan_id=t.clan_id
     AND ev.source_clash_tag=t.source_clash_tag
     AND ev.player_tag=t.player_tag
     AND ev.observed_at >= now()-make_interval(days=>p_lookback_days)
     AND ev.observed_at <= now()
 ) AS d ON true
 LEFT JOIN LATERAL (
   SELECT COUNT(*)::integer AS absence_count,
     MAX(ev.max_streak_seconds)::bigint AS longest_absence
   FROM public.cwl_clan_absence_observations AS ev
   WHERE ev.clan_id=t.clan_id
     AND ev.source_clash_tag=t.source_clash_tag
     AND ev.player_tag=t.player_tag
 ) AS a ON true
 WHERE private.cwl_is_owner(p_clan)
   AND p_lookback_days BETWEEN 7 AND 365
   AND c.id=p_clan
   AND c.clash_tag=p_source_clash_tag
   AND t.clan_id=p_clan
   AND t.source_clash_tag=p_source_clash_tag
   AND t.is_present IS TRUE;
$loyalty$;
REVOKE ALL ON FUNCTION public.cwl_clan_loyalty_evidence(uuid,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_clan_loyalty_evidence(uuid,text,integer)
 TO authenticated;
COMMENT ON FUNCTION public.cwl_clan_loyalty_evidence(uuid,text,integer) IS
 'Read-only owner-only, tenant/Clash-clan-scoped observed donation and absence summary; zeros are not negative behavioral evidence.';
