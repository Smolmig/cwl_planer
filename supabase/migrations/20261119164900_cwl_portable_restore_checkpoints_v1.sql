-- #178 Phase 3a – durable per-import fact checkpoint, created IN THE SAME
-- transaction and BEFORE changing any war/attack/missed evidence. Does NOT
-- constitute a full app profile/archive/security restore checkpoint.
-- This RLS-protected operational log must NEVER be part of a portable backup.
CREATE TABLE public.cwl_portable_restore_checkpoints (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 clan_id uuid NOT NULL REFERENCES public.cwl_clans(id) ON DELETE CASCADE,
 actor_user_id uuid NOT NULL DEFAULT auth.uid(),
 source_clan_id uuid NOT NULL,
 profile_revision bigint NOT NULL CHECK (profile_revision>0),
 war_keys jsonb NOT NULL CHECK (
  pg_catalog.jsonb_typeof(war_keys)='array' AND
  pg_catalog.jsonb_array_length(war_keys)<=2000),
 previous_wars jsonb NOT NULL CHECK (
  pg_catalog.jsonb_typeof(previous_wars)='array' AND
  pg_catalog.octet_length(previous_wars::text)<=6291456),
 previous_attacks jsonb NOT NULL CHECK (
  pg_catalog.jsonb_typeof(previous_attacks)='array' AND
  pg_catalog.octet_length(previous_attacks::text)<=6291456),
 previous_missed jsonb NOT NULL CHECK (
  pg_catalog.jsonb_typeof(previous_missed)='array' AND
  pg_catalog.octet_length(previous_missed::text)<=6291456),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX cwl_portable_restore_checkpoint_clan_created
 ON public.cwl_portable_restore_checkpoints(clan_id,created_at DESC,id DESC);
ALTER TABLE public.cwl_portable_restore_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cwl_portable_restore_checkpoints
 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cwl_portable_restore_checkpoints TO authenticated;
GRANT INSERT (
 clan_id,source_clan_id,profile_revision,war_keys,
 previous_wars,previous_attacks,previous_missed
) ON public.cwl_portable_restore_checkpoints TO authenticated;
CREATE POLICY cwl_restore_checkpoint_current_owner_read
 ON public.cwl_portable_restore_checkpoints FOR SELECT TO authenticated
 USING (
  actor_user_id=(select auth.uid())
  AND EXISTS (
   SELECT 1 FROM public.cwl_clans c
   JOIN public.cwl_clan_memberships m
     ON m.clan_id=c.id AND m.user_id=(select auth.uid()) AND m.role='owner'
   WHERE c.id=cwl_portable_restore_checkpoints.clan_id
     AND c.owner_user_id=(select auth.uid())
  )
 );
CREATE POLICY cwl_restore_checkpoint_current_owner_insert
 ON public.cwl_portable_restore_checkpoints FOR INSERT TO authenticated
 WITH CHECK (
  actor_user_id=(select auth.uid())
  AND EXISTS (
   SELECT 1 FROM public.cwl_clans c
   JOIN public.cwl_clan_memberships m
     ON m.clan_id=c.id AND m.user_id=(select auth.uid()) AND m.role='owner'
   WHERE c.id=cwl_portable_restore_checkpoints.clan_id
     AND c.owner_user_id=(select auth.uid())
  )
 );
COMMENT ON TABLE public.cwl_portable_restore_checkpoints IS
 'Owner-only append-only operational before-state for an additive war-facts import; no automatic revert and not a full Cloud-App backup. No UPDATE or DELETE grants.';
