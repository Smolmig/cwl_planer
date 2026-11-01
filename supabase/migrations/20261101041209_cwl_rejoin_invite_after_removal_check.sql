alter table public.cwl_access_blocks add column if not exists permanent boolean not null default false;
create or replace function private.cwl_check_invitation_rejoin(p_clan uuid,p_user uuid,p_issued_at timestamptz)
returns void language plpgsql security definer set search_path=''
as $$
declare v_row public.cwl_access_blocks%rowtype;
begin
 select * into v_row from public.cwl_access_blocks where clan_id=p_clan and user_id=p_user for update;
 if not found then return;end if;
 if v_row.permanent or p_issued_at<=v_row.blocked_at then
  raise exception 'This link cannot be used after access removal. Request a newer invitation.' using errcode='42501';
 end if;
 delete from public.cwl_access_blocks where clan_id=p_clan and user_id=p_user;
end;
$$;
revoke all on function private.cwl_check_invitation_rejoin(uuid,uuid,timestamptz) from public,anon,authenticated;
