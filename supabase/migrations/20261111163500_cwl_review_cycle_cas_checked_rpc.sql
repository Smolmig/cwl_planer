-- #37: additive, opt-in CAS entrypoints for plan review actions.
-- Phase A only: legacy grants stay available until the new client is live.
-- Do not equate the calendar month with proof that a league finished.
--
-- Authoritative finished-war evidence: group archive is written exclusively
-- by the authenticated coc-cwl-status Edge function via service_role.
-- A missing final round is UNKNOWN, not a fabricated result or automatic lock.
create or replace function private.cwl_review_last_round_ended(p_clan uuid,p_season text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.cwl_group_archives g
    join public.cwl_clans c on c.id=g.clan_id
    where g.clan_id=p_clan and g.season=p_season
      and upper(g.clan_tag)=upper(c.clash_tag)
      and jsonb_path_exists(
        g.group_json,
        '$.rounds[6].matches[*] ? (@.available == true && @.state == "warEnded" && (@.clan.tag == $tag || @.opponent.tag == $tag))'::jsonpath,
        jsonb_build_object('tag',g.clan_tag)
      )
  );
$$;
revoke all on function private.cwl_review_last_round_ended(uuid,text) from public,anon,authenticated;

-- New client must name the exact server cycle and season that it read.
-- Lock the state row BEFORE comparing, so a concurrent cycle advance cannot
-- slip between validation and the existing owner-only mutation.
create or replace function public.cwl_set_plan_lock_checked(
 p_clan uuid,p_locked boolean,p_new_cycle boolean,
 p_expected_cycle uuid,p_expected_season text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_state public.cwl_plan_review_state;
        v_current text:=to_char(now() at time zone 'UTC','YYYY-MM');
        v_created uuid;
begin
  if auth.uid() is null or not private.cwl_is_owner(p_clan) then
    raise exception 'owner_only' using errcode='42501';
  end if;
  select * into v_state from public.cwl_plan_review_state
    where clan_id=p_clan for update;
  if not found then
    if p_expected_cycle is not null or p_expected_season is distinct from v_current
      then raise exception 'stale_plan_cycle' using errcode='40001';end if;
    insert into public.cwl_plan_review_state(clan_id,season,locked)
      values(p_clan,v_current,false)
      on conflict(clan_id) do nothing returning cycle_id into v_created;
    if v_created is null then
      raise exception 'stale_plan_cycle' using errcode='40001';
    end if;
    select * into v_state from public.cwl_plan_review_state
      where clan_id=p_clan for update;
  else
    if p_expected_cycle is distinct from v_state.cycle_id or
       p_expected_season is distinct from v_state.season
       then raise exception 'stale_plan_cycle' using errcode='40001';end if;
  end if;
  if not p_new_cycle then
    if v_state.season<>v_current then
      raise exception 'season_outdated' using errcode='42501';
    end if;
    if private.cwl_review_last_round_ended(p_clan,v_state.season) then
      raise exception 'cwl_season_finished' using errcode='42501';
    end if;
  else
    -- An API-linked clan can start a fresh cycle only after the calendar has
    -- genuinely advanced to a new official CWL month. The stronger
    -- API-verified ownerless rollover/atomic archival is tracked in #227.
    if v_state.season=v_current and v_created is null and exists (
      select 1 from public.cwl_clans
      where id=p_clan and clash_tag is not null
    ) then raise exception 'new_season_not_confirmed' using errcode='42501';end if;
  end if;
  return public.cwl_set_plan_lock(p_clan,p_locked,p_new_cycle);
end;
$$;
revoke all on function public.cwl_set_plan_lock_checked(uuid,boolean,boolean,uuid,text) from public,anon;
grant execute on function public.cwl_set_plan_lock_checked(uuid,boolean,boolean,uuid,text) to authenticated;

create or replace function public.cwl_submit_plan_suggestion_checked(
 p_clan uuid,p_base_revision bigint,p_profile jsonb,
 p_expected_cycle uuid,p_expected_season text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_state public.cwl_plan_review_state;
begin
  if auth.uid() is null or not exists (
    select 1 from public.cwl_clan_memberships
    where clan_id=p_clan and user_id=auth.uid() and role='editor'
  ) then raise exception 'editor_only' using errcode='42501';end if;
  select * into v_state from public.cwl_plan_review_state
    where clan_id=p_clan for share;
  if v_state.clan_id is null or
     v_state.cycle_id is distinct from p_expected_cycle or
     v_state.season is distinct from p_expected_season then
    raise exception 'stale_plan_cycle' using errcode='40001';
  end if;
  if v_state.season<>to_char(now() at time zone 'UTC','YYYY-MM') or
     private.cwl_review_last_round_ended(p_clan,v_state.season) then
    raise exception 'cwl_season_finished' using errcode='42501';
  end if;
  return public.cwl_submit_plan_suggestion(p_clan,p_base_revision,p_profile);
end;
$$;
revoke all on function public.cwl_submit_plan_suggestion_checked(uuid,bigint,jsonb,uuid,text) from public,anon;
grant execute on function public.cwl_submit_plan_suggestion_checked(uuid,bigint,jsonb,uuid,text) to authenticated;

create or replace function public.cwl_resolve_plan_suggestion_checked(
 p_suggestion uuid,p_accept boolean,p_expected_cycle uuid,p_expected_season text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_clan uuid;v_state public.cwl_plan_review_state;
begin
  select clan_id into v_clan from public.cwl_plan_suggestions where id=p_suggestion;
  if auth.uid() is null or v_clan is null or not private.cwl_is_owner(v_clan) then
    raise exception 'owner_only' using errcode='42501';
  end if;
  select * into v_state from public.cwl_plan_review_state
    where clan_id=v_clan for share;
  if v_state.clan_id is null or
     v_state.cycle_id is distinct from p_expected_cycle or
     v_state.season is distinct from p_expected_season then
    raise exception 'stale_plan_cycle' using errcode='40001';
  end if;
  if v_state.season<>to_char(now() at time zone 'UTC','YYYY-MM') or
     private.cwl_review_last_round_ended(v_clan,v_state.season) then
    raise exception 'cwl_season_finished' using errcode='42501';
  end if;
  return public.cwl_resolve_plan_suggestion(p_suggestion,p_accept);
end;
$$;
revoke all on function public.cwl_resolve_plan_suggestion_checked(uuid,boolean,uuid,text) from public,anon;
grant execute on function public.cwl_resolve_plan_suggestion_checked(uuid,boolean,uuid,text) to authenticated;

create or replace function public.cwl_withdraw_plan_suggestion_checked(
 p_suggestion uuid,p_expected_cycle uuid,p_expected_season text
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_clan uuid;v_state public.cwl_plan_review_state;
begin
  select clan_id into v_clan from public.cwl_plan_suggestions where id=p_suggestion;
  if auth.uid() is null or v_clan is null or not exists (
    select 1 from public.cwl_clan_memberships
    where clan_id=v_clan and user_id=auth.uid() and role='editor'
  ) then raise exception 'editor_only' using errcode='42501';end if;
  select * into v_state from public.cwl_plan_review_state
    where clan_id=v_clan for share;
  if v_state.clan_id is null or
     v_state.cycle_id is distinct from p_expected_cycle or
     v_state.season is distinct from p_expected_season then
    raise exception 'stale_plan_cycle' using errcode='40001';
  end if;
  if v_state.season<>to_char(now() at time zone 'UTC','YYYY-MM') or
     private.cwl_review_last_round_ended(v_clan,v_state.season) then
    raise exception 'cwl_season_finished' using errcode='42501';
  end if;
  perform public.cwl_withdraw_plan_suggestion(p_suggestion);
end;
$$;
revoke all on function public.cwl_withdraw_plan_suggestion_checked(uuid,uuid,text) from public,anon;
grant execute on function public.cwl_withdraw_plan_suggestion_checked(uuid,uuid,text) to authenticated;
