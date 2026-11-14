-- v1.22.2: new, separately named atomic RPC to reconcile legacy global
-- per-war attack numbers against the ORIGINAL ClashPerk Excel evidence.
-- Runs ONLY on the user's explicit import, under existing RLS/owner/editor,
-- never updates an API source or unrelated clan; any discrepancy rolls back.
-- The previous verified RPC stays installed for older clients.
--
-- #292 | Introduce a NEW, separately named verified-import RPC instead of
-- changing behavior for cached clients of the old atomic importer.
-- Replace the 8-hour metadata-only API skip with a server-verified
-- same-war match. This is additive: original API and ClashPerk evidence
-- remain intact, RLS/owner authorization and the atomic transaction remain.
-- An ambiguous/partial match aborts the entire import, never guesses.
create or replace function public.cwl_import_clashperk_canonical_atomic(
 p_clan uuid,p_payload jsonb
) returns jsonb language plpgsql security invoker
set search_path = ''
as $$
declare
 v_clan_tag text;
 v_api_candidate public.cwl_stat_wars%rowtype;
 v_payload_signature jsonb;
 v_candidate_signature jsonb;
 v_payload_attack_count integer;
 v_candidate_attack_count integer;
 v_api_candidate_count integer;
 v_verified_api_count integer;
 v_matched_api_key text;
 v_claimed_api_keys text[] := array[]::text[];
 v_war jsonb;
 v_attack jsonb;
 v_missed jsonb;
 v_key text;
 v_type text;
 v_opponent text;
 v_start timestamptz;
 v_team integer;
 v_order integer;
 v_stars integer;
 v_destroy integer;
 v_th integer;
 v_def_th integer;
 v_count integer;
 v_attacker text;
 v_defender text;
 v_player text;
 v_old public.cwl_stat_wars%rowtype;
 v_existing_attack public.cwl_stat_attacks%rowtype;
 v_saved_attacks integer;
 v_rekeyed integer;
 v_rekeyed_total integer := 0;
 v_legacy_orders integer;
 v_existing_missed public.cwl_stat_missed%rowtype;
 v_war_keys text[] := array[]::text[];
 v_apply_keys text[] := array[]::text[];
 v_skip_keys text[] := array[]::text[];
 v_inserted integer := 0;
 v_extended integer := 0;
 v_api_skipped integer := 0;
 v_attack_count integer := 0;
 v_missed_count integer := 0;
 v_completed integer := 0;
 v_player_count integer;
 v_capacity_ok boolean;
 v_excess boolean;
 v_tags jsonb;
 v_need integer;
begin
 if p_clan is null or (select auth.uid()) is null or
    not coalesce(private.cwl_can_edit(p_clan),false) then
  raise exception 'ClashPerk-Import requires an authorized owner or editor'
    using errcode='42501';
 end if;
 -- Every concurrent import for this application clan serializes here.
 -- Never use an arbitrary Clash tag as authorization for another app tenant.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_clan::text,424242));
 select upper(c.clash_tag) into v_clan_tag
 from public.cwl_clans c where c.id=p_clan;
 if v_clan_tag is null or
    v_clan_tag is distinct from upper(p_payload->>'clanTag') or
    v_clan_tag !~ '^#[0289PYLQGRJCUV]{3,15}$' then
  raise exception 'ClashPerk upload does not match the selected clan'
    using errcode='22023';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or
    jsonb_typeof(p_payload->'wars') is distinct from 'array' or
    jsonb_typeof(p_payload->'attacks') is distinct from 'array' or
    jsonb_typeof(p_payload->'missed') is distinct from 'array' or
    jsonb_array_length(p_payload->'wars') not between 1 and 1000 or
    jsonb_array_length(p_payload->'attacks') > 20000 or
    jsonb_array_length(p_payload->'missed') > 4000 or
    pg_catalog.octet_length(p_payload::text)>9000000 then
  raise exception 'Invalid or oversized ClashPerk import' using errcode='22023';
 end if;
 -- Validate duplicate event identities once with a hash aggregation, instead
 -- of scanning an ever-growing array once per attack (quadratic at 20k).
 if exists (
   select 1 from pg_catalog.jsonb_array_elements(p_payload->'attacks') as a(value)
   group by a.value->>'war_key',upper(a.value->>'attacker_tag'),a.value->>'attack_order'
   having count(*)>1
 ) then
  raise exception 'Duplicate attack in ClashPerk payload' using errcode='22023';
 end if;
 if exists (
   select 1 from pg_catalog.jsonb_array_elements(p_payload->'missed') as m(value)
   group by m.value->>'war_key',upper(m.value->>'player_tag')
   having count(*)>1
 ) then
  raise exception 'Duplicate missed-attack record' using errcode='22023';
 end if;
 -- Validate every incoming War ID and full identity before writing data.
 for v_war in select value from jsonb_array_elements(p_payload->'wars') loop
  v_key:=v_war->>'war_key';
  v_type:=v_war->>'war_type';
  v_opponent:=upper(v_war->>'opponent_tag');
  if coalesce(v_key,'') !~ '^cp:[0-9]{1,20}$' or
     v_key=any(v_war_keys) or
     v_type not in ('normal','cwl') or
     coalesce(v_opponent,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' or
     coalesce(v_war->>'team_size','') !~ '^[0-9]{1,2}$' or
     length(coalesce(v_war->>'opponent_name',''))>80 or
     coalesce(v_war->>'started_at','') !~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' then
   raise exception 'Invalid or duplicate ClashPerk war data' using errcode='22023';
  end if;
  v_team:=(v_war->>'team_size')::integer;
  if v_team not between 1 and 50 then
   raise exception 'Invalid ClashPerk team size' using errcode='22023';
  end if;
  v_start:=(v_war->>'started_at')::timestamptz;
  if v_start < '2012-01-01'::timestamptz or
     v_start > now()-interval '72 hours' then
   raise exception 'Unverified recent or invalid ClashPerk war' using errcode='22023';
  end if;
  v_war_keys:=array_append(v_war_keys,v_key);
  select * into v_old from public.cwl_stat_wars
   where clan_id=p_clan and war_key=v_key for update;
  if found then
   if v_old.source<>'import' or v_old.war_type<>v_type or
      upper(v_old.opponent_tag) is distinct from v_opponent or
      v_old.team_size<>v_team or
      abs(extract(epoch from (v_old.started_at-v_start)))>8*3600 then
    raise exception 'Existing ClashPerk War ID conflicts with verified war' using errcode='23505';
   end if;
   v_extended:=v_extended+1;
   -- An uploaded Missed-only Excel has no attack records. Preserve all
   -- historical technical keys and only append independently proven misses.
   -- Never require full Attack-Log evidence for a Missed-only follow-up.
   if exists (
     select 1 from pg_catalog.jsonb_array_elements(p_payload->'attacks') x(value)
     where x.value->>'war_key'=v_key
   ) then
   -- Historical ClashPerk v1 imports stored the GLOBAL war attack number
   -- (e.g. 11,45) as attack_order. New XLSX exports normalize EACH
   -- player's attacks to 1/2. A naive ON CONFLICT would reject a harmless
   -- reimport or incorrectly count a second copy as another attack.
   --
   -- Before changing any technical key, PROVE that every previously saved
   -- attack (player, target, stars, destruction, including duplicates)
   -- is present in the NEW original attack export. Otherwise do nothing:
   -- the entire single-RPC transaction rolls back with all old data intact.
   if exists(
     select a.attacker_tag,upper(a.defender_tag),a.stars,a.destruction
       from public.cwl_stat_attacks a
       where a.clan_id=p_clan and a.war_key=v_key
     except all
     select upper(x.value->>'attacker_tag'),
            upper(x.value->>'defender_tag'),
            (x.value->>'stars')::integer,
            (x.value->>'destruction')::integer
       from pg_catalog.jsonb_array_elements(p_payload->'attacks') x(value)
       where x.value->>'war_key'=v_key
   ) then
     raise exception 'Stored ClashPerk attack evidence differs in war %; no changes saved',v_key
       using errcode='23505';
   end if;
   select count(*)::integer,
          count(*) filter (where a.attack_order >
            (case when v_type='cwl' then 1 else 2 end))::integer
      into v_saved_attacks,v_legacy_orders
     from public.cwl_stat_attacks a
     where a.clan_id=p_clan and a.war_key=v_key;
   if v_saved_attacks>0 then
     -- Staged numbers 151/152 are inside the existing 0..200 CHECK.
     -- Never overwrite a pre-existing staged key. The two-step update
     -- prevents transient UNIQUE collisions on the composite primary key.
     if exists(
       select 1 from public.cwl_stat_attacks a
        where a.clan_id=p_clan and a.war_key=v_key
          and a.attack_order>=150
     ) then
       raise exception 'Legacy attack numbering needs manual review for war %',v_key
         using errcode='23505';
     end if;
     with old_rows as (
       select a.attacker_tag,a.attack_order,
              upper(a.defender_tag) as defender_tag,a.stars,a.destruction,
              row_number() over (
                partition by a.attacker_tag,upper(a.defender_tag),a.stars,a.destruction
                order by a.attack_order
              ) as occurrence
       from public.cwl_stat_attacks a
       where a.clan_id=p_clan and a.war_key=v_key
     ),new_rows as (
       select upper(x.value->>'attacker_tag') as attacker_tag,
              upper(x.value->>'defender_tag') as defender_tag,
              (x.value->>'stars')::integer as stars,
              (x.value->>'destruction')::integer as destruction,
              (x.value->>'attack_order')::integer as new_order,
              row_number() over (
                partition by upper(x.value->>'attacker_tag'),
                             upper(x.value->>'defender_tag'),
                             x.value->>'stars',x.value->>'destruction'
                order by (x.value->>'attack_order')::integer
              ) as occurrence
       from pg_catalog.jsonb_array_elements(p_payload->'attacks') x(value)
       where x.value->>'war_key'=v_key
     ),mapped as (
       select o.attacker_tag,o.attack_order,n.new_order
       from old_rows o join new_rows n on
         n.attacker_tag=o.attacker_tag and n.defender_tag=o.defender_tag
         and n.stars=o.stars and n.destruction=o.destruction
         and n.occurrence=o.occurrence
     )
     update public.cwl_stat_attacks a
        set attack_order=150+mapped.new_order
       from mapped
       where a.clan_id=p_clan and a.war_key=v_key
         and a.attacker_tag=mapped.attacker_tag
         and a.attack_order=mapped.attack_order;
     get diagnostics v_rekeyed=row_count;
     if v_rekeyed<>v_saved_attacks then
       raise exception 'Cannot prove complete legacy attack mapping in war %',v_key
         using errcode='23505';
     end if;
     update public.cwl_stat_attacks a
        set attack_order=a.attack_order-150
       where a.clan_id=p_clan and a.war_key=v_key
         and a.attack_order between 151 and 152;
     get diagnostics v_rekeyed=row_count;
     if v_rekeyed<>v_saved_attacks then
       raise exception 'Incomplete legacy attack order normalization in war %',v_key
         using errcode='23505';
     end if;
     -- Count only *noncanonical* legacy IDs in the user-facing summary.
     -- Reuploading an already normalized war reports zero corrections.
     v_rekeyed_total:=v_rekeyed_total+v_legacy_orders;
   end if;
   end if;
  else
   -- The official API and ClashPerk can report the same completed war
   -- under different IDs and timestamps (observed exactly 24h apart).
   -- Check the ENTIRE attack multiset, including duplicate counts and
   -- destruction, inside the authorized single-tenant SQL transaction.
   -- Never skip a verified import silently: its Missed evidence is valuable.
   select count(*) into v_api_candidate_count
   from public.cwl_stat_wars w
   where w.clan_id=p_clan and w.source='api'
     and w.war_type=v_type and upper(w.opponent_tag)=v_opponent
     and w.team_size=v_team
     and abs(extract(epoch from (w.started_at-v_start)))<=36*3600;
   if v_api_candidate_count>0 then
    select coalesce(pg_catalog.jsonb_agg(t.sig order by t.sig::text),'[]'::jsonb),
           count(*)::integer
      into v_payload_signature,v_payload_attack_count
    from (
      select pg_catalog.jsonb_build_array(
        upper(x.value->>'attacker_tag'),upper(x.value->>'defender_tag'),
        x.value->>'stars',x.value->>'destruction') as sig
      from pg_catalog.jsonb_array_elements(p_payload->'attacks') x(value)
      where x.value->>'war_key'=v_key
    ) t;
    if v_payload_attack_count<2 then
     raise exception 'API/ClashPerk overlap requires complete attack evidence'
       using errcode='23505';
    end if;
    v_verified_api_count:=0;
    v_matched_api_key:=null;
    for v_api_candidate in
     select * from public.cwl_stat_wars w
      where w.clan_id=p_clan and w.source='api' and w.finalized=true
       and w.war_type=v_type and upper(w.opponent_tag)=v_opponent
       and w.team_size=v_team
       and abs(extract(epoch from (w.started_at-v_start)))<=36*3600
    loop
     select coalesce(pg_catalog.jsonb_agg(t.sig order by t.sig::text),'[]'::jsonb),
            count(*)::integer
       into v_candidate_signature,v_candidate_attack_count
     from (
       select pg_catalog.jsonb_build_array(
         upper(a.attacker_tag),upper(a.defender_tag),
         a.stars::text,a.destruction::text) as sig
       from public.cwl_stat_attacks a
       where a.clan_id=p_clan and a.war_key=v_api_candidate.war_key
     ) t;
     if v_payload_attack_count=v_candidate_attack_count and
        v_payload_signature=v_candidate_signature then
      v_verified_api_count:=v_verified_api_count+1;
      v_matched_api_key:=v_api_candidate.war_key;
     end if;
    end loop;
    if v_verified_api_count<>1 then
     raise exception 'API/ClashPerk identity is ambiguous or attacks differ; no changes saved'
       using errcode='23505';
    end if;
    if v_matched_api_key=any(v_claimed_api_keys) then
     raise exception 'Two ClashPerk War IDs refer to the same API war'
       using errcode='23505';
    end if;
    v_claimed_api_keys:=array_append(v_claimed_api_keys,v_matched_api_key);
   end if;
   if exists(
      select 1 from public.cwl_stat_wars w where w.clan_id=p_clan
       and w.source='import' and w.war_type=v_type
       and upper(w.opponent_tag)=v_opponent and w.team_size=v_team
       and abs(extract(epoch from (w.started_at-v_start)))<=8*3600
   ) then
    raise exception 'Existing imported war needs identity review' using errcode='23505';
   end if;
   insert into public.cwl_stat_wars(
     clan_id,war_key,war_type,started_at,team_size,opponent_tag,
     opponent_name,source,roster_tags,finalized,missed_log_complete)
   values(p_clan,v_key,v_type,v_start,v_team,v_opponent,
     coalesce(v_war->>'opponent_name',''),'import',null,false,false)
   on conflict (clan_id,war_key) do nothing;
   select * into v_old from public.cwl_stat_wars
    where clan_id=p_clan and war_key=v_key for update;
   if v_old.source is distinct from 'import' or
      v_old.war_type is distinct from v_type or
      upper(v_old.opponent_tag) is distinct from v_opponent then
    raise exception 'Concurrent war identity conflict' using errcode='23505';
   end if;
   v_inserted:=v_inserted+1;
  end if;
  v_apply_keys:=array_append(v_apply_keys,v_key);
 end loop;
 -- Each original attack has a unique per-player order produced from the
 -- ClashPerk global attack index. Do not accept 0 or duplicate orders.
 for v_attack in select value from jsonb_array_elements(p_payload->'attacks') loop
  v_key:=v_attack->>'war_key';
  v_attacker:=upper(v_attack->>'attacker_tag');
  v_defender:=upper(v_attack->>'defender_tag');
  if not(v_key=any(v_war_keys)) or
     coalesce(v_attacker,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' or
     coalesce(v_defender,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' or
     coalesce(v_attack->>'attack_order','') !~ '^[0-9]{1,2}$' or
     coalesce(v_attack->>'stars','') !~ '^[0-3]$' or
     coalesce(v_attack->>'destruction','') !~ '^([0-9]{1,2}|100)$' or
     length(coalesce(v_attack->>'attacker_name',''))>80 or
     length(coalesce(v_attack->>'defender_name',''))>80 then
   raise exception 'Invalid attack record in ClashPerk import' using errcode='22023';
  end if;
  v_order:=(v_attack->>'attack_order')::integer;
  v_stars:=(v_attack->>'stars')::integer;
  v_destroy:=(v_attack->>'destruction')::integer;
  if v_key=any(v_skip_keys) then continue; end if;
  select w.war_type into v_type from public.cwl_stat_wars w
   where w.clan_id=p_clan and w.war_key=v_key;
  if v_order<1 or v_order>(case when v_type='cwl' then 1 else 2 end) then
   raise exception 'Attack count exceeds war rules' using errcode='22023';
  end if;
  if (v_attack->>'attacker_th') is not null and
      (coalesce(v_attack->>'attacker_th','') !~ '^[0-9]{1,2}$' or
      (v_attack->>'attacker_th')::integer not between 3 and 30) then
   raise exception 'Invalid attacking Town Hall' using errcode='22023';
  end if;
  if (v_attack->>'defender_th') is not null and
      (coalesce(v_attack->>'defender_th','') !~ '^[0-9]{1,2}$' or
      (v_attack->>'defender_th')::integer not between 3 and 30) then
   raise exception 'Invalid defending Town Hall' using errcode='22023';
  end if;
  v_th:=(v_attack->>'attacker_th')::integer;
  v_def_th:=(v_attack->>'defender_th')::integer;
  insert into public.cwl_stat_attacks (
   clan_id,war_key,attacker_tag,attack_order,attacker_name,attacker_th,
   defender_tag,defender_name,defender_th,stars,destruction
  ) values(
   p_clan,v_key,v_attacker,v_order,coalesce(v_attack->>'attacker_name',''),
   v_th,v_defender,coalesce(v_attack->>'defender_name',''),
   v_def_th,v_stars,v_destroy
  ) on conflict (clan_id,war_key,attacker_tag,attack_order) do nothing;
  select * into v_existing_attack from public.cwl_stat_attacks
   where clan_id=p_clan and war_key=v_key
     and attacker_tag=v_attacker and attack_order=v_order;
  if v_existing_attack.stars is distinct from v_stars or
     v_existing_attack.destruction is distinct from v_destroy or
     upper(v_existing_attack.defender_tag) is distinct from v_defender then
   raise exception 'Conflict with previously stored attack' using errcode='23505';
  end if;
  v_attack_count:=v_attack_count+1;
 end loop;
 for v_missed in select value from jsonb_array_elements(p_payload->'missed') loop
  v_key:=v_missed->>'war_key';
  v_player:=upper(v_missed->>'player_tag');
  if not(v_key=any(v_war_keys)) or
     coalesce(v_player,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' or
     coalesce(v_missed->>'missed_count','') !~ '^[12]$' or
     length(coalesce(v_missed->>'player_name',''))>80 then
   raise exception 'Invalid missed-attack record' using errcode='22023';
  end if;
  v_count:=(v_missed->>'missed_count')::integer;
  if v_key=any(v_skip_keys) then continue; end if;
  select w.war_type into v_type from public.cwl_stat_wars w
   where w.clan_id=p_clan and w.war_key=v_key;
  if v_type='cwl' and v_count<>1 then
   raise exception 'CWL missed count exceeds one attack' using errcode='22023';
  end if;
  insert into public.cwl_stat_missed (
    clan_id,war_key,player_tag,player_name,missed_count
  ) values(
    p_clan,v_key,v_player,coalesce(v_missed->>'player_name',''),v_count
  ) on conflict (clan_id,war_key,player_tag) do nothing;
  select * into v_existing_missed from public.cwl_stat_missed
   where clan_id=p_clan and war_key=v_key and player_tag=v_player;
  if v_existing_missed.missed_count is distinct from v_count then
   raise exception 'Conflicting missed-attack evidence' using errcode='23505';
  end if;
  v_missed_count:=v_missed_count+1;
 end loop;
 -- A single RPC invocation is one PostgreSQL transaction: any exception,
 -- including an RLS failure or a late duplicate conflict, rolls back ALL
 -- of the inserted wars, attacks, missed records and finalizations.
 foreach v_key in array v_apply_keys loop
  select w.team_size, (case when w.war_type='cwl' then 1 else 2 end)
    into v_team,v_need from public.cwl_stat_wars w
    where w.clan_id=p_clan and w.war_key=v_key;
  select count(*)::integer,coalesce(bool_and(x.slots=v_need),false),
    coalesce(bool_or(x.slots>v_need),false),
    coalesce(jsonb_agg(x.player_tag order by x.player_tag),'[]'::jsonb)
    into v_player_count,v_capacity_ok,v_excess,v_tags
  from (
   select e.player_tag,sum(e.slots)::integer as slots
   from (
    select a.attacker_tag as player_tag,count(*)::integer as slots
      from public.cwl_stat_attacks a
      where a.clan_id=p_clan and a.war_key=v_key
      group by a.attacker_tag
    union all
    select m.player_tag,sum(m.missed_count)::integer as slots
      from public.cwl_stat_missed m
      where m.clan_id=p_clan and m.war_key=v_key
      group by m.player_tag
   ) e group by e.player_tag
  ) x;
  if v_excess or v_player_count>v_team then
   raise exception 'Attack and missed totals exceed war roster capacity'
     using errcode='22023';
  end if;
  update public.cwl_stat_wars w set
    finalized=true,
    missed_log_complete=(v_player_count=v_team and v_capacity_ok),
    roster_tags=case when v_player_count=v_team and v_capacity_ok
         then v_tags else null end
   where w.clan_id=p_clan and w.war_key=v_key and w.source='import';
  if not found then
   raise exception 'Import lost authorized war identity during commit'
     using errcode='42501';
  end if;
  if v_player_count=v_team and v_capacity_ok then
   v_completed:=v_completed+1;
  end if;
 end loop;
 return jsonb_build_object(
   'inserted',v_inserted,'extended',v_extended,'skippedApi',v_api_skipped,
   'attacks',v_attack_count,'missed',v_missed_count,'completeWars',v_completed,
   'reconciledLegacyAttacks',v_rekeyed_total
 );
end
$$;
-- Never expose a privileged function through the implicit PUBLIC grant.
revoke all on function public.cwl_import_clashperk_canonical_atomic(uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.cwl_import_clashperk_canonical_atomic(uuid,jsonb)
 to authenticated;
