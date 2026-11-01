-- Keep privilege elevation in a non-exposed schema, using only the random
-- invite token as a capability. Public RPC remains SECURITY INVOKER.
create function private.cwl_preview_invite(p_code text)
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
   and i.used_at is null and (i.expires_at is null or i.expires_at>now())
   and i.role in ('viewer','editor')
 limit 1;
end;
$$;
-- All other private functions have EXECUTE revoked from anon.
grant usage on schema private to anon;
revoke all on function private.cwl_preview_invite(text) from public,anon,authenticated;
grant execute on function private.cwl_preview_invite(text) to anon,authenticated;
create or replace function public.cwl_preview_invite(p_code text)
returns table(planner_name text, invited_role text, valid_until timestamptz)
language sql security invoker set search_path = ''
as $$ select * from private.cwl_preview_invite(p_code) $$;
revoke all on function public.cwl_preview_invite(text) from public;
grant execute on function public.cwl_preview_invite(text) to anon,authenticated;
