-- Only invitation recipients holding a complete 12/24-character random token
-- can see the receiving planner name and invited role before signing in.
-- This function is intentionally read-only; no member or invitation rows are exposed.
create function public.cwl_preview_invite(p_code text)
returns table(planner_name text, invited_role text, valid_until timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
 if p_code is null or p_code !~ '^(?:[A-Za-z0-9_-]{12}|[A-Za-z0-9_-]{24})$' then
  return;
 end if;
 return query
 select c.name::text, i.role::text, i.expires_at
 from public.cwl_clan_invites i
 join public.cwl_clans c on c.id=i.clan_id
 where i.short_code_hash=encode(pg_catalog.sha256(pg_catalog.convert_to(p_code,'UTF8')),'hex')
   and i.used_at is null
   and (i.expires_at is null or i.expires_at>now())
   and i.role in ('viewer','editor')
 limit 1;
end;
$$;
revoke all on function public.cwl_preview_invite(text) from public;
grant execute on function public.cwl_preview_invite(text) to anon,authenticated;
