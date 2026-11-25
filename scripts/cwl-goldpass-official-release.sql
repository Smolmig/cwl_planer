-- Goldpass draws: separate owner-only state; trusted status-server archives only.
-- Deploy after rollback-only tests. No changes to CWL plans or statistics.
create table public.cwl_goldpass_raffles (
 clan_id uuid not null references public.cwl_clans(id) on delete cascade,
 season text not null check (season ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 clan_tag text not null check (clan_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
 revision bigint not null default 1 check (revision>=1),
 rules jsonb not null,
 eligibility jsonb not null,
 organizer_confirmed boolean not null default false,
 official jsonb,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 primary key(clan_id,season),
 check(jsonb_typeof(rules)='object' and octet_length(rules::text)<=4096),
 check(jsonb_typeof(eligibility)='object' and octet_length(eligibility::text)<=65536),
 check(official is null or (jsonb_typeof(official)='object' and octet_length(official::text)<=524288))
);
alter table public.cwl_goldpass_raffles enable row level security;
revoke all on public.cwl_goldpass_raffles from public,anon,authenticated;
grant select on public.cwl_goldpass_raffles to authenticated;
create policy cwl_goldpass_owner_read on public.cwl_goldpass_raffles for select to authenticated
 using (private.cwl_is_owner(clan_id));

-- Internal function; never trust the mutable stat/import tables or the caller's
-- profile, ticket counts, winner or completeness. The status server archives
-- own lineups and group totals with service credentials.
create function private.cwl_goldpass_evidence(p_clan uuid,p_season text,p_tag text)
returns jsonb language plpgsql stable security invoker set search_path to '' as $$
declare
 g jsonb; r jsonb; m jsonb; side jsonb; members jsonb; player jsonb; attack jsonb;
 a public.cwl_own_lineup_archives%rowtype;
 n int; d int; own_matches int; actual_attacks int; expected_attacks int;
 seen_wars text[]:=array[]::text[]; days jsonb:='[]'::jsonb;
 players jsonb; good boolean;
begin
 select group_json into g from public.cwl_group_archives
 where clan_id=p_clan and season=p_season and clan_tag=p_tag;
 if g is null or g->>'season' is distinct from p_season or g->>'clanTag' is distinct from p_tag or
    jsonb_typeof(g->'clans') is distinct from 'array' or jsonb_typeof(g->'rounds') is distinct from 'array'
 then return jsonb_build_object('complete',false,'warCount',null,'ended',0,'days',days,'players','[]'::jsonb);end if;
 n:=jsonb_array_length(g->'clans')-1;
 if n not in (5,7) or jsonb_array_length(g->'rounds')<>n or
    (select count(distinct value->>'tag') from jsonb_array_elements(g->'clans'))<>n+1 or
    exists(select 1 from jsonb_array_elements(g->'clans') where coalesce(value->>'tag','') !~ '^#[0289PYLQGRJCUV]{3,15}$') or
    not exists(select 1 from jsonb_array_elements(g->'clans') where value->>'tag'=p_tag)
 then return jsonb_build_object('complete',false,'warCount',null,'ended',0,'days',days,'players','[]'::jsonb);end if;
 for d in 1..n loop
  r:=g->'rounds'->(d-1);
  if r->>'day' is distinct from d::text or jsonb_typeof(r->'matches') is distinct from 'array' then continue;end if;
  select count(*) into own_matches from jsonb_array_elements(r->'matches') x
   where p_tag in (x->'clan'->>'tag',x->'opponent'->>'tag');
  if own_matches<>1 then continue;end if;
  select value into m from jsonb_array_elements(r->'matches')
   where p_tag in (value->'clan'->>'tag',value->'opponent'->>'tag');
  if m->>'state' is distinct from 'warEnded' or m->'available' is distinct from 'true'::jsonb or
    coalesce(m->>'warTag','') !~ '^#[0289PYLQGRJCUV]{3,15}$' or m->>'warTag'=any(seen_wars) then continue;end if;
  if m->'clan'->>'tag'=p_tag and m->'opponent'->>'tag' is distinct from p_tag then side:=m->'clan';
  elsif m->'opponent'->>'tag'=p_tag and m->'clan'->>'tag' is distinct from p_tag then side:=m->'opponent';
  else continue;end if;
  select * into a from public.cwl_own_lineup_archives where clan_id=p_clan and season=p_season and day=d;
  if not found or a.state<>'warEnded' or a.war_tag is distinct from m->>'warTag' or
    a.team_size not between 1 and 50 or a.team_size::text is distinct from m->>'teamSize' or
    coalesce(side->>'attacks','') !~ '^([0-9]|[1-4][0-9]|50)$' then continue;end if;
  expected_attacks:=(side->>'attacks')::int;
  members:=a.lineup_json->'members';
  if jsonb_typeof(members) is distinct from 'array' or jsonb_array_length(members)<>a.team_size or
    (select count(distinct value->>'tag') from jsonb_array_elements(members))<>a.team_size then continue;end if;
  good:=true;actual_attacks:=0;
  for player in select value from jsonb_array_elements(members) loop
   if coalesce(player->>'tag','') !~ '^#[0289PYLQGRJCUV]{3,15}$' or
      jsonb_typeof(player->'attacks') is distinct from 'array' or jsonb_array_length(player->'attacks')>1
   then good:=false;exit;end if;
   if jsonb_array_length(player->'attacks')=1 then
    attack:=player->'attacks'->0;
    if jsonb_typeof(attack->'stars') is distinct from 'number' or coalesce(attack->>'stars','') !~ '^[0-3]$'
    then good:=false;exit;end if;
    actual_attacks:=actual_attacks+1;
   end if;
  end loop;
  if not good or actual_attacks<>expected_attacks then continue;end if;
  seen_wars:=array_append(seen_wars,m->>'warTag');
  -- Canonical order and exact per-player evidence, independent of API array order.
  days:=days||jsonb_build_array(jsonb_build_object('day',d,'warTag',a.war_tag,'teamSize',a.team_size,
    'players',(select jsonb_agg(jsonb_build_object('tag',value->>'tag',
     'name',left(coalesce(value->>'name',value->>'tag'),80),'stars',value->'attacks'->0->'stars') order by value->>'tag')
      from jsonb_array_elements(members))));
 end loop;
 with events as (
  select (x->>'day')::int as day,p->>'tag' as tag,p->>'name' as name,(p->>'stars')::int as stars
   from jsonb_array_elements(days) x cross join lateral jsonb_array_elements(x->'players') p
 ), totals as (
  select tag,(array_agg(name order by day desc))[1] as name,count(*)::int as appearances,
   count(stars)::int as attacks,coalesce(sum(stars),0)::int as stars,
   count(*) filter(where stars=1)::int as one,count(*) filter(where stars=2)::int as two,
   count(*) filter(where stars=3)::int as three,count(*) filter(where stars is null)::int as missed
  from events group by tag
 )
 select coalesce(jsonb_agg(to_jsonb(totals) order by tag),'[]'::jsonb) into players from totals;
 return jsonb_build_object('complete',jsonb_array_length(days)=n,'warCount',n,'ended',jsonb_array_length(days),
  'days',days,'players',players);
end;
$$;

create function private.cwl_goldpass_validate(p_rules jsonb,p_eligibility jsonb)
returns void language plpgsql immutable security invoker set search_path to '' as $$
declare k text; v jsonb; lim int;
begin
 if jsonb_typeof(p_rules) is distinct from 'object' or jsonb_typeof(p_eligibility) is distinct from 'object' or
    octet_length(p_rules::text)>4096 or octet_length(p_eligibility::text)>65536 or
    not (p_rules ?& array['minimumType','minimum','base','one','two','three','perStar','requireDiscord']) or
    (select count(*) from jsonb_object_keys(p_rules))<>8 or
    coalesce(p_rules->>'minimumType','') not in ('none','triples','stars','attacks') or
    jsonb_typeof(p_rules->'requireDiscord') is distinct from 'boolean'
 then raise exception 'invalid_goldpass_rules' using errcode='22023';end if;
 lim:=case p_rules->>'minimumType' when 'none' then 0 when 'stars' then 21 else 7 end;
 if jsonb_typeof(p_rules->'minimum') is distinct from 'number' or
    coalesce(p_rules->>'minimum','') !~ '^[0-9]{1,2}$' or (p_rules->>'minimum')::int>lim
 then raise exception 'invalid_goldpass_minimum' using errcode='22023';end if;
 foreach k in array array['base','one','two','three','perStar'] loop
  if jsonb_typeof(p_rules->k) is distinct from 'number' or coalesce(p_rules->>k,'') !~ '^([0-9]|[1-9][0-9]|100)$'
  then raise exception 'invalid_goldpass_weight' using errcode='22023';end if;
 end loop;
 if (select count(*) from jsonb_object_keys(p_eligibility))>350 then raise exception 'invalid_goldpass_eligibility' using errcode='22023';end if;
 for k,v in select key,value from jsonb_each(p_eligibility) loop
  if k !~ '^#[0289PYLQGRJCUV]{3,15}$' or jsonb_typeof(v) is distinct from 'object' or
    exists(select 1 from jsonb_each(v) e where e.key not in ('organizer','excluded','discord','override') or jsonb_typeof(e.value)<>'boolean')
  then raise exception 'invalid_goldpass_eligibility' using errcode='22023';end if;
 end loop;
end;
$$;

create function private.cwl_goldpass_preview(evidence jsonb,rules jsonb,eligibility jsonb)
returns jsonb language sql immutable security invoker set search_path to '' as $$
 with p as (
  select value as player,coalesce(eligibility->(value->>'tag'),'{}'::jsonb) as decision
  from jsonb_array_elements(evidence->'players')
 ), conditions as (
  select *,case
   when decision->'organizer'='true'::jsonb then 'organizer'
   when decision->'excluded'='true'::jsonb then 'manual_exclusion'
   when rules->'requireDiscord'='true'::jsonb and decision->'discord' is distinct from 'true'::jsonb then 'discord_unconfirmed'
   when decision->'override' is distinct from 'true'::jsonb and
    (case rules->>'minimumType' when 'triples' then (player->>'three')::int when 'stars' then (player->>'stars')::int
      when 'attacks' then (player->>'attacks')::int else 0 end)<(rules->>'minimum')::int then 'minimum_not_met'
   else null end reason
  from p
 ), weights as (
  select player,decision,reason,case when reason is not null then 0 else
   (rules->>'base')::int+(rules->>'one')::int*(player->>'one')::int+
   (rules->>'two')::int*(player->>'two')::int+(rules->>'three')::int*(player->>'three')::int+
   (rules->>'perStar')::int*(player->>'stars')::int end as tickets from conditions
 ), pool as (select coalesce(sum(tickets),0)::int total from weights)
 select jsonb_build_object('total',pool.total,'rows',coalesce(
   (select jsonb_agg(player||jsonb_build_object('decision',decision,'tickets',tickets,
     'eligible',tickets>0,'reason',coalesce(reason,case when tickets=0 then 'no_tickets' else '' end),
     'probability',case when pool.total>0 then tickets::numeric/pool.total else 0 end)
     order by player->>'tag') from weights),'[]'::jsonb)) from pool;
$$;

-- Single owner-checked privileged entry point in a non-exposed schema.
-- All writes serialized per clan/season. A stale browser cannot overwrite the
-- rules or draw against changed evidence. The official JSON is immutable.
create function private.cwl_goldpass_manage(
 p_clan uuid,p_season text,p_action text,p_expected_revision bigint default null,
 p_rules jsonb default null,p_eligibility jsonb default null,p_organizer_confirmed boolean default null,
 p_expected_witness text default null
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
 actor uuid:=auth.uid(); own text; saved public.cwl_goldpass_raffles%rowtype;
 exists_row boolean; rules jsonb; eligibility jsonb; confirmed boolean; rev bigint;
 evidence jsonb; preview jsonb; witness text; total int; ticket bigint; pos bigint; limit_n bigint;
 bytes bytea; rnd bigint; winner jsonb; entry jsonb; result_official jsonb;
begin
 if actor is null or p_clan is null or p_season is null or p_season !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or
    p_action is null or p_action not in ('read','save','draw') then raise exception 'invalid_goldpass_request' using errcode='22023';end if;
 select clash_tag into own from public.cwl_clans where id=p_clan and owner_user_id=actor for share;
 if not found or coalesce(own,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' then raise exception 'goldpass_owner_only' using errcode='42501';end if;
 if p_action<>'read' then perform pg_advisory_xact_lock(hashtextextended('goldpass:'||p_clan::text||':'||p_season,0));end if;
 select * into saved from public.cwl_goldpass_raffles where clan_id=p_clan and season=p_season;
 exists_row:=found;
 if exists_row and saved.clan_tag<>own then raise exception 'goldpass_clan_link_changed' using errcode='22023';end if;
 if exists_row and saved.official is not null then
  if p_action='save' then raise exception 'goldpass_already_drawn' using errcode='22023';end if;
  -- Idempotent retry: never draw a second winner.
  return jsonb_build_object('revision',saved.revision,'rules',saved.rules,'eligibility',saved.eligibility,
    'organizerConfirmed',saved.organizer_confirmed,'official',saved.official);
 end if;
 rev:=coalesce(saved.revision,0);
 rules:=coalesce(saved.rules,'{"minimumType":"none","minimum":0,"base":1,"one":0,"two":0,"three":2,"perStar":0,"requireDiscord":false}'::jsonb);
 eligibility:=coalesce(saved.eligibility,'{}'::jsonb);confirmed:=coalesce(saved.organizer_confirmed,false);
 if p_action='save' then
  if p_expected_revision is distinct from rev then raise exception 'goldpass_revision_conflict' using errcode='40001';end if;
  perform private.cwl_goldpass_validate(p_rules,p_eligibility);
  if p_organizer_confirmed is null then raise exception 'goldpass_organizer_check_required' using errcode='22023';end if;
  rules:=p_rules;eligibility:=p_eligibility;confirmed:=p_organizer_confirmed;
  insert into public.cwl_goldpass_raffles(clan_id,season,clan_tag,rules,eligibility,organizer_confirmed,updated_by)
   values(p_clan,p_season,own,rules,eligibility,confirmed,actor)
   on conflict(clan_id,season) do update set rules=excluded.rules,eligibility=excluded.eligibility,
    organizer_confirmed=excluded.organizer_confirmed,revision=cwl_goldpass_raffles.revision+1,
    updated_at=now(),updated_by=actor returning revision into rev;
 end if;
 evidence:=private.cwl_goldpass_evidence(p_clan,p_season,own);
 preview:=private.cwl_goldpass_preview(evidence,rules,eligibility);
 witness:=encode(extensions.digest(jsonb_build_object('version',1,'clan',p_clan,'season',p_season,
  'revision',rev,'rules',rules,'eligibility',eligibility,'organizerConfirmed',confirmed,'evidence',evidence)::text,'sha256'),'hex');
 if p_action='draw' then
  if not exists_row or p_expected_revision is distinct from rev or p_expected_witness is distinct from witness
    then raise exception 'goldpass_revision_or_evidence_changed' using errcode='40001';end if;
  if not confirmed then raise exception 'goldpass_organizer_check_required' using errcode='22023';end if;
  if evidence->'complete' is distinct from 'true'::jsonb then raise exception 'goldpass_incomplete_results' using errcode='22023';end if;
  total:=(preview->>'total')::int;
  if total<1 then raise exception 'goldpass_no_tickets' using errcode='22023';end if;
  -- Uniform integer in [0,total); rejection prevents modulo bias.
  limit_n:=(4294967296::bigint/total)*total;
  loop
   bytes:=extensions.gen_random_bytes(4);
   rnd:=get_byte(bytes,0)::bigint*16777216+get_byte(bytes,1)::bigint*65536+get_byte(bytes,2)::bigint*256+get_byte(bytes,3);
   exit when rnd<limit_n;
  end loop;
  ticket:=rnd%total;pos:=ticket;
  for entry in select value from jsonb_array_elements(preview->'rows') loop
   if pos<(entry->>'tickets')::int then winner:=entry;exit;end if;
   pos:=pos-(entry->>'tickets')::int;
  end loop;
  if winner is null then raise exception 'goldpass_invalid_pool';end if;
  result_official:=jsonb_build_object('version',1,'season',p_season,'clanTag',own,'drawnAt',now(),
   'drawnBy',actor,'rules',rules,'eligibility',eligibility,'organizerConfirmed',confirmed,
   'evidence',evidence,'preview',preview,'witness',witness,'ticket',ticket,'winnerTag',winner->>'tag','winnerName',winner->>'name');
  update public.cwl_goldpass_raffles set official=result_official,revision=rev+1,updated_at=now(),updated_by=actor
   where clan_id=p_clan and season=p_season and revision=rev and cwl_goldpass_raffles.official is null;
  if not found then raise exception 'goldpass_revision_conflict' using errcode='40001';end if;
  rev:=rev+1;
 end if;
 return jsonb_build_object('revision',rev,'rules',rules,'eligibility',eligibility,'organizerConfirmed',confirmed,
   'evidence',evidence,'preview',preview,'witness',witness,'official',result_official);
end;
$$;

create function public.cwl_goldpass_manage(
 p_clan uuid,p_season text,p_action text,p_expected_revision bigint default null,
 p_rules jsonb default null,p_eligibility jsonb default null,p_organizer_confirmed boolean default null,
 p_expected_witness text default null
) returns jsonb language sql security invoker set search_path to '' as $$
 select private.cwl_goldpass_manage(p_clan,p_season,p_action,p_expected_revision,p_rules,p_eligibility,p_organizer_confirmed,p_expected_witness)
$$;
revoke all on function private.cwl_goldpass_evidence(uuid,text,text) from public,anon,authenticated;
revoke all on function private.cwl_goldpass_validate(jsonb,jsonb) from public,anon,authenticated;
revoke all on function private.cwl_goldpass_preview(jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function private.cwl_goldpass_manage(uuid,text,text,bigint,jsonb,jsonb,boolean,text) from public,anon,authenticated;
revoke all on function public.cwl_goldpass_manage(uuid,text,text,bigint,jsonb,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function private.cwl_goldpass_manage(uuid,text,text,bigint,jsonb,jsonb,boolean,text) to authenticated;
grant execute on function public.cwl_goldpass_manage(uuid,text,text,bigint,jsonb,jsonb,boolean,text) to authenticated;
