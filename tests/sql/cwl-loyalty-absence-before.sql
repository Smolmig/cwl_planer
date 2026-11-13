-- Prove original migration really fails on the 2nd verified absent snapshot.
\set ON_ERROR_STOP on
SET ROLE service_role;
INSERT INTO public.cwl_clan_member_tenure
  (clan_id,source_clash_tag,player_tag,is_present,observed_visits,last_observed_at)
VALUES
  ('11111111-1111-4111-8111-111111111111','#2PYL','#2PYQ',true,1,'2026-11-13 10:00:00+00');
UPDATE public.cwl_clan_member_tenure SET
  is_present=false,last_observed_at='2026-11-13 10:10:00+00'
WHERE clan_id='11111111-1111-4111-8111-111111111111';
DO $do$
DECLARE detail text;
BEGIN
  UPDATE public.cwl_clan_member_tenure SET
    last_observed_at='2026-11-13 10:20:00+00'
  WHERE clan_id='11111111-1111-4111-8111-111111111111';
  RAISE EXCEPTION 'Expected the original invalid pg_catalog.greatest to fail';
EXCEPTION WHEN undefined_function THEN
  GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT;
  IF position('pg_catalog.greatest' in lower(detail))=0 THEN
    RAISE EXCEPTION 'Unexpected missing SQL function; cannot accept as root cause';
  END IF;
END;
$do$;
RESET ROLE;
DO $do$
BEGIN
 IF (SELECT count(*) FROM public.cwl_clan_absence_observations)<>1
    OR (SELECT max(last_observed_at) FROM public.cwl_clan_member_tenure)
       IS DISTINCT FROM '2026-11-13 10:10:00+00'::timestamptz
 THEN RAISE EXCEPTION 'Failed collector write did not roll back atomically'; END IF;
END;
$do$;
SELECT 'PASS: original bug reproduced safely without a partial write';
