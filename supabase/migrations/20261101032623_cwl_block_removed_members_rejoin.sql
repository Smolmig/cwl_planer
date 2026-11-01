-- A removed user cannot rejoin while public reusable links remain active.
create table public.cwl_access_blocks (
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 blocked_by uuid references auth.users(id) on delete set null,
 blocked_role text not null check (blocked_role in ('editor','viewer')),
 display_name text,
 blocked_at timestamptz not null default now(),
 primary key (clan_id,user_id)
);
alter table public.cwl_access_blocks enable row level security;
create policy cwl_access_blocks_leaders_read on public.cwl_access_blocks
 for select to authenticated using (private.cwl_can_edit(clan_id));
revoke all on public.cwl_access_blocks from anon,authenticated;
grant select on public.cwl_access_blocks to authenticated;

create function private.cwl_prevent_blocked_membership()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if exists(select 1 from public.cwl_access_blocks b
    where b.clan_id=new.clan_id and b.user_id=new.user_id)
 then raise exception 'Access has been blocked by clan leadership' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function private.cwl_prevent_blocked_membership() from public;
create trigger cwl_blocked_membership_guard before insert
 on public.cwl_clan_memberships for each row
 execute function private.cwl_prevent_blocked_membership();

create function private.cwl_kick_clan_member(p_clan uuid,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_actor_role text;v_target public.cwl_clan_memberships%rowtype;
begin
 if v_actor is null or v_actor=p_user then raise exception 'Not allowed' using errcode='42501'; end if;
 select role into v_actor_role from public.cwl_clan_memberships
  where clan_id=p_clan and user_id=v_actor;
 if v_actor_role not in ('owner','editor') then raise exception 'Only leaders may remove' using errcode='42501'; end if;
 select * into v_target from public.cwl_clan_memberships
  where clan_id=p_clan and user_id=p_user for update;
 if not found or v_target.role='owner'
    or (v_actor_role='editor' and v_target.role<>'viewer') then
  raise exception 'Cannot remove this clan member' using errcode='42501'; end if;
 insert into public.cwl_access_blocks(clan_id,user_id,blocked_by,blocked_role,display_name)
 values(p_clan,p_user,v_actor,v_target.role,v_target.display_name)
 on conflict (clan_id,user_id) do update
 set blocked_by=excluded.blocked_by, blocked_role=excluded.blocked_role,
 display_name=excluded.display_name,blocked_at=now();
 delete from public.cwl_clan_memberships
  where clan_id=p_clan and user_id=p_user;
end; $$;
revoke all on function private.cwl_kick_clan_member(uuid,uuid) from public,anon;
grant execute on function private.cwl_kick_clan_member(uuid,uuid) to authenticated;
create function public.cwl_remove_clan_member(p_clan uuid,p_user uuid)
returns void language sql security invoker set search_path=''
as $$ select private.cwl_kick_clan_member(p_clan,p_user) $$;
revoke all on function public.cwl_remove_clan_member(uuid,uuid) from public,anon;
grant execute on function public.cwl_remove_clan_member(uuid,uuid) to authenticated;

create function private.cwl_unblock_clan_member(p_clan uuid,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_actor_role text;v_block public.cwl_access_blocks%rowtype;
begin
 if v_actor is null then raise exception 'Login required' using errcode='42501';end if;
 select role into v_actor_role from public.cwl_clan_memberships
  where clan_id=p_clan and user_id=v_actor;
 select * into v_block from public.cwl_access_blocks
  where clan_id=p_clan and user_id=p_user for update;
 if not found then raise exception 'Access block not found' using errcode='22023';end if;
 if v_actor_role<>'owner' and not (
   v_actor_role='editor' and v_block.blocked_by=v_actor and v_block.blocked_role='viewer'
 ) then raise exception 'Cannot unblock this member' using errcode='42501'; end if;
 delete from public.cwl_access_blocks where clan_id=p_clan and user_id=p_user;
end; $$;
revoke all on function private.cwl_unblock_clan_member(uuid,uuid) from public,anon;
grant execute on function private.cwl_unblock_clan_member(uuid,uuid) to authenticated;
create function public.cwl_unblock_clan_member(p_clan uuid,p_user uuid)
returns void language sql security invoker set search_path=''
as $$ select private.cwl_unblock_clan_member(p_clan,p_user) $$;
revoke all on function public.cwl_unblock_clan_member(uuid,uuid) from public,anon;
grant execute on function public.cwl_unblock_clan_member(uuid,uuid) to authenticated;

