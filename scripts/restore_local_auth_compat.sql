-- READ-ONLY compatibility gate in disposable local Supabase PostgreSQL.
-- Hosted Supabase Auth added expires_at and link_token_hash to one_time_tokens.
-- Use a matching pinned CLI bootstrap; verify newer OAuth columns as well instead
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
  IF to_regclass('auth.custom_oauth_providers') IS NULL THEN
    RAISE EXCEPTION 'Local Auth custom OAuth provider table missing; restore blocked';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('custom_claims_allowlist','text[]',true),
      ('client_auth_method','text',true),
      ('client_assertion_audience','text',false)
    ) AS required(column_name,column_type,not_null)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid='auth.custom_oauth_providers'::regclass
        AND a.attname=required.column_name AND NOT a.attisdropped
        AND format_type(a.atttypid,a.atttypmod)=required.column_type
        AND a.attnotnull=required.not_null
    )
  ) THEN
    RAISE EXCEPTION 'Local Auth custom OAuth provider columns incompatible with source';
  END IF;
END $restore_auth$;
