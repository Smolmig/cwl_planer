-- Already applied to connected Supabase; retained for disaster recovery.
create table public.cwl_profile_snapshots (
 id bigint generated always as identity primary key,
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 revision bigint not null,
 profile_json jsonb not null,
 created_at timestamptz not null default now(),
 unique (clan_id,revision)
);
create index cwl_snapshot_recent_idx on public.cwl_profile_snapshots(clan_id,created_at desc,id desc);
alter table public.cwl_profile_snapshots enable row level security;
create policy cwl_snapshots_member_read on public.cwl_profile_snapshots for select to authenticated
 using (private.cwl_is_member(clan_id));
revoke all on public.cwl_profile_snapshots from anon,authenticated;
grant select on public.cwl_profile_snapshots to authenticated;

create function private.cwl_auto_snapshot() returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_last timestamptz;v_rev bigint;
begin
 if old.profile_json is not distinct from new.profile_json then return new;end if;
 select created_at,revision into v_last,v_rev
 from public.cwl_profile_snapshots where clan_id=old.clan_id
 order by created_at desc,id desc limit 1;
 if v_last is null or v_last<now()-interval '30 minutes' or old.revision-v_rev>=20 then
  insert into public.cwl_profile_snapshots(clan_id,revision,profile_json)
    values(old.clan_id,old.revision,old.profile_json)
    on conflict (clan_id,revision) do nothing;
  delete from public.cwl_profile_snapshots
   where id in (
    select id from public.cwl_profile_snapshots
    where clan_id=old.clan_id order by created_at desc,id desc offset 24
   );
 end if;
 return new;
end;
$$;
revoke all on function private.cwl_auto_snapshot() from public,anon,authenticated;
create trigger cwl_auto_snapshot before update of profile_json on public.cwl_cloud_profiles
for each row execute function private.cwl_auto_snapshot();

create function private.cwl_restore_profile_snapshot(p_clan uuid,p_id bigint,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path=''
as $$
declare v_current public.cwl_cloud_profiles%rowtype;
 v_backup public.cwl_profile_snapshots%rowtype;
 v_revised bigint;
begin
 if auth.uid() is null or not exists(
   select 1 from public.cwl_clan_memberships
   where clan_id=p_clan and user_id=auth.uid() and role='owner'
 ) then raise exception 'Only owners can restore a clan backup' using errcode='42501';end if;
 select * into v_current from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found then raise exception 'Cloud profile not found' using errcode='22023';end if;
 if v_current.revision<>p_expected_revision then
  raise exception 'Profile changed; please reload before restoring' using errcode='40001';end if;
 select * into v_backup from public.cwl_profile_snapshots where id=p_id and clan_id=p_clan;
 if not found then raise exception 'Backup does not belong to clan' using errcode='22023';end if;
 -- Immediate recovery point even if the timed checkpoint interval has not elapsed.
 insert into public.cwl_profile_snapshots(clan_id,revision,profile_json)
  values(p_clan,v_current.revision,v_current.profile_json)
  on conflict (clan_id,revision) do nothing;
 update public.cwl_cloud_profiles set profile_json=v_backup.profile_json
  where clan_id=p_clan returning revision into v_revised;
 return v_revised;
end;
$$;
revoke all on function private.cwl_restore_profile_snapshot(uuid,bigint,bigint) from public,anon,authenticated;
create function public.cwl_restore_profile_snapshot(p_clan uuid,p_id bigint,p_expected_revision bigint)
returns bigint language sql security invoker set search_path=''
as $$select private.cwl_restore_profile_snapshot(p_clan,p_id,p_expected_revision)$$;
revoke all on function public.cwl_restore_profile_snapshot(uuid,bigint,bigint) from public,anon;
grant execute on function public.cwl_restore_profile_snapshot(uuid,bigint,bigint) to authenticated;
