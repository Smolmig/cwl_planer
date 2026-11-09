-- #184 / v1.16.47: atomic, explicitly confirmed OWNER-only pause of ONE
-- still-editable Clash preparation day. No automatic Clash edit.
-- Existing cloud profile audit trigger records the rule diff; a second
-- append-only Missed decision in this transaction records the acceptance.
alter table public.cwl_missed_owner_decisions
 add column if not exists target_day smallint
 check (target_day between 1 and 7);
alter table public.cwl_missed_owner_decisions
 drop constraint if exists cwl_missed_owner_decisions_decision_check;
alter table public.cwl_missed_owner_decisions
 add constraint cwl_missed_owner_decisions_decision_check
 check (decision in ('excused','later','review_pause','applied_pause'));
alter table public.cwl_missed_owner_decisions
 add constraint cwl_missed_owner_decisions_application_shape
 check ((decision='applied_pause' and target_day is not null)
    or (decision<>'applied_pause' and target_day is null));

-- A direct client INSERT may only record human review decisions. Only this
-- privileged, carefully validated RPC may append an applied_pause record.
create policy cwl_missed_direct_apply_guard
 on public.cwl_missed_owner_decisions as restrictive for insert
 to authenticated with check (decision<>'applied_pause' and target_day is null);

create function public.cwl_apply_verified_missed_pause(
 p_clan uuid,p_season text,p_war_key text,p_miss_day smallint,
 p_player_tag text,p_target_day smallint,p_expected_revision bigint,
 p_note text default ''
) returns bigint
 language plpgsql security definer set search_path=''
 as $fn$
declare
 v_profile public.cwl_cloud_profiles;
 v_miss jsonb;
 v_future jsonb;
 v_rounds jsonb;
 v_members jsonb;
 v_player jsonb;
 v_index integer;
 v_count integer;
 v_latest text;
 v_next jsonb;
 v_revision bigint;
 v_clan_tag text;
begin
 if (select auth.uid()) is null or not private.cwl_is_owner(p_clan) then
  raise exception 'owner_only' using errcode='42501';
 end if;
 if p_season is null or p_season !~ '^20[0-9]{2}-(0[1-9]|1[0-2])
    or p_war_key is null or p_war_key !~ '^cwl:#[0289PYLQGRJCUV]{3,15}
    or p_player_tag is null or p_player_tag !~ '^#[0289PYLQGRJCUV]{3,15}
    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season' is distinct from p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag' is distinct from v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    coalesce((v_profile.profile_json->'config'->>'days')::integer,0)<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available' is distinct from 'true' or
    v_miss->>'state' is distinct from 'warEnded' or
    v_miss->>'warTag' is distinct from substring(p_war_key from 5) or
    v_miss->'clan'->>'tag' is distinct from v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available' is distinct from 'true' or
    v_future->>'state' is distinct from 'preparation' or
    v_future->'clan'->>'tag' is distinct from v_clan_tag or
    v_future->>'teamSize' is distinct from v_profile.profile_json->'config'->>'slots' or
    jsonb_typeof(v_future->'clan'->'members') is distinct from 'array' or
    jsonb_array_length(v_future->'clan'->'members') <>
       (v_profile.profile_json->'config'->>'slots')::integer or
    v_future->>'startTime' is null or v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked' is distinct from 'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 if exists (
   select 1 from jsonb_array_elements(
    case when jsonb_typeof(v_profile.profile_json->'archivedMembers')='array'
      then v_profile.profile_json->'archivedMembers'
      else '[]'::jsonb end
   ) as former(value)
   where former.value->>'playerTag'=p_player_tag
 ) then raise exception 'ambiguous_archived_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed' is distinct from 'false' or
    v_player->>'participating' is distinct from 'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1) is distinct from 'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;

    or p_war_key !~ '^cwl:#[0289PYLQGRJCUV]{3,15}$'
    or p_player_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season'<>p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag'<>v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    (v_profile.profile_json->'config'->>'days')::integer<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available'<>'true' or
    v_miss->>'state'<>'warEnded' or
    v_miss->>'warTag'<>substring(p_war_key from 5) or
    v_miss->'clan'->>'tag'<>v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available'<>'true' or
    v_future->>'state'<>'preparation' or
    v_future->'clan'->>'tag'<>v_clan_tag or
    v_future->>'teamSize' <> v_profile.profile_json->'config'->>'slots' or
    v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked'<>'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed'<>'false' or
    v_player->>'participating'<>'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1)<>'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;

    or p_player_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season'<>p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag'<>v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    (v_profile.profile_json->'config'->>'days')::integer<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available'<>'true' or
    v_miss->>'state'<>'warEnded' or
    v_miss->>'warTag'<>substring(p_war_key from 5) or
    v_miss->'clan'->>'tag'<>v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available'<>'true' or
    v_future->>'state'<>'preparation' or
    v_future->'clan'->>'tag'<>v_clan_tag or
    v_future->>'teamSize' <> v_profile.profile_json->'config'->>'slots' or
    v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked'<>'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed'<>'false' or
    v_player->>'participating'<>'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1)<>'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;

    or p_war_key !~ '^cwl:#[0289PYLQGRJCUV]{3,15}$'
    or p_player_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season'<>p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag'<>v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    (v_profile.profile_json->'config'->>'days')::integer<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available'<>'true' or
    v_miss->>'state'<>'warEnded' or
    v_miss->>'warTag'<>substring(p_war_key from 5) or
    v_miss->'clan'->>'tag'<>v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available'<>'true' or
    v_future->>'state'<>'preparation' or
    v_future->'clan'->>'tag'<>v_clan_tag or
    v_future->>'teamSize' <> v_profile.profile_json->'config'->>'slots' or
    v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked'<>'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed'<>'false' or
    v_player->>'participating'<>'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1)<>'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;

    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season'<>p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag'<>v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    (v_profile.profile_json->'config'->>'days')::integer<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available'<>'true' or
    v_miss->>'state'<>'warEnded' or
    v_miss->>'warTag'<>substring(p_war_key from 5) or
    v_miss->'clan'->>'tag'<>v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available'<>'true' or
    v_future->>'state'<>'preparation' or
    v_future->'clan'->>'tag'<>v_clan_tag or
    v_future->>'teamSize' <> v_profile.profile_json->'config'->>'slots' or
    v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked'<>'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed'<>'false' or
    v_player->>'participating'<>'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1)<>'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;

    or p_war_key !~ '^cwl:#[0289PYLQGRJCUV]{3,15}$'
    or p_player_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season'<>p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag'<>v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    (v_profile.profile_json->'config'->>'days')::integer<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available'<>'true' or
    v_miss->>'state'<>'warEnded' or
    v_miss->>'warTag'<>substring(p_war_key from 5) or
    v_miss->'clan'->>'tag'<>v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available'<>'true' or
    v_future->>'state'<>'preparation' or
    v_future->'clan'->>'tag'<>v_clan_tag or
    v_future->>'teamSize' <> v_profile.profile_json->'config'->>'slots' or
    v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked'<>'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed'<>'false' or
    v_player->>'participating'<>'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1)<>'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;

    or p_player_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season'<>p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag'<>v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    (v_profile.profile_json->'config'->>'days')::integer<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available'<>'true' or
    v_miss->>'state'<>'warEnded' or
    v_miss->>'warTag'<>substring(p_war_key from 5) or
    v_miss->'clan'->>'tag'<>v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available'<>'true' or
    v_future->>'state'<>'preparation' or
    v_future->'clan'->>'tag'<>v_clan_tag or
    v_future->>'teamSize' <> v_profile.profile_json->'config'->>'slots' or
    v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked'<>'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed'<>'false' or
    v_player->>'participating'<>'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1)<>'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;

    or p_war_key !~ '^cwl:#[0289PYLQGRJCUV]{3,15}$'
    or p_player_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
    or p_miss_day is null or p_miss_day not between 1 and 7
    or p_target_day is null or p_target_day not between p_miss_day+1 and 7
    or p_expected_revision is null or
    char_length(coalesce(p_note,''))>300 then
   raise exception 'invalid_pause_arguments';
 end if;
 -- The collector evidence is the authority, not a browser claim or a
 -- cached snapshot that could have dropped/duplicated attack data.
 if not exists(
  select 1 from public.cwl_stat_wars w
  join public.cwl_stat_missed m
   on m.clan_id=w.clan_id and m.war_key=w.war_key
  where w.clan_id=p_clan and w.war_key=p_war_key
   and w.war_type='cwl' and w.source='api'
   and w.finalized is true and w.missed_log_complete is true
   and m.player_tag=p_player_tag and m.missed_count>0
 ) then raise exception 'unverified_missed_attack';end if;

 -- Serialize against all regular Cloud saves and owner/editor proposals.
 select * into v_profile from public.cwl_cloud_profiles
  where clan_id=p_clan for update;
 if not found or v_profile.revision<>p_expected_revision then
  raise exception 'stale_revision';
 end if;
 select clash_tag into v_clan_tag from public.cwl_clans where id=p_clan;
 if v_profile.profile_json->'cwlLive'->>'season'<>p_season or
    v_profile.profile_json->'cwlLive'->>'clanTag'<>v_clan_tag or
    v_profile.profile_json->>'cwlLiveIgnoredSeason'=p_season or
    (v_profile.profile_json->'config'->>'days')::integer<p_target_day
 then raise exception 'wrong_cwl_season';end if;
 v_rounds=v_profile.profile_json->'cwlLive'->'rounds';
 if jsonb_typeof(v_rounds)<>'array' then
  raise exception 'cwl_rounds_missing';
 end if;
 select value into v_miss from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_miss_day::text limit 1;
 if v_miss is null or v_miss->>'available'<>'true' or
    v_miss->>'state'<>'warEnded' or
    v_miss->>'warTag'<>substring(p_war_key from 5) or
    v_miss->'clan'->>'tag'<>v_clan_tag or
    jsonb_typeof(v_miss->'clan'->'members')<>'array' or
    not exists (
      select 1 from jsonb_array_elements(v_miss->'clan'->'members') as m(value)
      where m.value->>'tag'=p_player_tag
        and m.value->'attacks'='[]'::jsonb
    )
 then raise exception 'missed_event_not_current';end if;
 select value into v_future from jsonb_array_elements(v_rounds) as r(value)
  where r.value->>'day'=p_target_day::text limit 1;
 if v_future is null or v_future->>'available'<>'true' or
    v_future->>'state'<>'preparation' or
    v_future->'clan'->>'tag'<>v_clan_tag or
    v_future->>'teamSize' <> v_profile.profile_json->'config'->>'slots' or
    v_future->>'startTime' !~ '^[0-9]{8}T[0-9]{6}' or
    left(v_future->>'startTime',15) <=
       to_char((now() at time zone 'UTC')+interval '30 minutes',
         'YYYYMMDD"T"HH24MISS') or
    v_profile.profile_json->'locks'->(p_target_day-1)->>'locked'<>'false'
 then raise exception 'day_already_fixed_or_unknown';end if;
 -- An earlier human review_pause is mandatory; an excusal/later
 -- decision supersedes it until the owner explicitly reviews anew.
 select decision into v_latest
  from public.cwl_missed_owner_decisions
  where clan_id=p_clan and season=p_season and war_key=p_war_key
   and day=p_miss_day and player_tag=p_player_tag
  order by id desc limit 1;
 if v_latest is distinct from 'review_pause' then
  raise exception 'pause_not_currently_approved_for_review';
 end if;
 v_members=v_profile.profile_json->'members';
 if jsonb_typeof(v_members)<>'array' then
  raise exception 'members_missing';
 end if;
 select count(*),min(ordinality)::integer-1 into v_count,v_index
  from jsonb_array_elements(v_members) with ordinality as m(value,ordinality)
  where m.value->>'playerTag'=p_player_tag;
 if v_count<>1 then raise exception 'ambiguous_player_tag';end if;
 v_player=v_members->v_index;
 if v_player->>'fixed'<>'false' or
    v_player->>'participating'<>'true' or
    v_player->>'cocSyncState'='former' or
    (v_player ? 'targetDays' and
      v_player->'targetDays' not in ('null'::jsonb,'""'::jsonb)) or
    jsonb_typeof(v_player->'statuses')<>'array' or
    jsonb_array_length(v_player->'statuses')<>7 or
    v_player->'statuses'->>(p_target_day-1)<>'auto'
 then raise exception 'player_has_hard_rule_or_target';end if;
 -- Never let a direct client supply a replacement document. Change exactly
 -- one AUTO -> RAUS field on a still editable preparation day.
 v_next=jsonb_set(v_profile.profile_json,
  array['members',v_index::text,'statuses',(p_target_day-1)::text],
  '"out"'::jsonb,false);
 update public.cwl_cloud_profiles set profile_json=v_next
  where clan_id=p_clan and revision=p_expected_revision
  returning revision into v_revision;
 if not found then raise exception 'stale_revision';end if;
 insert into public.cwl_missed_owner_decisions(
  clan_id,season,war_key,day,player_tag,decision,target_day,note,actor_id
 ) values(p_clan,p_season,p_war_key,p_miss_day,p_player_tag,
  'applied_pause',p_target_day,coalesce(p_note,''),(select auth.uid()));
 return v_revision;
end;
$fn$;
revoke all on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) from public,anon;
grant execute on function public.cwl_apply_verified_missed_pause(
 uuid,text,text,smallint,text,smallint,bigint,text) to authenticated;
