-- #178 Phase 3b: owner-private, append-only recovery CANDIDATES.
-- No active profile/plan/archive is changed by this migration or its RPC.
-- Protected CWL lineup and group archives remain collector-only writable.
-- Candidate source is untrusted; owner must review before any future apply.
CREATE TABLE public.cwl_portable_plan_recovery_candidates (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 clan_id uuid NOT NULL REFERENCES public.cwl_clans(id) ON DELETE CASCADE,
 actor_user_id uuid NOT NULL DEFAULT auth.uid(),
 source_clan_id uuid NOT NULL,
 source_revision bigint NOT NULL CHECK (source_revision>=1),
 source_clash_tag text NOT NULL CHECK (source_clash_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 target_revision bigint NOT NULL CHECK (target_revision>=1),
 source_profile_json jsonb NOT NULL CHECK (
   pg_catalog.jsonb_typeof(source_profile_json)='object'
   AND pg_catalog.octet_length(source_profile_json::text)<=5242880),
 source_review_state jsonb NOT NULL CHECK (
   pg_catalog.jsonb_typeof(source_review_state)='array'
   AND pg_catalog.jsonb_array_length(source_review_state)<=1),
 source_group_archives jsonb NOT NULL CHECK (
   pg_catalog.jsonb_typeof(source_group_archives)='array'
   AND pg_catalog.jsonb_array_length(source_group_archives)<=120
   AND pg_catalog.octet_length(source_group_archives::text)<=8388608),
 source_own_lineup_archives jsonb NOT NULL CHECK (
   pg_catalog.jsonb_typeof(source_own_lineup_archives)='array'
   AND pg_catalog.jsonb_array_length(source_own_lineup_archives)<=840
   AND pg_catalog.octet_length(source_own_lineup_archives::text)<=8388608),
 target_before jsonb NOT NULL CHECK (
   pg_catalog.jsonb_typeof(target_before)='object'
   AND pg_catalog.octet_length(target_before::text)<=12582912),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 CONSTRAINT cwl_portable_recovery_candidate_identity UNIQUE (
   clan_id,source_clan_id,source_revision,target_revision)
);
CREATE INDEX cwl_portable_recovery_candidate_recent
 ON public.cwl_portable_plan_recovery_candidates(clan_id,created_at DESC,id DESC);
ALTER TABLE public.cwl_portable_plan_recovery_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_portable_plan_recovery_candidates FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cwl_portable_plan_recovery_candidates TO authenticated;
GRANT INSERT (
 clan_id,source_clan_id,source_revision,source_clash_tag,
 target_revision,source_profile_json,source_review_state,
 source_group_archives,source_own_lineup_archives,target_before
) ON public.cwl_portable_plan_recovery_candidates TO authenticated;
CREATE POLICY cwl_recovery_candidate_owner_read
 ON public.cwl_portable_plan_recovery_candidates FOR SELECT TO authenticated
 USING(
  actor_user_id=(select auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.cwl_clans c
    JOIN public.cwl_clan_memberships m
      ON m.clan_id=c.id AND m.user_id=(select auth.uid()) AND m.role='owner'
    WHERE c.id=cwl_portable_plan_recovery_candidates.clan_id
      AND c.owner_user_id=(select auth.uid())
  )
 );
CREATE POLICY cwl_recovery_candidate_owner_insert
 ON public.cwl_portable_plan_recovery_candidates FOR INSERT TO authenticated
 WITH CHECK(
  actor_user_id=(select auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.cwl_clans c
    JOIN public.cwl_clan_memberships m
      ON m.clan_id=c.id AND m.user_id=(select auth.uid()) AND m.role='owner'
    WHERE c.id=cwl_portable_plan_recovery_candidates.clan_id
      AND c.owner_user_id=(select auth.uid())
  )
 );
COMMENT ON TABLE public.cwl_portable_plan_recovery_candidates IS
 'Private immutable plan/archives recovery proposal with target before-state. Never automatically applies plans, locks, lineups or archive results.';
