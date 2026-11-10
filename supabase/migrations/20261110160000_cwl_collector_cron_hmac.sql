-- #104 Independent Cron identity; prepares the database without scheduling calls.
-- A 256-bit random HMAC key is generated inside Vault, never committed or returned.
-- The service_role already has direct SELECT on vault.decrypted_secrets in this
-- Supabase project; the verifier stays SECURITY INVOKER, not DEFINER.
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets
    WHERE name = 'cwl_collector_cron_hmac_v1'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'cwl_collector_cron_hmac_v1',
      'Private HMAC signer for internal Clash collector Cron (no client access)'
    );
  END IF;
END
$block$;

CREATE OR REPLACE FUNCTION public.cwl_verify_collector_cron_request(
  p_timestamp bigint,
  p_signature text
) RETURNS boolean
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
 SELECT coalesce(
   p_timestamp IS NOT NULL
   AND p_signature ~ '^[0-9a-f]{64}$'
   AND p_timestamp BETWEEN
     floor(extract(epoch from now()))::bigint - 90
     AND floor(extract(epoch from now()))::bigint + 15
   AND (SELECT count(*) = 1 FROM vault.decrypted_secrets
        WHERE name = 'cwl_collector_cron_hmac_v1')
   AND p_signature = (
     SELECT encode(extensions.hmac(
       (p_timestamp::text || ':cwl:collector:cron:v1')::bytea,
       decode(secret.decrypted_secret, 'hex'), 'sha256'), 'hex')
     FROM vault.decrypted_secrets AS secret
     WHERE secret.name = 'cwl_collector_cron_hmac_v1'
     LIMIT 1
   ), false
 );
$fn$;

-- PostgREST makes public RPCs discoverable; no end-user may execute it.
REVOKE ALL ON FUNCTION public.cwl_verify_collector_cron_request(bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cwl_verify_collector_cron_request(bigint,text) FROM anon;
REVOKE ALL ON FUNCTION public.cwl_verify_collector_cron_request(bigint,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_verify_collector_cron_request(bigint,text) TO service_role;

COMMENT ON FUNCTION public.cwl_verify_collector_cron_request(bigint,text) IS
'Private service-role-only verification of short-lived signed internal Cron requests; returns boolean, no secrets.';
