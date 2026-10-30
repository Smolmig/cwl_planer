-- Already applied to connected Supabase; retained for disaster recovery.
create or replace function public.cwl_restore_profile_snapshot(p_clan uuid,p_id bigint,p_expected_revision bigint)
 returns bigint language sql security definer set search_path=''
 as $$ select private.cwl_restore_profile_snapshot(p_clan,p_id,p_expected_revision) $$;
revoke all on function public.cwl_restore_profile_snapshot(uuid,bigint,bigint) from public,anon;
grant execute on function public.cwl_restore_profile_snapshot(uuid,bigint,bigint) to authenticated;
