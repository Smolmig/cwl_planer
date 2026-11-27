-- Experimental source. Generate the migration via CLI after isolated SQL UAT.
-- No profile write, guard override, pending-suggestion update or revision bump.
create table public.cwl_strategic_assignments (
 clan_id uuid primary key references public.cwl_clans(id) on delete cascade,
 cycle_id uuid not null,
 base_revision bigint not null check(base_revision>=1),
 observed_at timestamptz not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=131072),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.cwl_strategic_assignments enable row level security;
revoke all on public.cwl_strategic_assignments from public,anon,authenticated,service_role;
grant select on public.cwl_strategic_assignments to authenticated;
grant select,insert,update on public.cwl_strategic_assignments to service_role;
create policy strategic_assignment_current_member on public.cwl_strategic_assignments
 for select to authenticated using (
 private.cwl_is_member(clan_id)
 and exists(select 1 from public.cwl_cloud_profiles p join public.cwl_plan_review_state r on r.clan_id=p.clan_id
 join public.cwl_clans c on c.id=p.clan_id
 where p.clan_id=cwl_strategic_assignments.clan_id and p.revision=base_revision and r.cycle_id=cwl_strategic_assignments.cycle_id
 and r.season=snapshot->>'season' and c.clash_tag=snapshot->>'clanTag'
 and p.profile_json#>'{config,strategicAuto}'='true'::jsonb)
 );
create function public.cwl_publish_strategic_assignment(p_clan uuid,p_owner uuid,p_tag text,p_cycle uuid,p_revision bigint,p_valid_until timestamptz,p_snapshot jsonb)
 returns boolean language plpgsql security invoker set search_path='' as $fn$
 declare r public.cwl_plan_review_state; p public.cwl_cloud_profiles; c public.cwl_clans; prev public.cwl_strategic_assignments;
 observed timestamptz; now_at timestamptz; affected integer;
 begin
  if current_user<>'service_role' or auth.uid() is not null then raise exception 'service_only' using errcode='42501';end if;
  if p_clan is null or p_owner is null or p_cycle is null or p_revision is null or p_valid_until is null or p_tag is null or
   p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>131072 then return false;end if;
  if p_snapshot->>'source' is distinct from 'collector' or p_snapshot->>'version' is distinct from '1' or
   p_snapshot->>'clanId' is distinct from p_clan::text or p_snapshot->>'clanTag' is distinct from p_tag or
   jsonb_typeof(p_snapshot->'observedAt') is distinct from 'number' or
   jsonb_typeof(p_snapshot->'plan') is distinct from 'array' or jsonb_typeof(p_snapshot->'observedRounds') is distinct from 'array' or
   jsonb_typeof(p_snapshot->'registeredTags') is distinct from 'array' or jsonb_typeof(p_snapshot->'ruleKey') is distinct from 'string' then return false;end if;
  if (p_snapshot->>'observedAt')::numeric not between 0 and 4102444800000 then return false;end if;
  observed:=to_timestamp((p_snapshot->>'observedAt')::double precision/1000);
  -- Same lock order as suggestion resolution; lock approved inputs, never write them.
  select * into r from public.cwl_plan_review_state where clan_id=p_clan for share;
  select * into p from public.cwl_cloud_profiles where clan_id=p_clan for share;
  select * into c from public.cwl_clans where id=p_clan for share;
  now_at:=clock_timestamp();
  if r.clan_id is null or p.clan_id is null or c.id is null or
   r.cycle_id is distinct from p_cycle or p.revision is distinct from p_revision or
   c.owner_user_id is distinct from p_owner or c.clash_tag is distinct from p_tag or
   r.season is distinct from p_snapshot->>'season' or r.season is distinct from p.profile_json#>>'{cwlLive,season}' or
   p.profile_json#>>'{cwlLive,clanTag}' is distinct from p_tag or
   p.profile_json#>'{config,strategicAuto}' is distinct from 'true'::jsonb or
   coalesce(p.profile_json#>>'{config,strategicMode}','') not in ('balanced','performance','development') or
   p.profile_json->>'cwlLiveIgnoredSeason'=r.season or
   coalesce(p.profile_json#>'{cocManualEmergency,pending}','false'::jsonb)='true'::jsonb or
   observed>now_at or p_valid_until<=now_at or p_valid_until>observed+interval '5 minutes' then return false;end if;
  if p.profile_json#>>'{config,days}' not in ('5','7') or p.profile_json#>>'{config,slots}' not in ('15','30') then return false;end if;
  if jsonb_array_length(p_snapshot->'plan') is distinct from (p.profile_json#>>'{config,days}')::integer or
   jsonb_array_length(p_snapshot->'observedRounds') is distinct from (p.profile_json#>>'{config,days}')::integer then return false;end if;
  -- Two overlapping collectors cannot replace newer evidence with older evidence.
  insert into public.cwl_strategic_assignments as a(clan_id,cycle_id,base_revision,observed_at,snapshot)
   values(p_clan,p_cycle,p_revision,observed,p_snapshot)
  on conflict(clan_id) do update set cycle_id=excluded.cycle_id,base_revision=excluded.base_revision,
   observed_at=excluded.observed_at,snapshot=excluded.snapshot,updated_at=clock_timestamp()
  where (a.cycle_id<>excluded.cycle_id or a.base_revision<>excluded.base_revision or a.observed_at<excluded.observed_at)
   and p_valid_until>clock_timestamp();
  get diagnostics affected=row_count;
  return affected=1;
 end;$fn$;
revoke all on function public.cwl_publish_strategic_assignment(uuid,uuid,text,uuid,bigint,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.cwl_publish_strategic_assignment(uuid,uuid,text,uuid,bigint,timestamptz,jsonb) to service_role;
