-- #227 Phase 4: disposable PostgreSQL-17 fixture mirroring the EXISTING
-- published Supabase guard, revision and audit trigger contracts.
-- NEVER run in live Supabase. Applied AFTER phase-1/2/3 SQL in CI.
create schema if not exists auth;
create function auth.uid() returns uuid
language sql stable set search_path='' as $fn$
 select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid;
$fn$;
grant usage on schema auth to authenticated,service_role;
grant execute on function auth.uid() to authenticated,service_role;

alter table public.cwl_cloud_profiles
  add column updated_by uuid not null default 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  add column updated_at timestamptz not null default now(),
  add column created_at timestamptz not null default now(),
  add column data_version smallint not null default 9;
alter table public.cwl_plan_review_state
  add column locked boolean not null default true,
  add column locked_by uuid,
  add column locked_at timestamptz,
  add column updated_at timestamptz not null default now();

create table public.cwl_plan_suggestions (
 id uuid primary key default gen_random_uuid(),
 clan_id uuid not null,
 cycle_id uuid not null,
 author_id uuid not null default 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 status text not null default 'pending',
 decided_at timestamptz,
 decided_by uuid
);
grant select,update on public.cwl_plan_suggestions to service_role;
insert into public.cwl_plan_suggestions(clan_id,cycle_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');

-- Same trigger definitions / assumptions as deployed Cloud v1.18.1:
-- a sessionless service UPDATE must be REJECTED by both the original
-- plan guard and original revision trigger until phase 4 adds the
-- strictly checkpoint-verified system branch.
create function private.cwl_plan_can_write(p_clan uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$select false$fn$;

create function private.cwl_plan_write_guard()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  perform 1 from public.cwl_plan_review_state
    where clan_id=new.clan_id for share;
  if not private.cwl_plan_can_write(new.clan_id) then
    raise exception 'plan_locked' using errcode='42501';
  end if;
  return new;
end $fn$;
create trigger cwl_plan_guard before insert or update of profile_json
 on public.cwl_cloud_profiles
 for each row execute function private.cwl_plan_write_guard();

create function private.cwl_bump_profile_revision()
returns trigger language plpgsql set search_path=''
as $fn$
begin
  new.revision:=old.revision+1;
  new.updated_at:=now();
  new.updated_by:=auth.uid();
  return new;
end $fn$;
create trigger cwl_profile_revision before update on public.cwl_cloud_profiles
for each row execute function private.cwl_bump_profile_revision();

-- Existing production has independent real audit/snapshot triggers. These
-- record representative provenance and old-revision data in the test DB;
-- they are NEVER disabled by the phase-4 RPC.
create table public.cwl_change_events(
 id bigint generated always as identity primary key,
 clan_id uuid not null,
 actor_id uuid,
 revision bigint not null,
 event_type text not null check(event_type in('profile_created','profile_updated')),
 details jsonb not null default '{}'::jsonb
);
create function private.cwl_audit_profile()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 insert into public.cwl_change_events
  (clan_id,actor_id,revision,event_type,details)
 values (new.clan_id,auth.uid(),new.revision,'profile_updated',
  jsonb_build_object('archive_geaendert',
      old.profile_json->'archives' is distinct from new.profile_json->'archives',
    'plan_geaendert',
      old.profile_json->'locks' is distinct from new.profile_json->'locks'));
 return new;
end $fn$;
create trigger cwl_audit_profile_changes
after update on public.cwl_cloud_profiles
for each row execute function private.cwl_audit_profile();

create table public.cwl_profile_snapshots(
 clan_id uuid not null,revision bigint not null,
 profile_json jsonb not null,created_at timestamptz not null default now(),
 unique(clan_id,revision)
);
create function private.cwl_auto_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if old.profile_json is distinct from new.profile_json then
  insert into public.cwl_profile_snapshots(clan_id,revision,profile_json)
   values(old.clan_id,old.revision,old.profile_json)
   on conflict(clan_id,revision) do nothing;
 end if;
 return new;
end $fn$;
create trigger cwl_auto_snapshot before update on public.cwl_cloud_profiles
for each row execute function private.cwl_auto_snapshot();

-- Current client format, including a participant and previous-day rules.
-- Only synthetic, non-personal player identifiers.
update public.cwl_cloud_profiles set profile_json=
 jsonb_set(jsonb_set(profile_json,
  '{members}',
  '[{"id":"p01","name":"Testspieler","playerTag":"#2PYR","participating":true,
   "fixed":true,"note":"historical","statuses":["auto","auto","auto","auto","auto","auto","auto"],
   "targetDays":4,"firstDay":2,"outFromDay":null,
   "cocBeforeDeparture":{
     "before":{"targetDays":4,"statuses":["must","must","auto","auto","auto","auto","auto"]},
     "automatic":{"targetDays":3,"statuses":["auto","auto","auto","auto","auto","auto","auto"]},
     "edited":{"targetDays":4,"statuses.0":"must","statuses.1":"out","preserveNote":"yes"}
   }}]'::jsonb),
  '{locks,0,lineup}','["p01"]'::jsonb)
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
-- Snapshot override for locked-day zero is a synthetic named player.
update public.cwl_cloud_profiles set profile_json=
 jsonb_set(profile_json,'{locks,0,snapshots}',
 '{"p01":{"id":"p01","name":"Testspieler damals","playerTag":"#2PYR",
 "townHall":18,"threeStar":"high","fixed":true}}'::jsonb)
 where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Demonstrate the ORIGINAL systemless writer is denied BEFORE phase-4 SQL.
do $t$
declare denied boolean:=false;
begin
 begin
  set local role service_role;
  update public.cwl_cloud_profiles set profile_json=
    jsonb_set(profile_json,'{danger}','true'::jsonb)
    where clan_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 exception when insufficient_privilege then denied:=true;
 end;
 reset role;
 if not denied then raise exception 'original plan guard unexpectedly permits service writes';end if;
end $t$;
