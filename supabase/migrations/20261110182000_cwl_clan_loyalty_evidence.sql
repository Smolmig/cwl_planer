-- #183 Phase 2d1: append-only, clan-private loyalty evidence from already verified roster writes.
-- NOT a promotion rule: no inferred last-login, global sharing, qualification reset,
-- changes to existing confirmed_seconds, or edits to any CWL/war/profile records.
-- This migration is deliberately additive; the old collector RPC is unchanged.
CREATE TABLE public.cwl_clan_donation_observations (
 clan_id uuid NOT NULL,
 source_clash_tag text NOT NULL,
 player_tag text NOT NULL,
 observed_at timestamptz NOT NULL,
 positive_delta integer NOT NULL CHECK (positive_delta BETWEEN 1 AND 9999999),
 PRIMARY KEY (clan_id,source_clash_tag,player_tag,observed_at),
 FOREIGN KEY (clan_id,source_clash_tag,player_tag)
   REFERENCES public.cwl_clan_member_tenure(clan_id,source_clash_tag,player_tag)
   ON DELETE CASCADE
);
CREATE INDEX cwl_clan_donation_observations_recent
 ON public.cwl_clan_donation_observations(clan_id,source_clash_tag,observed_at DESC);
ALTER TABLE public.cwl_clan_donation_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_clan_donation_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cwl_clan_donation_observations TO authenticated;
GRANT SELECT,INSERT ON public.cwl_clan_donation_observations TO service_role;
CREATE POLICY cwl_clan_donation_observations_owner_read
 ON public.cwl_clan_donation_observations
 FOR SELECT TO authenticated USING (private.cwl_is_owner(clan_id));

-- One row per observed departure; no unobserved past absences are reconstructed.
-- A streak accrues ONLY between two consecutive absent full-roster observations
-- <=3h apart, mirroring the conservative confirmed-presence clock. A hidden
-- leave/rejoin between snapshots remains unknowable; the streak is NOT proof
-- of literal uninterrupted physical absence or player inactivity.
CREATE TABLE public.cwl_clan_absence_observations (
 clan_id uuid NOT NULL,
 source_clash_tag text NOT NULL,
 player_tag text NOT NULL,
 prior_visit_number integer NOT NULL CHECK (prior_visit_number >= 1),
 leave_observed_at timestamptz NOT NULL,
 last_absent_observed_at timestamptz NOT NULL,
 return_observed_at timestamptz,
 observed_absent_snapshots integer NOT NULL DEFAULT 1 CHECK (observed_absent_snapshots >= 1),
 current_streak_seconds bigint NOT NULL DEFAULT 0 CHECK (current_streak_seconds >= 0),
 max_streak_seconds bigint NOT NULL DEFAULT 0 CHECK (max_streak_seconds >= 0),
 PRIMARY KEY (clan_id,source_clash_tag,player_tag,prior_visit_number),
 FOREIGN KEY (clan_id,source_clash_tag,player_tag)
   REFERENCES public.cwl_clan_member_tenure(clan_id,source_clash_tag,player_tag)
   ON DELETE CASCADE,
 CHECK (leave_observed_at <= last_absent_observed_at),
 CHECK (return_observed_at IS NULL OR return_observed_at >= last_absent_observed_at),
 CHECK (max_streak_seconds >= current_streak_seconds)
);
CREATE INDEX cwl_clan_absence_observations_recent
 ON public.cwl_clan_absence_observations(clan_id,source_clash_tag,player_tag,leave_observed_at DESC);
ALTER TABLE public.cwl_clan_absence_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_clan_absence_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cwl_clan_absence_observations TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cwl_clan_absence_observations TO service_role;
CREATE POLICY cwl_clan_absence_observations_owner_read
 ON public.cwl_clan_absence_observations
 FOR SELECT TO authenticated USING (private.cwl_is_owner(clan_id));

-- Runs inside the SAME existing service-role transaction/advisory lock that
-- updates cwl_clan_member_tenure. No new scheduler, external API calls,
-- autonomous collector, privileges, or client code are introduced.
CREATE FUNCTION public.cwl_capture_clan_loyalty_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $loyalty$
DECLARE
 v_elapsed bigint;
BEGIN
 IF current_user <> 'service_role' THEN
   RAISE EXCEPTION 'collector only' USING errcode = '42501';
 END IF;

 -- The preceding evidence-RPC has ALREADY validated positive in-season
 -- donation changes between complete <=3h snapshots. Record exactly once
 -- when its verified observation timestamp changes; no season-reset deltas.
 IF NEW.last_donation_increase_at IS DISTINCT FROM OLD.last_donation_increase_at
    AND NEW.last_donation_increase_at IS NOT NULL
    AND NEW.last_donation_increase_by BETWEEN 1 AND 9999999 THEN
   INSERT INTO public.cwl_clan_donation_observations
    (clan_id,source_clash_tag,player_tag,observed_at,positive_delta)
   VALUES (NEW.clan_id,NEW.source_clash_tag,NEW.player_tag,
           NEW.last_donation_increase_at,NEW.last_donation_increase_by)
   ON CONFLICT DO NOTHING;
 END IF;

 IF OLD.is_present AND NOT NEW.is_present THEN
   INSERT INTO public.cwl_clan_absence_observations
    (clan_id,source_clash_tag,player_tag,prior_visit_number,
     leave_observed_at,last_absent_observed_at)
   VALUES (NEW.clan_id,NEW.source_clash_tag,NEW.player_tag,OLD.observed_visits,
           NEW.last_observed_at,NEW.last_observed_at)
   ON CONFLICT DO NOTHING;
 ELSIF NOT OLD.is_present AND NOT NEW.is_present
       AND NEW.last_observed_at > OLD.last_observed_at THEN
   v_elapsed := pg_catalog.floor(
      pg_catalog.extract(epoch FROM NEW.last_observed_at-OLD.last_observed_at)
   )::bigint;
   UPDATE public.cwl_clan_absence_observations a SET
     last_absent_observed_at=NEW.last_observed_at,
     observed_absent_snapshots=a.observed_absent_snapshots+1,
     current_streak_seconds=CASE WHEN v_elapsed <= 10800
       THEN a.current_streak_seconds+v_elapsed ELSE 0 END,
     max_streak_seconds=pg_catalog.greatest(
       a.max_streak_seconds,CASE WHEN v_elapsed <= 10800
        THEN a.current_streak_seconds+v_elapsed ELSE 0 END
     )
   WHERE a.clan_id=NEW.clan_id AND a.source_clash_tag=NEW.source_clash_tag
     AND a.player_tag=NEW.player_tag AND a.prior_visit_number=OLD.observed_visits
     AND a.return_observed_at IS NULL;
 ELSIF NOT OLD.is_present AND NEW.is_present THEN
   UPDATE public.cwl_clan_absence_observations a SET
     return_observed_at=NEW.last_observed_at
   WHERE a.clan_id=NEW.clan_id AND a.source_clash_tag=NEW.source_clash_tag
     AND a.player_tag=NEW.player_tag AND a.prior_visit_number=OLD.observed_visits
     AND a.return_observed_at IS NULL;
 END IF;
 RETURN NEW;
END;
$loyalty$;
REVOKE ALL ON FUNCTION public.cwl_capture_clan_loyalty_evidence()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cwl_clan_loyalty_evidence_after_update
 AFTER UPDATE ON public.cwl_clan_member_tenure
 FOR EACH ROW
 EXECUTE FUNCTION public.cwl_capture_clan_loyalty_evidence();
COMMENT ON TABLE public.cwl_clan_donation_observations IS
 'Owner-private observed positive donations from independently verified current-season roster deltas; no historical backfill or login inference.';
COMMENT ON TABLE public.cwl_clan_absence_observations IS
 'Owner-private observed absence windows and bounded polling streaks; no automatic promotion qualification reset or factual offline assertion.';
