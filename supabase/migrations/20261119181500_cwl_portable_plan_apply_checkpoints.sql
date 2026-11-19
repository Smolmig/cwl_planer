-- #178 Phase 3c: immutable plan-only apply checkpoint (clean target ONLY).
-- The checkpoint is inserted in the SAME SQL transaction BEFORE the profile
-- changes. Failing the profile UPDATE also rolls back this before-state row.
-- This is operational data, excluded from the 17-table portable file.
CREATE TABLE public.cwl_portable_plan_apply_checkpoints (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.cwl_clans(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES
    public.cwl_portable_plan_recovery_candidates(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL DEFAULT auth.uid(),
  source_clan_id uuid NOT NULL,
  before_revision bigint NOT NULL CHECK (before_revision>=1),
  applied_revision bigint NOT NULL CHECK (applied_revision=before_revision+1),
  before_profile_json jsonb NOT NULL CHECK (
    pg_catalog.jsonb_typeof(before_profile_json)='object'
    AND pg_catalog.octet_length(before_profile_json::text)<=5242880),
  applied_profile_json jsonb NOT NULL CHECK (
    pg_catalog.jsonb_typeof(applied_profile_json)='object'
    AND pg_catalog.octet_length(applied_profile_json::text)<=5242880),
  before_review_state jsonb NOT NULL CHECK (
    pg_catalog.jsonb_typeof(before_review_state) IN ('object','null')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT cwl_portable_plan_apply_once UNIQUE (clan_id,candidate_id)
);
CREATE INDEX cwl_portable_plan_apply_checkpoint_recent
 ON public.cwl_portable_plan_apply_checkpoints(clan_id,created_at DESC,id DESC);
ALTER TABLE public.cwl_portable_plan_apply_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_portable_plan_apply_checkpoints FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cwl_portable_plan_apply_checkpoints TO authenticated;
GRANT INSERT (
  clan_id,candidate_id,source_clan_id,
  before_revision,applied_revision,before_profile_json,
  applied_profile_json,before_review_state
) ON public.cwl_portable_plan_apply_checkpoints TO authenticated;
CREATE POLICY cwl_plan_apply_checkpoint_owner_read
 ON public.cwl_portable_plan_apply_checkpoints FOR SELECT TO authenticated
 USING (
   actor_user_id=(select auth.uid())
   AND EXISTS(
     SELECT 1 FROM public.cwl_clans c
     JOIN public.cwl_clan_memberships m
       ON m.clan_id=c.id AND m.user_id=(select auth.uid()) AND m.role='owner'
     WHERE c.id=cwl_portable_plan_apply_checkpoints.clan_id
       AND c.owner_user_id=(select auth.uid())
   )
 );
CREATE POLICY cwl_plan_apply_checkpoint_owner_insert
 ON public.cwl_portable_plan_apply_checkpoints FOR INSERT TO authenticated
 WITH CHECK (
   actor_user_id=(select auth.uid())
   AND EXISTS(
     SELECT 1 FROM public.cwl_clans c
     JOIN public.cwl_clan_memberships m
       ON m.clan_id=c.id AND m.user_id=(select auth.uid()) AND m.role='owner'
     WHERE c.id=cwl_portable_plan_apply_checkpoints.clan_id
       AND c.owner_user_id=(select auth.uid())
   )
 );
COMMENT ON TABLE public.cwl_portable_plan_apply_checkpoints IS
 'Immutable owner-only atomic before/after profile checkpoint for clean-target planning fields; no archived results, played locks or collector-only writes. Not a full app recovery/undo.';
