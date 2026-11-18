-- Local restore fixture compatibility ONLY. Never apply to production Supabase.
-- Hosted Auth (Nov 2026) added two nullable columns to auth.one_time_tokens;
-- the pinned local Supabase DB bootstrap can lag behind the hosted service.
-- Avoid dropping, rewriting, silently skipping, or synthesizing any Auth rows.
-- Execute within psql --single-transaction, after the app schema dump and
-- BEFORE auth-data.sql, exclusively against the disposable localhost database.
DO $restore_auth$
BEGIN
  IF to_regclass('auth.one_time_tokens') IS NULL THEN
    RAISE EXCEPTION 'Local Supabase auth.one_time_tokens missing; stop recovery drill';
  END IF;
END $restore_auth$;

ALTER TABLE auth.one_time_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS link_token_hash text;

-- Fail closed if a future/bootstrap schema uses incompatible types or
-- constraints. Only these two specifically researched, additive columns
-- are allowed; other migrations must be investigated and documented.
DO $restore_auth$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'auth.one_time_tokens'::regclass
      AND a.attname = 'expires_at' AND NOT a.attisdropped
      AND (format_type(a.atttypid, a.atttypmod) <> 'timestamp with time zone'
           OR a.attnotnull)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'auth.one_time_tokens'::regclass
      AND attname = 'expires_at' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Local expires_at column has an unexpected definition';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'auth.one_time_tokens'::regclass
      AND a.attname = 'link_token_hash' AND NOT a.attisdropped
      AND (format_type(a.atttypid, a.atttypmod) <> 'text'
           OR a.attnotnull)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'auth.one_time_tokens'::regclass
      AND attname = 'link_token_hash' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Local link_token_hash column has an unexpected definition';
  END IF;
END $restore_auth$;
