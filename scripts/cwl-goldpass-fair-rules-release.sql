-- Additive CWL raffle rules. Deploy together with the updated UI after CI.
-- Legacy rules without the optional weights retain exactly their prior meaning.
-- Stored official JSON, existing rows and privileges are not modified.
create or replace function private.cwl_goldpass_validate(p_rules jsonb,p_eligibility jsonb)
returns void language plpgsql immutable security invoker set search_path to '' as $$
declare k text; v jsonb; lim int;
begin
 if jsonb_typeof(p_rules) is distinct from 'object' or jsonb_typeof(p_eligibility) is distinct from 'object' or
    octet_length(p_rules::text)>4096 or octet_length(p_eligibility::text)>65536 or
    not (p_rules ?& array['minimumType','minimum','base','one','two','three','perStar','requireDiscord']) or
    exists(select 1 from jsonb_object_keys(p_rules) as keys(key) where keys.key not in ('minimumType','minimum','base','one','two','three','perStar','requireDiscord','perAttack','highBonus','perfectBonus')) or
    coalesce(p_rules->>'minimumType','') not in ('none','triples','stars','attacks') or
    jsonb_typeof(p_rules->'requireDiscord') is distinct from 'boolean'
 then raise exception 'invalid_goldpass_rules' using errcode='22023';end if;
 lim:=case p_rules->>'minimumType' when 'none' then 0 when 'stars' then 21 else 7 end;
 if jsonb_typeof(p_rules->'minimum') is distinct from 'number' or
    coalesce(p_rules->>'minimum','') !~ '^[0-9]{1,2}$' or (p_rules->>'minimum')::int>lim
 then raise exception 'invalid_goldpass_minimum' using errcode='22023';end if;
 foreach k in array array['base','one','two','three','perStar','perAttack','highBonus','perfectBonus'] loop
  if k in ('perAttack','highBonus','perfectBonus') and not (p_rules ? k) then continue;end if;
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

create or replace function private.cwl_goldpass_preview(evidence jsonb,rules jsonb,eligibility jsonb)
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
   (rules->>'perStar')::int*(player->>'stars')::int+
   coalesce((rules->>'perAttack')::int,0)*(player->>'attacks')::int+
   case when (player->>'stars')::int>=case when evidence->>'warCount'='5' then 14 else 19 end then coalesce((rules->>'highBonus')::int,0) else 0 end+
   case when (player->>'stars')::int>=case when evidence->>'warCount'='5' then 15 else 21 end then coalesce((rules->>'perfectBonus')::int,0) else 0 end end as tickets from conditions
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
create or replace function private.cwl_goldpass_manage(
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
 rules:=coalesce(saved.rules,'{"minimumType":"none","minimum":0,"base":0,"one":0,"two":0,"three":1,"perStar":0,"requireDiscord":false,"perAttack":1,"highBonus":1,"perfectBonus":1}'::jsonb);
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

