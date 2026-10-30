-- Already applied to connected Supabase. Authenticated invoker, checked by clan presence RLS.
create function public.cwl_touch_presence(p_clan uuid)
returns void language sql security invoker set search_path = ''
as $$
 insert into public.cwl_clan_presence(clan_id,user_id)
 values(p_clan,(select auth.uid()))
 on conflict (clan_id,user_id) do update set seen_at=now();
$$;
revoke all on function public.cwl_touch_presence(uuid) from public,anon;
grant execute on function public.cwl_touch_presence(uuid) to authenticated;
