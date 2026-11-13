-- #183 collector incident 2026-11-13: PostgreSQL SQLSTATE 42883 on
-- repeated observations of a player absent from a full verified roster.
-- GREATEST is a parser-level SQL conditional expression, not a callable
-- pg_catalog.greatest() function. Original logic, SECURITY INVOKER, empty
-- search_path, tenant scope, trigger binding and EXECUTE grants are retained.
-- Deploy separately after explicit approval; no data backfill or recalculation.
-- Source definition: 20261110182000_cwl_clan_loyalty_evidence.sql.
CREATE OR REPLACE FUNCTION public.cwl_capture_clan_loyalty_evidence()
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
      extract(epoch FROM NEW.last_observed_at-OLD.last_observed_at)
   )::bigint;
   UPDATE public.cwl_clan_absence_observations a SET
     last_absent_observed_at=NEW.last_observed_at,
     observed_absent_snapshots=a.observed_absent_snapshots+1,
     current_streak_seconds=CASE WHEN v_elapsed <= 10800
       THEN a.current_streak_seconds+v_elapsed ELSE 0 END,
     max_streak_seconds=GREATEST(
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
