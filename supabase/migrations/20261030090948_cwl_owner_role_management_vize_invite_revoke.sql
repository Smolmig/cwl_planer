-- This migration is already applied to the connected Supabase project.
grant update (role) on public.cwl_clan_memberships to authenticated;
create policy cwl_invites_editor_revoke_own on public.cwl_clan_invites
 for delete to authenticated
 using (
   created_by=(select auth.uid())
   and exists(select 1 from public.cwl_clan_memberships m
     where m.clan_id=cwl_clan_invites.clan_id
       and m.user_id=(select auth.uid()) and m.role='editor')
 );
