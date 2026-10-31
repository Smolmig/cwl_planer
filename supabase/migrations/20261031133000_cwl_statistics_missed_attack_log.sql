-- Add explicit missed-attack evidence from historical ClashPerk logs.
-- The boolean marks coverage of a complete per-war Missed Attacks export.
alter table public.cwl_stat_wars
  add column if not exists missed_log_complete boolean not null default false;

create table if not exists public.cwl_stat_missed (
  clan_id uuid not null,
  war_key text not null,
  player_tag text not null check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
  player_name text not null default '',
  missed_count smallint not null check (missed_count between 1 and 2),
  created_at timestamptz not null default now(),
  primary key(clan_id,war_key,player_tag),
  foreign key (clan_id,war_key) references public.cwl_stat_wars(clan_id,war_key) on delete cascade
);
create index if not exists cwl_stat_missed_player on public.cwl_stat_missed(clan_id,player_tag);
alter table public.cwl_stat_missed enable row level security;
create policy stat_missed_read on public.cwl_stat_missed for select to authenticated
  using (private.cwl_is_member(clan_id));
create policy stat_missed_create on public.cwl_stat_missed for insert to authenticated
  with check (private.cwl_can_edit(clan_id));
create policy stat_missed_update on public.cwl_stat_missed for update to authenticated
  using (private.cwl_can_edit(clan_id)) with check(private.cwl_can_edit(clan_id));
revoke all on public.cwl_stat_missed from public,anon;
grant select,insert,update on public.cwl_stat_missed to authenticated;
