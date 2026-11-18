-- READ-ONLY compatibility gate in disposable local Supabase PostgreSQL.
-- Hosted Supabase Auth added expires_at and link_token_hash to one_time_tokens.
-- CLI 3.2.0 bootstrap includes both; use the matching bootstrap instead
-- of an unsupported ALTER on the Supabase-owned Auth table.
-- Only catalog metadata is inspected. No user data, secrets, DDL, or grants.
-- Runs in the same single transaction before auth-data.sql. Fail closed
-- if the upstream Auth schema changes again.
DO $restore_auth$
BEGIN
  IF to_regclass('auth.one_time_tokens') IS NULL THEN
    RAISE EXCEPTION 'Local Supabase auth.one_time_tokens missing; restore blocked';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid='auth.one_time_tokens'::regclass
      AND a.attname='expires_at' AND NOT a.attisdropped
      AND format_type(a.atttypid,a.atttypmod)='timestamp with time zone'
      AND NOT a.attnotnull
  ) THEN
    RAISE EXCEPTION 'Local Auth expires_at column incompatible with source';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid='auth.one_time_tokens'::regclass
      AND a.attname='link_token_hash' AND NOT a.attisdropped
      AND format_type(a.atttypid,a.atttypmod)='text'
      AND NOT a.attnotnull
  ) THEN
    RAISE EXCEPTION 'Local Auth link_token_hash column incompatible with source';
  END IF;
END $restore_auth$;
