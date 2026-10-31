-- Private, clan-scoped war-stat history; additive and independent of v9 planning.
-- Applied to live Supabase on 31.10.2026 under migration cwl_private_attack_history_stats.
create table if not exists public.cwl_stat_wars (
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 war_key text not null check(length(war_key) between 4 and 100),
 war_type text not null check(war_type in ('normal','cwl')),
 started_at timestamptz not null,
 team_size smallint not null check(team_size between 1 and 50),
 opponent_tag text, opponent_name text not null default '',
 source text not null default 'import' check(source in ('import','api')),
 roster_tags jsonb, finalized boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(clan_id,war_key),
 constraint cwl_stat_roster_type check(roster_tags is null or jsonb_typeof(roster_tags)='array')
);
create table if not exists public.cwl_stat_attacks (
 clan_id uuid not null,war_key text not null,
 attacker_tag text not null check(attacker_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 attack_order smallint not null check(attack_order between 0 and 200),
 attacker_name text not null default '',
 attacker_th smallint check(attacker_th between 3 and 30),
 defender_tag text, defender_name text not null default '',
 defender_th smallint check(defender_th between 3 and 30),
 stars smallint not null check(stars between 0 and 3),
 destruction smallint not null check(destruction between 0 and 100),
 created_at timestamptz not null default now(),
 primary key(clan_id,war_key,attacker_tag,attack_order),
 foreign key(clan_id,war_key) references public.cwl_stat_wars(clan_id,war_key) on delete cascade
);
create index if not exists cwl_stat_wars_recent on public.cwl_stat_wars(clan_id,started_at desc);
create index if not exists cwl_stat_attacks_players on public.cwl_stat_attacks(clan_id,attacker_tag);
alter table public.cwl_stat_wars enable row level security;
alter table public.cwl_stat_attacks enable row level security;
create policy stat_wars_read on public.cwl_stat_wars for select to authenticated using(private.cwl_is_member(clan_id));
create policy stat_wars_create on public.cwl_stat_wars for insert to authenticated with check(private.cwl_can_edit(clan_id));
create policy stat_wars_update on public.cwl_stat_wars for update to authenticated using(private.cwl_can_edit(clan_id)) with check(private.cwl_can_edit(clan_id));
create policy stat_attacks_read on public.cwl_stat_attacks for select to authenticated using(private.cwl_is_member(clan_id));
create policy stat_attacks_create on public.cwl_stat_attacks for insert to authenticated with check(private.cwl_can_edit(clan_id));
create policy stat_attacks_update on public.cwl_stat_attacks for update to authenticated using(private.cwl_can_edit(clan_id)) with check(private.cwl_can_edit(clan_id));
revoke all on public.cwl_stat_wars,public.cwl_stat_attacks from public,anon;
grant select,insert,update on public.cwl_stat_wars,public.cwl_stat_attacks to authenticated;
