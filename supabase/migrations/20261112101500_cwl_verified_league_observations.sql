-- #227 / phase 1: additive, service-only observation of an actual official
-- six/eight-clan CWL group. No plan reset, profile mutation or final-war claim.
-- Apply migration BEFORE deploying the updated scheduled collector.
create table public.cwl_verified_league_observations (
  clan_id uuid not null references public.cwl_clans(id) on delete cascade,
  season text not null check (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  clan_tag text not null check (clan_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
  group_tags jsonb not null check (
    jsonb_typeof(group_tags)='array'
    and jsonb_array_length(group_tags) in (6,8)),
  war_count smallint not null check (war_count in (5,7)),
  rounds_count smallint not null check (rounds_count=0 or rounds_count=war_count),
  group_state text not null check (group_state in ('preparation','inWar','ended')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (clan_id,season),
  check (jsonb_array_length(group_tags)=war_count+1),
  check (rounds_count<>0 or group_state='preparation')
);
-- An independent App clan is always an independent tenant even if another
-- tenant has linked the very same Supercell clan tag.
create function private.cwl_preserve_verified_league_observation()
returns trigger language plpgsql set search_path=''
as $guard$
declare v_total integer;v_unique integer;v_valid boolean;
begin
  if not exists (
    select 1 from public.cwl_clans c where c.id=new.clan_id
      and upper(c.clash_tag)=new.clan_tag
  ) then
    raise exception 'linked_clan_tag_mismatch' using errcode='23514';
  end if;
  if jsonb_typeof(new.group_tags) is distinct from 'array' then
    raise exception 'invalid_verified_clan_group' using errcode='23514';
  end if;
  select count(*),count(distinct t),coalesce(bool_and(t ~ '^#[0289PYLQGRJCUV]{3,15}$'),false)
    into v_total,v_unique,v_valid
    from jsonb_array_elements_text(new.group_tags) as members(t);
  if not v_valid or v_total<>v_unique or v_total not in (6,8) or
     not (new.group_tags ? new.clan_tag) then
    raise exception 'invalid_verified_clan_group' using errcode='23514';
  end if;
  if tg_op='UPDATE' then
    if new.clan_id<>old.clan_id or new.season<>old.season or
       new.clan_tag<>old.clan_tag or new.group_tags is distinct from old.group_tags or
       new.war_count<>old.war_count then
      raise exception 'verified_cwl_group_identity_conflict' using errcode='23514';
    end if;
    new.first_seen_at:=old.first_seen_at;
    new.rounds_count:=greatest(old.rounds_count,new.rounds_count);
    if (new.group_state='preparation' and old.group_state in ('inWar','ended'))
       or (new.group_state='inWar' and old.group_state='ended') then
      new.group_state:=old.group_state;
    end if;
  else
    new.first_seen_at:=now();
  end if;
  new.last_seen_at:=now();
  return new;
end
$guard$;
revoke all on function private.cwl_preserve_verified_league_observation()
  from PUBLIC,anon,authenticated;
create trigger cwl_verified_league_observation_guard
before insert or update on public.cwl_verified_league_observations
for each row execute function private.cwl_preserve_verified_league_observation();

alter table public.cwl_verified_league_observations enable row level security;
revoke all on public.cwl_verified_league_observations from PUBLIC,anon,authenticated;
grant select,insert,update on public.cwl_verified_league_observations to service_role;
-- No browser RLS policy, no DELETE capability, no public RPC. The scheduled
-- collector's existing dual verified identities are the only planned writer.
-- A status of "ended" is not proof of a completed last war (6/7 remains unknown).
