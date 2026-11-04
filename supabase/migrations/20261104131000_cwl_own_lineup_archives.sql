-- Immutable-by-war, member-readable CWL lineup archive.
-- Store *only our own* verified inWar/warEnded rosters. Never store preparation.
CREATE TABLE public.cwl_own_lineup_archives (
  clan_id uuid NOT NULL REFERENCES public.cwl_clans(id) ON DELETE CASCADE,
  season text NOT NULL CHECK (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  day smallint NOT NULL CHECK (day BETWEEN 1 AND 7),
  war_tag text NOT NULL CHECK (war_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
  state text NOT NULL CHECK (state IN ('inWar','warEnded')),
  team_size smallint NOT NULL CHECK (team_size BETWEEN 1 AND 50),
  lineup_json jsonb NOT NULL CHECK (
    jsonb_typeof(lineup_json) = 'object' AND
    jsonb_typeof(lineup_json->'members') = 'array' AND
    jsonb_array_length(lineup_json->'members') = team_size AND
    octet_length(lineup_json::text) <= 65536
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, season, day)
);
CREATE INDEX cwl_own_lineup_archive_recent ON public.cwl_own_lineup_archives(clan_id,season DESC,day);

CREATE FUNCTION private.cwl_preserve_own_lineup()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $guard$
DECLARE
  old_tags text[];
  incoming_tags text[];
  old_attacks int;
  incoming_attacks int;
  old_stars int;
  incoming_stars int;
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.clan_id <> NEW.clan_id OR OLD.season <> NEW.season OR
     OLD.day <> NEW.day OR OLD.war_tag <> NEW.war_tag OR
     OLD.team_size <> NEW.team_size THEN
    RAISE EXCEPTION 'CWL lineup identity cannot change' USING ERRCODE='23514';
  END IF;
  IF OLD.state = 'warEnded' AND NEW.state <> 'warEnded' THEN RETURN OLD; END IF;

  SELECT array_agg(m->>'tag' ORDER BY m->>'tag') INTO old_tags
    FROM pg_catalog.jsonb_array_elements(OLD.lineup_json->'members') m;
  SELECT array_agg(m->>'tag' ORDER BY m->>'tag') INTO incoming_tags
    FROM pg_catalog.jsonb_array_elements(NEW.lineup_json->'members') m;
  IF old_tags IS DISTINCT FROM incoming_tags THEN
    -- The participant roster is locked from war start. Do not silently replace it.
    RETURN OLD;
  END IF;

  SELECT COALESCE(SUM(pg_catalog.jsonb_array_length(COALESCE(m->'attacks','[]'::jsonb))),0)
    INTO old_attacks
    FROM pg_catalog.jsonb_array_elements(OLD.lineup_json->'members') m;
  SELECT COALESCE(SUM(pg_catalog.jsonb_array_length(COALESCE(m->'attacks','[]'::jsonb))),0)
    INTO incoming_attacks
    FROM pg_catalog.jsonb_array_elements(NEW.lineup_json->'members') m;
  SELECT COALESCE(SUM((a->>'stars')::int),0) INTO old_stars
    FROM pg_catalog.jsonb_array_elements(OLD.lineup_json->'members') m
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(m->'attacks','[]'::jsonb)) a;
  SELECT COALESCE(SUM((a->>'stars')::int),0) INTO incoming_stars
    FROM pg_catalog.jsonb_array_elements(NEW.lineup_json->'members') m
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(m->'attacks','[]'::jsonb)) a;
  IF incoming_attacks < old_attacks OR incoming_stars < old_stars THEN RETURN OLD; END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION private.cwl_preserve_own_lineup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cwl_own_lineup_guard
 BEFORE INSERT OR UPDATE ON public.cwl_own_lineup_archives
 FOR EACH ROW EXECUTE FUNCTION private.cwl_preserve_own_lineup();

ALTER TABLE public.cwl_own_lineup_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_own_lineup_archives FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cwl_own_lineup_archives TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cwl_own_lineup_archives TO service_role;
CREATE POLICY cwl_own_lineup_archive_members_read
 ON public.cwl_own_lineup_archives FOR SELECT TO authenticated
 USING(private.cwl_is_member(clan_id));
-- No policies or grants for authenticated INSERT, UPDATE, DELETE.
