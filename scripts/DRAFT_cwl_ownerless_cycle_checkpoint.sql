-- #227 / Phase 3 / DRAFT: non-destructive transactional archive checkpoint.
-- NOT A PRODUCTION MIGRATION. Install ONLY in synthetic PostgreSQL CI.
--
-- The ownerless plan reset is NOT implemented by this RPC. It preserves the
-- full original JSON + review state before any future writer can reset a day.
-- No owner impersonation, disabled triggers, auth claims or browser privileges.
--
-- A service_role invocation may use this after the signed collector's
-- verified-season observation from phase 1 and the preflight from phase 2.
create table public.cwl_ownerless_cycle_checkpoints (
  clan_id uuid not null references public.cwl_clans(id) on delete cascade,
  source_cycle_id uuid not null,
  source_revision bigint not null check (source_revision >= 1),
  source_season text not null check (
    source_season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  target_season text not null check (
    target_season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    and target_season>source_season),
  -- Includes every member, day goal, lock, live war, archived player,
  -- historic archive and optional field. No lossy reconstruction.
  source_profile jsonb not null check (
    jsonb_typeof(source_profile)='object'
    and octet_length(source_profile::text) <= 5242880),
  source_review_state jsonb not null check (
    jsonb_typeof(source_review_state)='object'),
  source_profile_sha256 text not null check (
    source_profile_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key(clan_id,source_cycle_id,source_revision),
  -- A stale owner may legitimately produce a NEW revision checkpoint
  -- before the real rollover. Never overwrite an earlier checkpoint.
  check (octet_length(source_review_state::text) <= 32768)
);
create index cwl_ownerless_checkpoints_by_clan
  on public.cwl_ownerless_cycle_checkpoints
  (clan_id,created_at desc);

alter table public.cwl_ownerless_cycle_checkpoints enable row level security;
revoke all on public.cwl_ownerless_cycle_checkpoints
  from PUBLIC,anon,authenticated,service_role;
grant select,insert on public.cwl_ownerless_cycle_checkpoints
  to service_role;
-- Intentionally no UPDATE / DELETE grant even for the service_role.
-- A user-authorized deletion of the entire clan may cascade to its private
-- historical data, as for the other per-clan tables.

create or replace function public.cwl_ownerless_cycle_checkpoint(
  p_clan uuid,
  p_expected_cycle uuid,
  p_expected_revision bigint,
  p_expected_target_season text
) returns jsonb
language plpgsql volatile security invoker set search_path=''
as $fn$
declare
  v_state public.cwl_plan_review_state%rowtype;
  v_profile public.cwl_cloud_profiles%rowtype;
  v_preflight jsonb;
  v_checksum text;
  v_existing public.cwl_ownerless_cycle_checkpoints%rowtype;
  v_inserted boolean := false;
begin
  -- No generic caller role, NULL-CAS nor client-supplied snapshot.
  if p_clan is null or p_expected_cycle is null or
     p_expected_revision is null or p_expected_revision < 1 or
     p_expected_target_season is null or
     p_expected_target_season !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  then
    return jsonb_build_object('saved',false,'reason','invalid_expectations');
  end if;
  -- Lock the review cycle BEFORE the profile. All concurrent server runs
  -- obey the same order. Clients already use the review-cycle CAS mechanism.
  -- A collision/deadlock with older client code must roll back, NEVER commit
  -- a half-snapshot or transition.
  select * into v_state from public.cwl_plan_review_state
    where clan_id=p_clan for update;
  if not found or v_state.cycle_id is distinct from p_expected_cycle then
    return jsonb_build_object('saved',false,'reason','stale_cycle');
  end if;
  select * into v_profile from public.cwl_cloud_profiles
    where clan_id=p_clan for update;
  if not found or v_profile.revision is distinct from p_expected_revision then
    return jsonb_build_object('saved',false,'reason','stale_profile_revision');
  end if;

  -- The preflight runs AGAIN inside the same transaction while the review
  -- state and profile rows are locked. A prior read result is never trusted.
  v_preflight:=public.cwl_ownerless_cycle_preflight(p_clan);
  if v_preflight->>'candidate' is distinct from 'true' then
    return jsonb_build_object('saved',false,
      'reason',coalesce(v_preflight->>'reason','preflight_rejected'));
  end if;
  if (v_preflight->>'source_cycle_id')::uuid
       is distinct from p_expected_cycle or
     (v_preflight->>'source_revision')::bigint
       is distinct from p_expected_revision or
     v_preflight->>'target_season'
       is distinct from p_expected_target_season or
     v_preflight->>'source_season' is distinct from v_state.season then
    return jsonb_build_object('saved',false,'reason','stale_preflight');
  end if;

  -- sha256 is built into PostgreSQL 17; do not rely on pgcrypto extensions.
  v_checksum:=encode(pg_catalog.sha256(
      pg_catalog.convert_to(v_profile.profile_json::text,'UTF8')),'hex');

  -- A unique (clan,cycle,revision) is immutable. Repeating the same signed
  -- call is idempotent. Distinct contents with same key fail closed.
  insert into public.cwl_ownerless_cycle_checkpoints
    (clan_id,source_cycle_id,source_revision,source_season,target_season,
     source_profile,source_review_state,source_profile_sha256)
  values (
    p_clan,v_state.cycle_id,v_profile.revision,v_state.season,
    p_expected_target_season,v_profile.profile_json,to_jsonb(v_state),
    v_checksum)
  on conflict (clan_id,source_cycle_id,source_revision) do nothing
  returning true into v_inserted;

  select * into v_existing
  from public.cwl_ownerless_cycle_checkpoints
  where clan_id=p_clan and source_cycle_id=v_state.cycle_id
    and source_revision=v_profile.revision;
  if not found or
     v_existing.source_season is distinct from v_state.season or
     v_existing.target_season is distinct from p_expected_target_season or
     v_existing.source_profile_sha256 is distinct from v_checksum or
     v_existing.source_profile is distinct from v_profile.profile_json or
     v_existing.source_review_state is distinct from to_jsonb(v_state) then
    raise exception 'checkpoint_integrity_conflict' using errcode='23514';
  end if;
  -- Strictly no UPDATE to profile, review cycle, suggestions, locks, or
  -- regular archives. "saved" confirms checkpoint ONLY, not a new CWL plan.
  return jsonb_build_object(
    'saved',true,'reason','immutable_checkpoint_saved',
    'created',coalesce(v_inserted,false),
    'source_cycle_id',v_state.cycle_id,
    'source_revision',v_profile.revision,
    'source_season',v_state.season,
    'target_season',p_expected_target_season,
    'source_profile_sha256',v_checksum
  );
end;
$fn$;
revoke all on function public.cwl_ownerless_cycle_checkpoint(uuid,uuid,bigint,text)
  from PUBLIC,anon,authenticated;
grant execute on function public.cwl_ownerless_cycle_checkpoint(uuid,uuid,bigint,text)
  to service_role;
