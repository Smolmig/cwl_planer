-- PostgreSQL 17 disposable fixture. Synthetic tenants, no live secrets/data.
\set ON_ERROR_STOP on
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA private;
CREATE FUNCTION private.cwl_is_owner(uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.cwl_clan_member_tenure (
  clan_id uuid NOT NULL,
  source_clash_tag text NOT NULL,
  player_tag text NOT NULL,
  is_present boolean NOT NULL,
  observed_visits integer NOT NULL DEFAULT 1,
  last_observed_at timestamptz NOT NULL,
  last_donation_increase_at timestamptz,
  last_donation_increase_by integer,
  PRIMARY KEY (clan_id,source_clash_tag,player_tag)
);
GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cwl_clan_member_tenure TO service_role;
