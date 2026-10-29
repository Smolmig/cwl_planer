-- Applied to Supabase on 2026-10-29. Already live; do not manually re-apply.
-- The owner must be allowed to SELECT the row immediately on INSERT ... RETURNING,
-- before the AFTER INSERT membership bootstrap is visible to the RETURNING RLS check.
-- Non-owners can still only see clans through an explicit membership.
drop policy if exists cwl_clans_read on public.cwl_clans;
create policy cwl_clans_read on public.cwl_clans
  for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or private.cwl_is_member(id)
  );
