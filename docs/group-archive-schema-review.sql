-- CWL group archive. Applied through Supabase migrations only after full regression.
-- Separate from shared profile JSON; no player rosters or opponent attacks stored.
CREATE TABLE public.cwl_group_archives (
  clan_id uuid NOT NULL REFERENCES public.cwl_clans(id) ON DELETE CASCADE,
  season text NOT NULL CHECK (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  clan_tag text NOT NULL CHECK (clan_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
  group_json jsonb NOT NULL CHECK (
    jsonb_typeof(group_json) = 'object'
    AND octet_length(group_json::text) <= 131072
    AND group_json->>'season' = season
    AND group_json->>'clanTag' = clan_tag
    AND jsonb_typeof(group_json->'clans') = 'array'
    AND jsonb_typeof(group_json->'rounds') = 'array'
    AND jsonb_array_length(group_json->'clans') BETWEEN 2 AND 8
    AND jsonb_array_length(group_json->'rounds') BETWEEN 0 AND 7
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, season)
);
CREATE INDEX cwl_group_archives_recent ON public.cwl_group_archives
  (clan_id, season DESC);

-- The archive is advanced monotonically, independently per war.
-- A previous finished war cannot be reverted to a live/preparation snapshot.
-- A newer partial response never erases previously available matches.
CREATE FUNCTION private.cwl_merge_group_archive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $archive$
DECLARE
  old_clans jsonb;
  new_clans jsonb;
  old_rounds jsonb;
  new_rounds jsonb;
  old_matches jsonb;
  new_matches jsonb;
  merged_rounds jsonb := '[]'::jsonb;
  merged_matches jsonb;
  old_match jsonb;
  next_match jsonb;
  chosen jsonb;
  old_state text;
  next_state text;
  old_attacks integer;
  next_attacks integer;
  i integer;
  j integer;
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF NEW.clan_id <> OLD.clan_id OR NEW.season <> OLD.season OR
     NEW.clan_tag <> OLD.clan_tag THEN
    RAISE EXCEPTION 'group archive identity cannot change' USING ERRCODE = '23514';
  END IF;
  old_clans := COALESCE(OLD.group_json->'clans', '[]'::jsonb);
  new_clans := COALESCE(NEW.group_json->'clans', '[]'::jsonb);
  IF jsonb_array_length(new_clans) < jsonb_array_length(old_clans) THEN
    new_clans := old_clans;
  END IF;
  old_rounds := COALESCE(OLD.group_json->'rounds', '[]'::jsonb);
  new_rounds := COALESCE(NEW.group_json->'rounds', '[]'::jsonb);
  FOR i IN 0..6 LOOP
    old_matches := COALESCE(old_rounds->i->'matches', '[]'::jsonb);
    new_matches := COALESCE(new_rounds->i->'matches', '[]'::jsonb);
    merged_matches := '[]'::jsonb;
    FOR j IN 0..3 LOOP
      old_match := old_matches->j;
      next_match := new_matches->j;
      IF old_match IS NULL AND next_match IS NULL THEN CONTINUE; END IF;
      chosen := COALESCE(next_match, old_match);
      IF old_match->>'available' = 'true' THEN
        old_state := old_match->>'state';
        next_state := next_match->>'state';
        IF COALESCE(next_match->>'available','false') <> 'true' OR
           (old_state = 'warEnded' AND next_state <> 'warEnded') OR
           (old_state = 'inWar' AND next_state = 'preparation') THEN
          chosen := old_match;
        ELSIF old_state = 'inWar' AND next_state = 'inWar' THEN
          old_attacks := COALESCE((old_match#>>'{clan,attacks}')::integer,0)
                         + COALESCE((old_match#>>'{opponent,attacks}')::integer,0);
          next_attacks := COALESCE((next_match#>>'{clan,attacks}')::integer,0)
                          + COALESCE((next_match#>>'{opponent,attacks}')::integer,0);
          IF next_attacks < old_attacks OR
             COALESCE((next_match#>>'{clan,stars}')::integer,0) <
               COALESCE((old_match#>>'{clan,stars}')::integer,0) OR
             COALESCE((next_match#>>'{opponent,stars}')::integer,0) <
               COALESCE((old_match#>>'{opponent,stars}')::integer,0) THEN
            chosen := old_match;
          END IF;
        END IF;
      END IF;
      merged_matches := merged_matches || jsonb_build_array(chosen);
    END LOOP;
    IF i < jsonb_array_length(old_rounds) OR i < jsonb_array_length(new_rounds) THEN
      merged_rounds := merged_rounds || jsonb_build_array(
        jsonb_build_object('day',i+1,'matches',merged_matches)
      );
    END IF;
  END LOOP;
  NEW.group_json := jsonb_build_object(
    'season', NEW.season,
    'clanTag', NEW.clan_tag,
    'clans', new_clans,
    'rounds', merged_rounds
  );
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$archive$;
REVOKE ALL ON FUNCTION private.cwl_merge_group_archive() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cwl_group_archive_merge
  BEFORE INSERT OR UPDATE ON public.cwl_group_archives
  FOR EACH ROW EXECUTE FUNCTION private.cwl_merge_group_archive();

ALTER TABLE public.cwl_group_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cwl_group_archives FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cwl_group_archives TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cwl_group_archives TO service_role;

CREATE POLICY cwl_group_archive_member_read
  ON public.cwl_group_archives FOR SELECT TO authenticated
  USING (private.cwl_is_member(clan_id));
-- No client INSERT/UPDATE/DELETE grant or policy. Only the authenticated
-- Edge function, after verifying clan membership, uses server-side credentials.
