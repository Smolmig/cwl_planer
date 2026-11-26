-- Durable clan-private member metadata. Reuses the existing Discord marks.
create table public.cwl_activity_account_links (
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 clan_tag text not null check(clan_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 player_tag text not null check(player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 primary_tag text not null check(primary_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 updated_at timestamptz not null default now(),
 primary key(clan_id,clan_tag,player_tag),
 check(player_tag<>primary_tag)
);
alter table public.cwl_activity_account_links enable row level security;
revoke all on public.cwl_activity_account_links from public,anon,authenticated;
grant select on public.cwl_activity_account_links to authenticated;
create policy activity_links_owner_read on public.cwl_activity_account_links for select to authenticated using(private.cwl_is_owner(clan_id));

create function private.cwl_activity_member_manage(p_clan uuid,p_action text,p_player text default null,
 p_discord boolean default null,p_primary text default null,p_expected_primary text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare actor uuid:=auth.uid(); own text; old_primary text;
begin
 select clash_tag into own from public.cwl_clans where id=p_clan and owner_user_id=actor for share;
 if actor is null or not found or coalesce(own,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' then
  raise exception 'activity_owner_only' using errcode='42501';end if;
 if p_action is null or p_action not in ('list','discord','link') then raise exception 'invalid_member_action';end if;
 if p_action<>'list' then
  if coalesce(p_player,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' or not exists(
   select 1 from public.cwl_clan_member_tenure where clan_id=p_clan and source_clash_tag=own and player_tag=p_player)
   then raise exception 'invalid_player';end if;
  if p_action='discord' then
   perform private.cwl_activity_manage(p_clan,'discord',p_player=>p_player,p_discord=>p_discord);
  else
   perform pg_advisory_xact_lock(hashtextextended('activity-links:'||p_clan::text||':'||own,0));
   select primary_tag into old_primary from public.cwl_activity_account_links where clan_id=p_clan and clan_tag=own and player_tag=p_player;
   if old_primary is distinct from p_expected_primary then raise exception 'activity_link_revision_conflict' using errcode='40001';end if;
   if p_primary is null then
    delete from public.cwl_activity_account_links where clan_id=p_clan and clan_tag=own and player_tag=p_player;
   else
    if p_primary=p_player or p_primary !~ '^#[0289PYLQGRJCUV]{3,15}$' or not exists(
      select 1 from public.cwl_clan_member_tenure where clan_id=p_clan and source_clash_tag=own and player_tag=p_primary and is_present)
     then raise exception 'invalid_primary';end if;
    if exists(select 1 from public.cwl_activity_account_links where clan_id=p_clan and clan_tag=own and
      (player_tag=p_primary or primary_tag=p_player)) then raise exception 'activity_link_chain_not_allowed';end if;
    insert into public.cwl_activity_account_links(clan_id,clan_tag,player_tag,primary_tag) values(p_clan,own,p_player,p_primary)
    on conflict(clan_id,clan_tag,player_tag) do update set primary_tag=excluded.primary_tag,updated_at=now();
   end if;
  end if;
 end if;
 return (
 with observed as (
  select player_tag as tag,is_present from public.cwl_clan_member_tenure where clan_id=p_clan and source_clash_tag=own
 ), relevant as (
  select tag from observed where is_present
  union select player_tag from public.cwl_activity_member_marks where clan_id=p_clan and clan_tag=own
  union select player_tag from public.cwl_activity_account_links where clan_id=p_clan and clan_tag=own
  union select primary_tag from public.cwl_activity_account_links where clan_id=p_clan and clan_tag=own
 ), names as (
  select distinct on (m->>'playerTag') m->>'playerTag' as tag,left(m->>'name',80) as name
  from public.cwl_cloud_profiles p cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.profile_json->'members')='array' then p.profile_json->'members' else '[]'::jsonb end) m
  where p.clan_id=p_clan and m->>'playerTag' is not null order by m->>'playerTag',m->>'name'
 )
 select coalesce(jsonb_agg(jsonb_build_object('tag',r.tag,'name',coalesce(n.name,r.tag),'present',coalesce(o.is_present,false),
 'discord',d.discord,'primaryTag',l.primary_tag) order by coalesce(o.is_present,false) desc,coalesce(n.name,r.tag),r.tag),'[]'::jsonb)
 from relevant r left join observed o using(tag) left join names n using(tag)
 left join public.cwl_activity_member_marks d on d.clan_id=p_clan and d.clan_tag=own and d.player_tag=r.tag
 left join public.cwl_activity_account_links l on l.clan_id=p_clan and l.clan_tag=own and l.player_tag=r.tag
 );
end$$;
create function public.cwl_activity_member_manage(p_clan uuid,p_action text,p_player text default null,
 p_discord boolean default null,p_primary text default null,p_expected_primary text default null)
returns jsonb language sql security invoker set search_path to '' as $$
 select private.cwl_activity_member_manage(p_clan,p_action,p_player,p_discord,p_primary,p_expected_primary)
$$;
revoke all on function private.cwl_activity_member_manage(uuid,text,text,boolean,text,text) from public,anon,authenticated;
revoke all on function public.cwl_activity_member_manage(uuid,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function private.cwl_activity_member_manage(uuid,text,text,boolean,text,text) to authenticated;
grant execute on function public.cwl_activity_member_manage(uuid,text,text,boolean,text,text) to authenticated;
