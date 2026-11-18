-- Synthetic PostgreSQL17 local Auth migration test. No real Supabase users.
-- Only CREATE and ALTER in a disposable transaction; the rollback is required.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.one_time_tokens(id uuid PRIMARY KEY);
\i scripts/restore_local_auth_compat.sql
\i scripts/restore_local_auth_compat.sql
DO $synthetic$
BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_attribute
     WHERE attrelid='auth.one_time_tokens'::regclass
       AND attname IN ('expires_at','link_token_hash')
       AND NOT attisdropped) <> 2 THEN
  RAISE EXCEPTION 'Local Auth patch did not create the expected two columns';
 END IF;
 IF EXISTS (
   SELECT 1 FROM pg_catalog.pg_attribute
   WHERE attrelid='auth.one_time_tokens'::regclass
     AND attname IN ('expires_at','link_token_hash') AND attnotnull
 ) THEN
  RAISE EXCEPTION 'Local Auth patch introduced nonnullable columns';
 END IF;
END $synthetic$;
ROLLBACK;
DO $synthetic$ BEGIN IF to_regclass('auth.one_time_tokens') IS NOT NULL THEN RAISE EXCEPTION 'Synthetic auth table survived rollback'; END IF; END $synthetic$;
