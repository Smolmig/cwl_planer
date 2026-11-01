-- Access hierarchy: owner manages all, editor manages own links and viewer memberships, viewer read-only.
create policy cwl_members_editor_remove_viewer on public.cwl_clan_memberships
 for delete to authenticated
 using (role='viewer' and user_id<>(select auth.uid()) and private.cwl_can_edit(clan_id));

-- Reusable links can be renewed, never silently consumed or upgraded by redemption.
alter table public.cwl_clan_invites drop constraint if exists invite_lifetime;
alter table public.cwl_clan_invites add constraint invite_lifetime check (
 (reusable=true and used_at is null and (expires_at is null or expires_at>created_at))
 or (reusable=false and expires_at is not null and
 expires_at>created_at and expires_at<=created_at+interval '30 days')
);

create function private.cwl_edit_reusable_invite(p_id uuid,p_role text,p_duration text,p_label text)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid();
 v_invite public.cwl_clan_invites%rowtype;
 v_owner boolean;
 v_editor boolean;
 v_label text:=nullif(btrim(p_label),'');
 v_expiry timestamptz;
begin
 if v_user is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_role not in ('editor','viewer') or p_duration not in ('24h','7d','never') then
  raise exception 'Invalid invite settings' using errcode='22023'; end if;
 if v_label is not null and (length(v_label)>60 or v_label ~ '[[:cntrl:]]') then
  raise exception 'Invalid invite label' using errcode='22023'; end if;
 select * into v_invite from public.cwl_clan_invites
  where id=p_id and reusable=true and used_at is null for update;
 if not found then raise exception 'Invite missing or revoked' using errcode='22023'; end if;
 select exists(select 1 from public.cwl_clan_memberships m
  where m.clan_id=v_invite.clan_id and m.user_id=v_user and m.role='owner')
  into v_owner;
 select exists(select 1 from public.cwl_clan_memberships m
  where m.clan_id=v_invite.clan_id and m.user_id=v_user and m.role='editor'
   and v_invite.created_by=v_user) into v_editor;
 if not v_owner and not v_editor then
  raise exception 'Cannot change this invite' using errcode='42501'; end if;
 if v_invite.expires_at is not null and v_invite.expires_at<=now() then
  raise exception 'Expired invite: create a new link' using errcode='22023'; end if;
 if p_duration='24h' then v_expiry:=now()+interval '24 hours';
 elsif p_duration='7d' then v_expiry:=now()+interval '7 days';
 else v_expiry:=null; end if;
 update public.cwl_clan_invites set role=p_role,expires_at=v_expiry,link_label=v_label
  where id=p_id;
end;
$$;
revoke all on function private.cwl_edit_reusable_invite(uuid,text,text,text) from public,anon;
grant execute on function private.cwl_edit_reusable_invite(uuid,text,text,text) to authenticated;
create function public.cwl_update_reusable_invite(
 p_id uuid,p_role text,p_duration text,p_label text default null
) returns void language sql security invoker set search_path=''
as $$ select private.cwl_edit_reusable_invite(p_id,p_role,p_duration,p_label) $$;
revoke all on function public.cwl_update_reusable_invite(uuid,text,text,text) from public,anon;
grant execute on function public.cwl_update_reusable_invite(uuid,text,text,text) to authenticated;

