-- Disposable CI PostgREST user only. Never run against a real Supabase project.
-- The existing SQL fixture sets JWT subject as a legacy per-field GUC.
-- PostgreSQL 17 + current PostgREST pass a JSON request.jwt.claims GUC.
create role authenticator login noinherit password 'synthetic-http-only';
grant anon,authenticated to authenticator;
grant usage on schema public to anon,authenticated;
create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $$
 select nullif(
   coalesce(
     nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),''),
     nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
   ),'')::uuid
$$;
-- Real Supabase auth.uid() semantics (JWT subject) without real accounts.
-- Authorization must never use editable user_metadata claims.
