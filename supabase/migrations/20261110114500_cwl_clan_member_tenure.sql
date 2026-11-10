-- #183 phase 2a. Conservative, clan-isolated observed membership duration.
-- No historical backfill; Clash does not provide historical joins or logins.
-- Service-only observation; only owners may read. No browser writes.
create table public.cwl_clan_member_tenure (
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 player_tag text not null check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 first_observed_at timestamptz not null,
 last_present_at timestamptz not null,
 last_observed_at timestamptz not null,
 state_changed_at timestamptz not null,
 is_present boolean not null,
 confirmed_seconds bigint not null default 0 check (confirmed_seconds >= 0),
 observed_visits integer not null default 1 check (observed_visits >= 1),
 primary key (clan_id,player_tag),
 check (first_observed_at <= last_observed_at),
 check (last_present_at <= last_observed_at)
);
create index cwl_clan_member_tenure_clan_present on public.cwl_clan_member_tenure(clan_id,is_present);
alter table public.cwl_clan_member_tenure enable row level security;
revoke all on public.cwl_clan_member_tenure from PUBLIC, anon, authenticated;
grant select on public.cwl_clan_member_tenure to authenticated;
create policy cwl_tenure_owner_read on public.cwl_clan_member_tenure
 for select to authenticated using (private.cwl_is_owner(clan_id));

-- Important: SECURITY INVOKER + EXECUTE granted exclusively to service_role.
-- This prevents any browser, including an owner, fabricating observed days.
-- Atomic full-roster snapshot per tenant; a missing/partial roster NEVER calls this.
create or replace function public.cwl_observe_clan_roster(p_clan uuid,p_tags text[])
returns integer language plpgsql security invoker set search_path=''
as $$
declare
 v_now timestamptz := clock_timestamp();
 v_total integer := coalesce(array_length(p_tags,1),0);
begin
 if current_user <> 'service_role' then
  raise exception 'collector only' using errcode='42501';
 end if;
 if p_clan is null or not exists
    (select 1 from public.cwl_clans c where c.id=p_clan and c.clash_tag is not null) then
  raise exception 'invalid clan';
 end if;
 if v_total < 1 or v_total > 50
   or exists (select 1 from unnest(p_tags) as v(tag)
              where v.tag is null or v.tag !~ '^#[0289PYLQGRJCUV]{3,15}$')
   or (select count(distinct v.tag) from unnest(p_tags) as v(tag)) <> v_total then
  raise exception 'invalid or partial roster';
 end if;

 -- Same tenant cannot double count two overlapping authorized schedule runs.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_clan::text,0));

 -- Count ONLY intervals confirmed by two consecutive full snapshots that
 -- both contain the player, with no more than 3 h between observations.
 -- On absence the interval since the last present snapshot gets NO credit.
 -- On rejoin resume existing seconds; absence never resets the counter.
 update public.cwl_clan_member_tenure t set
  confirmed_seconds=t.confirmed_seconds+case
    when t.is_present and t.player_tag=any(p_tags)
      and v_now >= t.last_observed_at
      and v_now-t.last_observed_at <= interval '3 hours'
    then greatest(0,floor(extract(epoch from v_now-t.last_observed_at))::bigint)
    else 0 end,
  observed_visits=t.observed_visits+case
    when not t.is_present and t.player_tag=any(p_tags) then 1 else 0 end,
  is_present=t.player_tag=any(p_tags),
  last_present_at=case when t.player_tag=any(p_tags) then v_now else t.last_present_at end,
  last_observed_at=v_now,
  state_changed_at=case when t.is_present<>(t.player_tag=any(p_tags))
                        then v_now else t.state_changed_at end
 where t.clan_id=p_clan;

 insert into public.cwl_clan_member_tenure
  (clan_id,player_tag,first_observed_at,last_present_at,
   last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits)
 select p_clan,v.tag,v_now,v_now,v_now,v_now,true,0,1
 from unnest(p_tags) as v(tag)
 on conflict (clan_id,player_tag) do nothing;
 return v_total;
end;
$$;
revoke all on function public.cwl_observe_clan_roster(uuid,text[]) from PUBLIC, anon, authenticated;
grant execute on function public.cwl_observe_clan_roster(uuid,text[]) to service_role;
