-- Synthetic PostgreSQL17 local-only schema gate test. No real users.
-- Prove that repeated inspections leave the source shape and rows unchanged.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.one_time_tokens(
 id uuid PRIMARY KEY,
 expires_at timestamptz NULL,
 link_token_hash text NULL
);
INSERT INTO auth.one_time_tokens(id,expires_at,link_token_hash)
VALUES('11111111-1111-4111-8111-111111111111',NULL,NULL);
-- Synthetic shape only; this fixture cannot substitute for real GoTrue canary.
CREATE TABLE auth.custom_oauth_providers(
 id uuid PRIMARY KEY,
 custom_claims_allowlist text[] NOT NULL DEFAULT '{}',
 client_auth_method text NOT NULL DEFAULT 'client_secret',
 client_assertion_audience text NULL
);
INSERT INTO auth.custom_oauth_providers(id,custom_claims_allowlist,client_auth_method,client_assertion_audience)
VALUES('22222222-2222-4222-8222-222222222222',ARRAY['synthetic_claim'],'client_secret',NULL);
\i scripts/restore_local_auth_compat.sql
\i scripts/restore_local_auth_compat.sql
DO $synthetic_oauth$
BEGIN
 IF (SELECT count(*) FROM auth.custom_oauth_providers) <> 1 OR
    (SELECT count(*) FROM auth.custom_oauth_providers
      WHERE custom_claims_allowlist=ARRAY['synthetic_claim'] AND client_auth_method='client_secret'
      AND client_assertion_audience IS NULL) <> 1 THEN
  RAISE EXCEPTION 'Read-only Auth gate changed synthetic OAuth content';
 END IF;
END $synthetic_oauth$;
DO $synthetic$
BEGIN
 IF (SELECT count(*) FROM auth.one_time_tokens) <> 1 OR
    (SELECT count(*) FROM auth.one_time_tokens WHERE
       expires_at IS NULL AND link_token_hash IS NULL) <> 1 THEN
  RAISE EXCEPTION 'Read-only Auth gate changed synthetic token content';
 END IF;
END $synthetic$;
ROLLBACK;
DO $synthetic$
BEGIN
 IF to_regclass('auth.one_time_tokens') IS NOT NULL OR to_regclass('auth.custom_oauth_providers') IS NOT NULL THEN
  RAISE EXCEPTION 'Synthetic auth table survived rollback';
 END IF;
END $synthetic$;
