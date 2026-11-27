-- Additive service-only queue. Retain original allowlist RPC for rollback.
create function public.cwl_claim_strategic_recompute_appwide()
 returns jsonb language plpgsql security invoker set search_path='' as $claim$
 declare picked record; claimed integer;
 begin
  if current_user<>'service_role' or auth.uid() is not null then raise exception 'service_only' using errcode='42501';end if;
  -- Serialize the short claim transaction, not the network calculation.
  if not pg_try_advisory_xact_lock(70621,38001) then return null;end if;
  select c.id,c.clash_tag,r.cycle_id,p.revision into picked
  from public.cwl_clans c join public.cwl_cloud_profiles p on p.clan_id=c.id
  join public.cwl_plan_review_state r on r.clan_id=c.id
  left join public.cwl_strategic_assignments a on a.clan_id=c.id
  left join public.cwl_strategic_recompute_claims q on q.clan_id=c.id
  where c.clash_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'
    and exists(select 1 from public.cwl_clan_memberships m where m.clan_id=c.id and m.user_id=c.owner_user_id and m.role='owner')
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
revoke all on function public.cwl_claim_strategic_recompute_appwide() from public,anon,authenticated,service_role;
grant execute on function public.cwl_claim_strategic_recompute_appwide() to service_role;
