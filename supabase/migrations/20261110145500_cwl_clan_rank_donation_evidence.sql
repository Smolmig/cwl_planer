-- #183 Phase 2b1: preserve last observed Clash rank across an actual observed leave/return;
-- record only positive donation counter changes between two short, complete snapshots.
-- Not a last-login estimator. Existing confirmed tenure and war stats remain untouched.
alter table public.cwl_clan_member_tenure
  add column last_clash_rank text,
  add column last_clash_rank_at timestamptz,
  add column rank_before_leave text,
  add column rank_before_leave_at timestamptz,
  add column last_donations integer,
  add column last_donations_at timestamptz,
  add column last_donation_increase_at timestamptz,
  add column last_donation_increase_by integer;
alter table public.cwl_clan_member_tenure
  add constraint cwl_tenure_last_rank_valid
    check (last_clash_rank is null or last_clash_rank in ('member','elder','coLeader','leader')),
  add constraint cwl_tenure_leave_rank_valid
    check (rank_before_leave is null or rank_before_leave in ('member','elder','coLeader','leader')),
  add constraint cwl_tenure_donations_valid
    check (last_donations is null or last_donations between 0 and 9999999),
  add constraint cwl_tenure_growth_valid
    check (last_donation_increase_by is null or last_donation_increase_by between 1 and 9999999);

-- One service-role-only atomic observation: validate complete member list, lock,
-- store the last confirmed rank of a departed member, detect donation growth,
-- then call the existing conservative membership-time RPC before new baselines.
create function public.cwl_observe_clan_roster_evidence(
  p_clan uuid, p_clash_tag text, p_members jsonb
) returns integer language plpgsql security invoker set search_path='' as $body$
declare
 v_total integer;
 v_tags text[];
 v_now timestamptz;
begin
 if current_user <> 'service_role' then
   raise exception 'collector only' using errcode='42501';
 end if;
 if coalesce(pg_catalog.jsonb_typeof(p_members),'') <> 'array' then
   raise exception 'invalid roster';
 end if;
 v_total := pg_catalog.jsonb_array_length(p_members);
 if v_total < 1 or v_total > 50 then
   raise exception 'invalid roster size';
 end if;
 if exists (
   select 1 from pg_catalog.jsonb_array_elements(p_members) as e(value)
   where pg_catalog.jsonb_typeof(e.value) <> 'object'
     or pg_catalog.jsonb_typeof(e.value->'tag') <> 'string'
     or coalesce(pg_catalog.jsonb_typeof(e.value->'role'),'null') not in ('string','null')
     or coalesce(pg_catalog.jsonb_typeof(e.value->'donations'),'null') not in ('number','null')
     or (e.value->>'donations') is not null
        and (e.value->>'donations') !~ '^[0-9]{1,7}$'
 ) then
   raise exception 'invalid roster detail';
 end if;
 select pg_catalog.array_agg(e.value->>'tag') into v_tags
   from pg_catalog.jsonb_array_elements(p_members) as e(value);

 -- The same advisory lock as cwl_observe_clan_roster covers the entire
 -- read-modify-write sequence, including overlapping scheduled runs.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_clan::text,0));
 v_now := pg_catalog.clock_timestamp();
 update public.cwl_clan_member_tenure t set
   rank_before_leave=t.last_clash_rank,
   rank_before_leave_at=t.last_clash_rank_at
 where t.clan_id=p_clan and t.source_clash_tag=p_clash_tag
   and t.is_present and not (t.player_tag=any(v_tags));

 -- Only genuine positive increases from a prior PRESENT snapshot <=3h.
 -- First observation, leave/return gaps, partial data and falling/reset
 -- seasonal counters never produce a positive activity event.
 update public.cwl_clan_member_tenure t set
   last_donation_increase_at=v_now,
   last_donation_increase_by=p.donations-t.last_donations
 from pg_catalog.jsonb_to_recordset(p_members) as p(tag text,role text,donations integer)
 where t.clan_id=p_clan and t.source_clash_tag=p_clash_tag
   and t.player_tag=p.tag and t.is_present
   and t.last_donations is not null and p.donations is not null
   and p.donations>t.last_donations
   and t.last_donations_at is not null and v_now>=t.last_donations_at
   and v_now-t.last_donations_at <= interval '3 hours';

 -- Reuses all tag-, duplicate-, tenant- and elapsed-time guards atomically.
 perform public.cwl_observe_clan_roster(p_clan,p_clash_tag,v_tags);

 update public.cwl_clan_member_tenure t set
   last_clash_rank=case
     when lower(pg_catalog.regexp_replace(coalesce(p.role,''),'[ _-]','','g')) in ('elder','admin') then 'elder'
     when lower(pg_catalog.regexp_replace(coalesce(p.role,''),'[ _-]','','g')) = 'member' then 'member'
     when lower(pg_catalog.regexp_replace(coalesce(p.role,''),'[ _-]','','g')) = 'coleader' then 'coLeader'
     when lower(pg_catalog.regexp_replace(coalesce(p.role,''),'[ _-]','','g')) = 'leader' then 'leader'
     else t.last_clash_rank end,
   last_clash_rank_at=case when p.role is not null
     and lower(pg_catalog.regexp_replace(p.role,'[ _-]','','g')) in ('elder','admin','member','coleader','leader')
     then v_now else t.last_clash_rank_at end,
   rank_before_leave=case when t.observed_visits>1
     and lower(pg_catalog.regexp_replace(coalesce(p.role,''),'[ _-]','','g')) in ('elder','admin')
     then null else t.rank_before_leave end,
   rank_before_leave_at=case when t.observed_visits>1
     and lower(pg_catalog.regexp_replace(coalesce(p.role,''),'[ _-]','','g')) in ('elder','admin')
     then null else t.rank_before_leave_at end,
   last_donations=p.donations,
   last_donations_at=case when p.donations is not null then v_now else null end
 from pg_catalog.jsonb_to_recordset(p_members) as p(tag text,role text,donations integer)
 where t.clan_id=p_clan and t.source_clash_tag=p_clash_tag and t.player_tag=p.tag;
 return v_total;
end;
$body$;
revoke all on function public.cwl_observe_clan_roster_evidence(uuid,text,jsonb)
 from public, anon, authenticated;
grant execute on function public.cwl_observe_clan_roster_evidence(uuid,text,jsonb)
 to service_role;
