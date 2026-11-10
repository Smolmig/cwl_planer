-- #104 / phase 2: activate only AFTER the HMAC RPC migration and
-- coc-stats-collector code with dual fail-closed authentication are deployed
-- and verified with rollback-only database auth tests.
-- Separate UTC minute slots from GitHub's :17/:47 best-effort schedule.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'cwl-clan-collector-independent',
  '5,35 * * * *',
  $job$
  WITH signing AS (
    SELECT floor(extract(epoch from now()))::bigint AS at_utc,
           decrypted_secret AS secret_hex
    FROM vault.decrypted_secrets
    WHERE name = 'cwl_collector_cron_hmac_v1'
  )
  SELECT net.http_post(
    url := 'https://yjldnvfwposfwmzmcsow.supabase.co/functions/v1/coc-stats-collector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-CWL-Collector-Cron-At', signing.at_utc::text,
      'X-CWL-Collector-Cron-Signature',
        encode(extensions.hmac(
          (signing.at_utc::text || ':cwl:collector:cron:v1')::bytea,
          decode(signing.secret_hex, 'hex'), 'sha256'
        ), 'hex')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 125000
  ) AS request_id
  FROM signing;
  $job$
);

-- Emergency disable: SELECT cron.unschedule('cwl-clan-collector-independent');
-- Disabling this job never removes the GitHub OIDC workflow.
