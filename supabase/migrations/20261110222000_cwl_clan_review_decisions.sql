-- #183 phase 2e1: persistent owner-only review outcomes for individual
-- evidence-based rank *suggestions*. Never modifies Clash, plan, tenure,
-- historical attacks, other tenants or discretionary violations.
CREATE TABLE public.cwl_clan_review_decisions (
 clan_id uuid NOT NULL,
 source_clash_tag text NOT NULL,
 player_tag text NOT NULL,
 review_kind text NOT NULL CHECK (review_kind IN ('performance','loyalty','return_rank')),
 disposition text NOT NULL CHECK (disposition IN ('open','acknowledged','exception')),
 evidence_fingerprint text NOT NULL CHECK (
  length(evidence_fingerprint) BETWEEN 2 AND 768
 ),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision>=1),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (clan_id,source_clash_tag,player_tag,review_kind),
 FOREIGN KEY (clan_id,source_clash_tag,player_tag)
  REFERENCES public.cwl_clan_member_tenure(clan_id,source_clash_tag,player_tag)
  ON DELETE CASCADE
);
CREATE INDEX cwl_clan_review_decisions_clan
 ON public.cwl_clan_review_decisions(clan_id,source_clash_tag,updated_at DESC);
ALTER TABLE public.cwl_clan_review_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_clan_review_decisions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cwl_clan_review_decisions TO authenticated;

-- One and only one app-clan owner can review this specific current linked
-- Clash clan. Foreign app tenant, reused player tag, or changed clan link
-- does not grant access to or reuse prior private decisions.
CREATE POLICY cwl_review_owner_select ON public.cwl_clan_review_decisions
 FOR SELECT TO authenticated USING (
  private.cwl_is_owner(clan_id)
  AND EXISTS (SELECT 1 FROM public.cwl_clans c
   WHERE c.id=cwl_clan_review_decisions.clan_id
    AND c.clash_tag=cwl_clan_review_decisions.source_clash_tag)
 );
CREATE POLICY cwl_review_owner_insert ON public.cwl_clan_review_decisions
 FOR INSERT TO authenticated WITH CHECK (
  private.cwl_is_owner(clan_id)
  AND EXISTS (SELECT 1 FROM public.cwl_clans c
   WHERE c.id=cwl_clan_review_decisions.clan_id
    AND c.clash_tag=cwl_clan_review_decisions.source_clash_tag)
 );
CREATE POLICY cwl_review_owner_update ON public.cwl_clan_review_decisions
 FOR UPDATE TO authenticated USING (
  private.cwl_is_owner(clan_id)
  AND EXISTS (SELECT 1 FROM public.cwl_clans c
   WHERE c.id=cwl_clan_review_decisions.clan_id
    AND c.clash_tag=cwl_clan_review_decisions.source_clash_tag)
 ) WITH CHECK (
  private.cwl_is_owner(clan_id)
  AND EXISTS (SELECT 1 FROM public.cwl_clans c
   WHERE c.id=cwl_clan_review_decisions.clan_id
    AND c.clash_tag=cwl_clan_review_decisions.source_clash_tag)
 );
COMMENT ON TABLE public.cwl_clan_review_decisions IS
 'Private owner decisions on observed rank-review suggestions. Acknowledgments expire when the relevant evidence fingerprint changes; exceptions persist until deliberately reopened. No in-game or planner changes.';
