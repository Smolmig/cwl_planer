create or replace function private.cwl_auto_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_last timestamptz;v_rev bigint;
begin
 if old.profile_json is not distinct from new.profile_json then return new;end if;
 select created_at,revision into v_last,v_rev
 from public.cwl_profile_snapshots where clan_id=old.clan_id
 order by created_at desc,id desc limit 1;
 if v_last is null or v_last<now()-interval '2 hours' or old.revision-v_rev>=30 then
  insert into public.cwl_profile_snapshots(clan_id,revision,profile_json)
  values(old.clan_id,old.revision,old.profile_json)
  on conflict(clan_id,revision) do nothing;
  delete from public.cwl_profile_snapshots where id in (
   select id from public.cwl_profile_snapshots where clan_id=old.clan_id order by created_at desc,id desc offset 5
  );
 end if;
 return new;
end;
$$;
