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
 declare r public.cwl_plan_review_state; p public.cwl_cloud_profiles; c public.cwl_clans;
 day_row jsonb; round_row jsonb; member_ids jsonb; d integer; days integer; slots integer;
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
  if coalesce(p.profile_json#>>'{config,days}','') not in ('5','7') or coalesce(p.profile_json#>>'{config,slots}','') not in ('15','30') then return false;end if;
  days:=(p.profile_json#>>'{config,days}')::integer; slots:=(p.profile_json#>>'{config,slots}')::integer;
  if jsonb_array_length(p_snapshot->'plan') is distinct from (p.profile_json#>>'{config,days}')::integer or
   jsonb_array_length(p_snapshot->'observedRounds') is distinct from (p.profile_json#>>'{config,days}')::integer then return false;end if;
  if jsonb_typeof(p.profile_json->'members') is distinct from 'array' or
   jsonb_typeof(coalesce(p.profile_json->'archivedMembers','[]'::jsonb)) is distinct from 'array' or
   coalesce(p_snapshot->>'anchorWarTag','') !~ '^#[0289PYLQGRJCUV]{3,15}$' or
   jsonb_array_length(p_snapshot->'registeredTags') not between slots and 50 or
   exists(select 1 from jsonb_array_elements(p_snapshot->'registeredTags') t where jsonb_typeof(t)<>'string' or (t#>>'{}') !~ '^#[0289PYLQGRJCUV]{3,15}$') or
   (select count(distinct t) from jsonb_array_elements(p_snapshot->'registeredTags') t)<>jsonb_array_length(p_snapshot->'registeredTags') then return false;end if;
  member_ids:=(select coalesce(jsonb_agg(m->'id'),'[]'::jsonb) from jsonb_array_elements((p.profile_json->'members')||coalesce(p.profile_json->'archivedMembers','[]'::jsonb)) m);
  for d in 0..days-1 loop
   day_row:=p_snapshot->'plan'->d; round_row:=p_snapshot->'observedRounds'->d;
   if jsonb_typeof(day_row) is distinct from 'object' or day_row->>'day' is distinct from (d+1)::text or
    jsonb_typeof(day_row->'lineup') is distinct from 'array' or jsonb_typeof(round_row) is distinct from 'object' or
    round_row->>'day' is distinct from (d+1)::text or jsonb_typeof(round_row->'available') is distinct from 'boolean' then return false;end if;
   if jsonb_array_length(day_row->'lineup')<>slots or
    (select count(distinct m) from jsonb_array_elements(day_row->'lineup') m)<>slots or
    exists(select 1 from jsonb_array_elements(day_row->'lineup') m where jsonb_typeof(m)<>'string' or not member_ids @> jsonb_build_array(m)) then return false;end if;
   if round_row->'available'='true'::jsonb then
    if coalesce(round_row->>'warTag','') !~ '^#[0289PYLQGRJCUV]{3,15}$' or coalesce(round_row->>'state','') not in ('preparation','inWar','warEnded') then return false;end if;
    if round_row->>'state'<>'preparation' then
     if jsonb_typeof(round_row->'lineup') is distinct from 'array' then return false;end if;
     if jsonb_array_length(round_row->'lineup')<>slots or not (day_row->'lineup' @> round_row->'lineup' and round_row->'lineup' @> day_row->'lineup') then return false;end if;
    end if;
   end if;
  end loop;
  if not exists(select 1 from jsonb_array_elements(p_snapshot->'observedRounds') w where w->'available'='true'::jsonb and w->>'state'='preparation' and w->>'warTag'=p_snapshot->>'anchorWarTag') then return false;end if;
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

-- Separate retry lease; a user cannot queue arbitrary clans or set the clock.
-- Only approved, persisted input revisions are considered. No profile trigger.
create table public.cwl_strategic_recompute_claims (
 clan_id uuid primary key references public.cwl_clans(id) on delete cascade,
 cycle_id uuid not null, base_revision bigint not null,
 claimed_at timestamptz not null
);
alter table public.cwl_strategic_recompute_claims enable row level security;
revoke all on public.cwl_strategic_recompute_claims from public,anon,authenticated,service_role;
grant select,insert,update on public.cwl_strategic_recompute_claims to service_role;
create function public.cwl_claim_strategic_recompute(p_grants jsonb)
 returns jsonb language plpgsql security invoker set search_path='' as $claim$
 declare picked record; claimed integer;
 begin
  if current_user<>'service_role' or auth.uid() is not null then raise exception 'service_only' using errcode='42501';end if;
  if jsonb_typeof(p_grants) is distinct from 'array' then return null;end if;
  if jsonb_array_length(p_grants)>50 then return null;end if;
  select c.id,c.clash_tag,r.cycle_id,p.revision into picked
  from public.cwl_clans c join public.cwl_cloud_profiles p on p.clan_id=c.id
  join public.cwl_plan_review_state r on r.clan_id=c.id
  left join public.cwl_strategic_assignments a on a.clan_id=c.id
  left join public.cwl_strategic_recompute_claims q on q.clan_id=c.id
  where (select count(*) from jsonb_array_elements(p_grants) g where g->>'clanId'=c.id::text and g->>'clanTag'=c.clash_tag and g->>'ownerId'=c.owner_user_id::text)=1
    and r.season=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM')
    and p.profile_json#>>'{cwlLive,season}'=r.season and p.profile_json#>>'{cwlLive,clanTag}'=c.clash_tag
    and p.profile_json#>'{config,strategicAuto}'='true'::jsonb
    and p.profile_json#>>'{config,strategicMode}' in ('balanced','performance','development')
    and p.profile_json->>'cwlLiveIgnoredSeason' is distinct from r.season
    and coalesce(p.profile_json#>'{cocManualEmergency,pending}','false'::jsonb)<>'true'::jsonb
    and (a.clan_id is null or a.base_revision<>p.revision or a.cycle_id<>r.cycle_id)
    and (q.clan_id is null or q.claimed_at<clock_timestamp()-interval '5 minutes'
      or ((q.base_revision<>p.revision or q.cycle_id<>r.cycle_id) and q.claimed_at<clock_timestamp()-interval '1 minute'))
  order by q.claimed_at nulls first,p.updated_at,c.id limit 1
  for share of p,r,c skip locked;
  if not found then return null;end if;
  insert into public.cwl_strategic_recompute_claims as q(clan_id,cycle_id,base_revision,claimed_at)
  values(picked.id,picked.cycle_id,picked.revision,clock_timestamp())
  on conflict(clan_id) do update set cycle_id=excluded.cycle_id,base_revision=excluded.base_revision,claimed_at=excluded.claimed_at
  where q.claimed_at<clock_timestamp()-interval '5 minutes'
   or ((q.base_revision<>excluded.base_revision or q.cycle_id<>excluded.cycle_id) and q.claimed_at<clock_timestamp()-interval '1 minute');
  get diagnostics claimed=row_count;
  if claimed<>1 then return null;end if;
  return jsonb_build_object('clanId',picked.id,'clanTag',picked.clash_tag,'cycleId',picked.cycle_id,'revision',picked.revision);
 end;$claim$;
revoke all on function public.cwl_claim_strategic_recompute(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.cwl_claim_strategic_recompute(jsonb) to service_role;
