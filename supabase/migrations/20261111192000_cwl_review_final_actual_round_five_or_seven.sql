-- #254: Only the actual final war of a fully evidenced official CWL group
-- may block same-season plan review changes.
--
-- Official 6-clan league = 5 wars; official 8-clan league = 7 wars.
-- The service-role-only cwl_group_archives rows preserve the Supercell group
-- as observed by coc-cwl-status. Never derive the group size from available
-- match details, a calendar date, or a local/manual planner setting.
--
-- Pure group predicate: separately testable with synthetic JSON fixtures,
-- without writing player profiles, real archives or planning state.
create or replace function private.cwl_review_group_final_ended(
 p_group jsonb,p_clan_tag text
) returns boolean language sql immutable set search_path = ''
as $$
 select case
  when upper(coalesce(p_clan_tag,'')) !~ '^#[0289PYLQGRJCUV]{3,15}$'
    or jsonb_typeof(p_group) is distinct from 'object'
    or jsonb_typeof(p_group->'clans') is distinct from 'array'
    or jsonb_typeof(p_group->'rounds') is distinct from 'array'
    then false
  when jsonb_array_length(p_group->'clans') not in (6,8)
    or jsonb_array_length(p_group->'rounds') <>
       jsonb_array_length(p_group->'clans')-1
    or upper(p_group->>'clanTag') is distinct from upper(p_clan_tag)
    then false
  else
    -- Exactly six/eight unique, valid clan tags (not a partial 8-clan list)
    -- and the linked clan must be in the official group.
    (select count(distinct upper(x.value->>'tag'))
       from jsonb_array_elements(p_group->'clans') as x(value)
       where upper(coalesce(x.value->>'tag','')) ~ '^#[0289PYLQGRJCUV]{3,15}$')
      = jsonb_array_length(p_group->'clans')
    and jsonb_path_exists(p_group,
       '$.clans[*] ? (@.tag == $tag)'::jsonpath,
       jsonb_build_object('tag',upper(p_clan_tag)))
    and case jsonb_array_length(p_group->'clans')
      when 6 then
        p_group #>> '{rounds,4,day}' = '5'
        and jsonb_path_exists(p_group,
          '$.rounds[4].matches[*] ? (@.available == true && @.state == "warEnded" && (@.clan.tag == $tag || @.opponent.tag == $tag))'::jsonpath,
          jsonb_build_object('tag',upper(p_clan_tag)))
      when 8 then
        p_group #>> '{rounds,6,day}' = '7'
        and jsonb_path_exists(p_group,
          '$.rounds[6].matches[*] ? (@.available == true && @.state == "warEnded" && (@.clan.tag == $tag || @.opponent.tag == $tag))'::jsonpath,
          jsonb_build_object('tag',upper(p_clan_tag)))
      else false
    end
 end;
$$;
revoke all on function private.cwl_review_group_final_ended(jsonb,text)
  from public,anon,authenticated;

-- Maintain the existing role-checked public *_checked RPC entrypoints.
-- Their current call to this private helper now covers both actual finales.
create or replace function private.cwl_review_last_round_ended(
 p_clan uuid,p_season text
) returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.cwl_group_archives g
   join public.cwl_clans c on c.id=g.clan_id
   where g.clan_id=p_clan
     and g.season=p_season
     and g.group_json->>'season'=g.season
     and upper(g.clan_tag)=upper(c.clash_tag)
     and private.cwl_review_group_final_ended(g.group_json,g.clan_tag)
 );
$$;
revoke all on function private.cwl_review_last_round_ended(uuid,text)
  from public,anon,authenticated;
