-- Exercise the exact replaced trigger against isolated PostgreSQL 17.
\set ON_ERROR_STOP on
SET ROLE service_role;
UPDATE public.cwl_clan_member_tenure SET
 last_observed_at='2026-11-13 10:20:00+00'
WHERE clan_id='11111111-1111-4111-8111-111111111111';
UPDATE public.cwl_clan_member_tenure SET
 last_observed_at='2026-11-13 10:30:00+00'
WHERE clan_id='11111111-1111-4111-8111-111111111111';
-- No inferred presence or absence credit for a gap >3 hours.
UPDATE public.cwl_clan_member_tenure SET
 last_observed_at='2026-11-13 14:30:00+00'
WHERE clan_id='11111111-1111-4111-8111-111111111111';
UPDATE public.cwl_clan_member_tenure SET
 last_observed_at='2026-11-13 14:40:00+00'
WHERE clan_id='11111111-1111-4111-8111-111111111111';
DO $do$
DECLARE evidence record;
BEGIN
 SELECT * INTO STRICT evidence FROM public.cwl_clan_absence_observations;
 IF evidence.observed_absent_snapshots<>5
    OR evidence.current_streak_seconds<>600
    OR evidence.max_streak_seconds<>1200
    OR evidence.return_observed_at IS NOT NULL
    OR evidence.prior_visit_number<>1
    OR evidence.leave_observed_at<>'2026-11-13 10:10:00+00'::timestamptz
 THEN RAISE EXCEPTION 'Invalid absence observations after bounded time windows'; END IF;
END;
$do$;
UPDATE public.cwl_clan_member_tenure SET
 is_present=true,observed_visits=2,last_observed_at='2026-11-13 14:50:00+00'
WHERE clan_id='11111111-1111-4111-8111-111111111111';
DO $do$
DECLARE evidence record;
BEGIN
 SELECT * INTO STRICT evidence FROM public.cwl_clan_absence_observations;
 IF evidence.return_observed_at<>'2026-11-13 14:50:00+00'::timestamptz
    OR evidence.current_streak_seconds<>600 OR evidence.max_streak_seconds<>1200
 THEN RAISE EXCEPTION 'Return was not recorded safely'; END IF;
 IF (SELECT count(*) FROM public.cwl_clan_absence_observations)<>1
    OR (SELECT count(*) FROM public.cwl_clan_donation_observations)<>0
 THEN RAISE EXCEPTION 'Unexpected duplicate absence/donation evidence'; END IF;
END;
$do$;
RESET ROLE;
DO $do$
BEGIN
 IF pg_catalog.has_function_privilege('anon','public.cwl_capture_clan_loyalty_evidence()','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated','public.cwl_capture_clan_loyalty_evidence()','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role','public.cwl_capture_clan_loyalty_evidence()','EXECUTE')
 OR (SELECT prosecdef FROM pg_catalog.pg_proc
     WHERE oid='public.cwl_capture_clan_loyalty_evidence()'::regprocedure)
 OR (SELECT count(*) FROM pg_catalog.pg_trigger
     WHERE tgrelid='public.cwl_clan_member_tenure'::regclass
       AND tgname='cwl_clan_loyalty_evidence_after_update')<>1
 THEN RAISE EXCEPTION 'Migration altered service-only trigger security'; END IF;
END;
$do$;
SELECT 'PASS: real PG17 trigger fixes 42883; conservatively tracks absence, long gaps, return and grants';
