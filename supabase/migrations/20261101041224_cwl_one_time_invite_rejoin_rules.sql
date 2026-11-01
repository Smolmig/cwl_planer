create or replace function private.cwl_accept_named_invite(p_code text,p_name text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_link public.cwl_clan_invites%rowtype;v_name text:=btrim(p_name);
begin
 if v_user is null then raise exception 'Login required' using errcode='42501';end if;
 if p_code is null or p_code !~ '^[a-zA-Z0-9_-]{12}$' then raise exception 'Invalid invitation' using errcode='22023';end if;
 if v_name is null or char_length(v_name) not between 1 and 60 or v_name ~ '[[:cntrl:]]' then raise exception 'Ingame name required' using errcode='22023';end if;
 select * into v_link from public.cwl_clan_invites where
 short_code_hash=encode(pg_catalog.sha256(convert_to(p_code,'UTF8')),'hex')
 and reusable=false and used_at is null and expires_at>now() for update;
 if not found then raise exception 'Invitation expired or revoked' using errcode='22023';end if;
 if exists(select 1 from public.cwl_clan_memberships where clan_id=v_link.clan_id and user_id=v_user)
 then raise exception 'You already have access' using errcode='22023';end if;
 perform private.cwl_check_invitation_rejoin(v_link.clan_id,v_user,v_link.created_at);
 insert into public.cwl_clan_memberships(clan_id,user_id,role,display_name)
 values(v_link.clan_id,v_user,v_link.role,v_name);
 update public.cwl_clan_invites set used_at=now(),used_by=v_user where id=v_link.id;
 return v_link.clan_id;
end;
$$;
