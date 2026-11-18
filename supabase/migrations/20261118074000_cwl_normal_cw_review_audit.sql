-- Clanverwaltung #183: future-only provenance for verified normal-CW misses.
-- Existing war/attack/missed rows are NOT backfilled or reclassified.
-- Old imported wars and old API wars without the new source tag remain unknown.
ALTER TABLE public.cwl_stat_wars
 ADD COLUMN IF NOT EXISTS source_clash_tag text;
ALTER TABLE public.cwl_stat_wars
 ADD CONSTRAINT cwl_stat_wars_source_clash_tag_format
 CHECK (source_clash_tag IS NULL OR source_clash_tag ~ '^#[0289PYLQGRJCUV]{3,15}$');
COMMENT ON COLUMN public.cwl_stat_wars.source_clash_tag IS
 'Collector-observed own Clash clan tag, captured together with an API war; NULL for old/imported/unknown provenance. Do not infer a historic tag.';
CREATE INDEX cwl_stat_wars_verified_normal_own
 ON public.cwl_stat_wars(clan_id,source_clash_tag,started_at DESC)
 WHERE war_type='normal' AND source='api' AND finalized
  AND missed_log_complete;

-- A human decision is appended per verified missing-attack EVENT (war+player).
-- "reviewed" is not an excusal. "reopened" explicitly revokes the latest
-- disposition. No soft/hard automatic rank or plan mutation exists here.
CREATE TABLE public.cwl_clan_cw_missed_decisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 clan_id uuid NOT NULL REFERENCES public.cwl_clans(id) ON DELETE CASCADE,
 source_clash_tag text NOT NULL
  CHECK (source_clash_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 war_key text NOT NULL CHECK (war_key LIKE 'normal:%' AND length(war_key)<=100),
 player_tag text NOT NULL CHECK (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 decision text NOT NULL CHECK (decision IN ('acknowledged','excused','reopened')),
 note text NOT NULL DEFAULT '' CHECK (char_length(note)<=280),
 actor_id uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cwl_clan_cw_missed_decisions_latest
 ON public.cwl_clan_cw_missed_decisions
 (clan_id,source_clash_tag,war_key,player_tag,id DESC);
ALTER TABLE public.cwl_clan_cw_missed_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_clan_cw_missed_decisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cwl_clan_cw_missed_decisions TO authenticated;
GRANT INSERT (clan_id,source_clash_tag,war_key,player_tag,decision,note)
 ON public.cwl_clan_cw_missed_decisions TO authenticated;

-- Every read is for the CURRENT owner and CURRENT linked Clash tag.
-- Re-linking a tenant cannot accidentally reuse another clan's private
-- disciplinary history. Historic rows remain stored, never rewritten.
CREATE POLICY cwl_clan_cw_missed_owner_read
 ON public.cwl_clan_cw_missed_decisions FOR SELECT TO authenticated
 USING (
  private.cwl_is_owner(clan_id)
  AND EXISTS (SELECT 1 FROM public.cwl_clans c
   WHERE c.id=cwl_clan_cw_missed_decisions.clan_id
    AND c.clash_tag=cwl_clan_cw_missed_decisions.source_clash_tag)
 );

-- Owner may ONLY append a judgment for a confirmed, own-clan,
-- complete collector-sourced normal-CW missed row. A login, ordinary
-- missing API data, an import and a foreign app tenant never qualify.
CREATE POLICY cwl_clan_cw_missed_owner_insert
 ON public.cwl_clan_cw_missed_decisions FOR INSERT TO authenticated
 WITH CHECK (
  actor_id=(SELECT auth.uid())
  AND private.cwl_is_owner(clan_id)
  AND EXISTS (
   SELECT 1
   FROM public.cwl_clans c
   JOIN public.cwl_stat_wars w
     ON w.clan_id=c.id AND w.source_clash_tag=c.clash_tag
   JOIN public.cwl_stat_missed m
     ON m.clan_id=w.clan_id AND m.war_key=w.war_key
   WHERE c.id=cwl_clan_cw_missed_decisions.clan_id
     AND c.clash_tag=cwl_clan_cw_missed_decisions.source_clash_tag
     AND w.war_key=cwl_clan_cw_missed_decisions.war_key
     AND w.war_type='normal'
     AND w.source='api'
     AND w.finalized IS TRUE
     AND w.missed_log_complete IS TRUE
     AND m.player_tag=cwl_clan_cw_missed_decisions.player_tag
     AND m.missed_count BETWEEN 1 AND 2
     AND w.roster_tags @> to_jsonb(ARRAY[cwl_clan_cw_missed_decisions.player_tag])
  )
 );
-- Deliberately no UPDATE, DELETE grants or policies, nor privileged RPC.
COMMENT ON TABLE public.cwl_clan_cw_missed_decisions IS
 'Append-only owner decisions for source-tag-scoped, verified normal-CW missed attack events; no automatic sanctions and no cross-clan sharing.';
