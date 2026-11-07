-- Disposable PostgreSQL 17 CI schema. Synthetic rows only: NOT a production migration.
begin;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.cwl_clans(
  id uuid primary key,
  clash_tag text not null
);
create table public.cwl_stat_wars(
  clan_id uuid not null references public.cwl_clans(id),
  war_key text not null,
  war_type text not null,
  source text not null,
  finalized boolean not null default false,
  missed_log_complete boolean not null default false,
  updated_at timestamptz not null,
  started_at timestamptz not null,
  opponent_tag text,
  roster_tags jsonb,
  team_size smallint not null,
  primary key(clan_id,war_key)
);
create table public.cwl_stat_attacks(
  clan_id uuid not null,
  war_key text not null,
  attacker_tag text not null,
  attack_order smallint not null,
  defender_tag text,
  attacker_th smallint,
  defender_th smallint,
  stars smallint not null,
  destruction smallint not null,
  primary key(clan_id,war_key,attacker_tag,attack_order),
  foreign key(clan_id,war_key) references public.cwl_stat_wars(clan_id,war_key)
);
create table public.cwl_stat_missed(
  clan_id uuid not null,
  war_key text not null,
  player_tag text not null,
  player_name text not null,
  missed_count smallint not null check(missed_count=1),
  primary key(clan_id,war_key,player_tag),
  foreign key(clan_id,war_key) references public.cwl_stat_wars(clan_id,war_key)
);
alter table public.cwl_clans enable row level security;
alter table public.cwl_stat_wars enable row level security;
alter table public.cwl_stat_attacks enable row level security;
alter table public.cwl_stat_missed enable row level security;
grant usage on schema public to service_role,anon,authenticated;
grant select,insert,update,delete on all tables in schema public to service_role;

insert into public.cwl_clans(id,clash_tag) values
  ('11111111-1111-4111-8111-111111111111','#2PYL'),
  ('22222222-2222-4222-8222-222222222222','#2PYL');
insert into public.cwl_stat_wars(
  clan_id,war_key,war_type,source,finalized,missed_log_complete,
  updated_at,started_at,opponent_tag,roster_tags,team_size
) values
  ('11111111-1111-4111-8111-111111111111','cwl:#2QGL','cwl','api',true,false,
   '2026-11-07T20:00:00Z','2026-11-05T19:00:00Z','#QPYL',
   '["#2PYL","#2PQL","#2PRL"]'::jsonb,3),
  ('22222222-2222-4222-8222-222222222222','cwl:#2QGL','cwl','api',true,false,
   '2026-11-07T20:00:00Z','2026-11-05T19:00:00Z','#QPYL',
   '["#2PYL","#2PQL","#2PRL"]'::jsonb,3);
insert into public.cwl_stat_attacks(
 clan_id,war_key,attacker_tag,attack_order,defender_tag,
 attacker_th,defender_th,stars,destruction
) values
 ('11111111-1111-4111-8111-111111111111','cwl:#2QGL','#2PQL',1,'#QPYL',18,18,3,100),
 ('11111111-1111-4111-8111-111111111111','cwl:#2QGL','#2PYL',1,'#QPRL',18,18,3,100),
 ('22222222-2222-4222-8222-222222222222','cwl:#2QGL','#2PQL',1,'#QPYL',18,18,3,100);

commit;

