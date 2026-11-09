-- CWL #184 / Cloud v1.16.46: append-only, owner-only human decisions.
-- The table is separate from planning and statistics. It never rewrites a Missed
-- event, member participation, historical war, plan lock or Clash roster.
create table if not exists public.cwl_missed_owner_decisions (
 id bigint generated always as identity primary key,
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 season text not null check (season ~ '^[0-9]{4}-[0-9]{2}$'),
 war_key text not null check (war_key ~ '^cwl:#[0289PYLQGRJCUV]{3,15}$'),
 day smallint not null check (day between 1 and 7),
 player_tag text not null check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 decision text not null check (decision in ('excused','later','review_pause')),
 note text not null default '' check (char_length(note) <= 300),
 actor_id uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index if not exists cwl_missed_owner_decisions_clan_season_lookup
 on public.cwl_missed_owner_decisions(clan_id,season,id desc);
create index if not exists cwl_missed_owner_decisions_event_lookup
 on public.cwl_missed_owner_decisions(clan_id,war_key,player_tag,id desc);
alter table public.cwl_missed_owner_decisions enable row level security;
revoke all on public.cwl_missed_owner_decisions from public,anon,authenticated;
grant select,insert on public.cwl_missed_owner_decisions to authenticated;

-- All invited members of exactly this app clan can inspect the audit.
create policy cwl_missed_owner_decisions_clan_read
 on public.cwl_missed_owner_decisions for select to authenticated
 using (private.cwl_is_member(clan_id));

-- Only the current app owner may append a decision. Its factual target
-- must exist in *collector-verified* finished CWL/Missed tables for this tenant.
-- The current saved CWL must match the exact season and day/war tag.
-- A stale UI, another tenant's missed record or a forged/unknown log fails closed.
create policy cwl_missed_owner_decisions_owner_insert
 on public.cwl_missed_owner_decisions for insert to authenticated
 with check (
   actor_id = (select auth.uid())
   and private.cwl_is_owner(clan_id)
   and exists (
     select 1
       from public.cwl_stat_wars w
       join public.cwl_stat_missed m
         on m.clan_id=w.clan_id and m.war_key=w.war_key
      where w.clan_id=cwl_missed_owner_decisions.clan_id
        and w.war_key=cwl_missed_owner_decisions.war_key
        and w.war_type='cwl'
        and w.finalized is true
        and w.missed_log_complete is true
        and w.source='api'
        and m.player_tag=cwl_missed_owner_decisions.player_tag
        and m.missed_count > 0
   )
   and exists (
     select 1
       from public.cwl_cloud_profiles cp
       cross join lateral jsonb_array_elements(
         case
           when jsonb_typeof(cp.profile_json->'cwlLive'->'rounds')='array'
             then cp.profile_json->'cwlLive'->'rounds'
           else '[]'::jsonb
         end
       ) as r(value)
      where cp.clan_id=cwl_missed_owner_decisions.clan_id
        and cp.profile_json->'cwlLive'->>'season'=
          cwl_missed_owner_decisions.season
        and r.value->>'state'='warEnded'
        and r.value->>'day'=cwl_missed_owner_decisions.day::text
        and 'cwl:'||(r.value->>'warTag')=
          cwl_missed_owner_decisions.war_key
   )
 );
-- No UPDATE/DELETE grants or policies: historical decisions are immutable.
-- Later owner choices create new rows, preserving earlier audit history.
