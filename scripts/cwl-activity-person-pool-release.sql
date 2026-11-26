-- Requires cwl-activity-member-marks-release.sql. Optional one-ticket-per-person mode.
-- Legacy campaigns and immutable official snapshots retain their original semantics.
create or replace function private.cwl_activity_manage(
 p_clan uuid,p_action text,p_id uuid default null,p_revision bigint default null,
 p_title text default null,p_start date default null,p_end date default null,
 p_rules jsonb default null,p_decisions jsonb default null,p_witness text default null,
 p_player text default null,p_discord boolean default null
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
 actor uuid:=auth.uid(); own text; c public.cwl_activity_campaigns%rowtype;
 today date:=(now() at time zone 'Europe/Vienna')::date;
 rule jsonb; k text; v jsonb; players jsonb; player jsonb; decision jsonb; checks jsonb;
 rows jsonb:='[]'::jsonb; pool jsonb:='[]'::jsonb; state text; met boolean; metric_value bigint;
 unknown_count int:=0; witness text; total int; rnd bigint; lim bigint; bytes bytea; winner jsonb; one_per_person boolean; group_key text; group_organizer boolean;
begin
 select clash_tag into own from public.cwl_clans where id=p_clan and owner_user_id=actor for share;
 if actor is null or not found or coalesce(own,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' then
 raise exception 'activity_owner_only' using errcode='42501';end if;
 if p_action='list' then
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'start',start_date,'end',end_date,'revision',revision,'drawn',official is not null) order by start_date desc,created_at desc),'[]'::jsonb)
 from public.cwl_activity_campaigns where clan_id=p_clan and clan_tag=own);
 end if;
 if p_action='discord' then
  if coalesce(p_player,'') !~ '^#[0289PYLQGRJCUV]{3,15}$' or not exists(select 1 from public.cwl_clan_member_tenure
   where clan_id=p_clan and source_clash_tag=own and player_tag=p_player) then raise exception 'invalid_player';end if;
  if p_discord is null then delete from public.cwl_activity_member_marks where clan_id=p_clan and clan_tag=own and player_tag=p_player;
  else insert into public.cwl_activity_member_marks(clan_id,clan_tag,player_tag,discord) values(p_clan,own,p_player,p_discord)
   on conflict(clan_id,clan_tag,player_tag) do update set discord=excluded.discord,updated_at=now();end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action not in ('create','read','save','draw') or p_action is null then raise exception 'invalid_activity_action';end if;
 if p_action='create' then
  if p_id is null or p_start is null or p_end is null or p_start<today or p_end<p_start or p_end-p_start>=366
  or length(trim(coalesce(p_title,''))) not between 1 and 80 then raise exception 'invalid_activity_period';end if;
 else
  select * into c from public.cwl_activity_campaigns where id=p_id and clan_id=p_clan and clan_tag=own for update;
  if not found then raise exception 'activity_not_found' using errcode='42501';end if;
  if c.official is not null then
   if p_action='save' then raise exception 'activity_already_drawn';end if;
   return jsonb_build_object('id',c.id,'title',c.title,'start',c.start_date,'end',c.end_date,'revision',c.revision,'rules',c.rules,'decisions',c.decisions,'official',c.official);
  end if;
  if p_action in ('save','draw') and p_revision is distinct from c.revision then raise exception 'activity_revision_conflict' using errcode='40001';end if;
 end if;
 if p_action in ('create','save') then
  if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) not between 1 and 10 or
   not exists(select 1 from jsonb_array_elements(p_rules) r where r->>'metric'<>'onePerPerson') or
   (select count(distinct value->>'metric') from jsonb_array_elements(p_rules))<>jsonb_array_length(p_rules) or
   jsonb_typeof(p_decisions) is distinct from 'object' or octet_length(p_decisions::text)>131072 then raise exception 'invalid_activity_rules';end if;
  for rule in select value from jsonb_array_elements(p_rules) loop
   k:=rule->>'metric';
   if k in ('discord','voted','onePerPerson') then
    if rule->'minimum' is distinct from 'true'::jsonb then raise exception 'invalid_activity_rule';end if;
   elsif k in ('donations','cwStars','cwAttacks','cwTriples','cwlStars','cwlAttacks','cwlTriples') then
    if jsonb_typeof(rule->'minimum') is distinct from 'number' or coalesce(rule->>'minimum','') !~ '^[0-9]{1,8}$' then raise exception 'invalid_activity_rule';end if;
   else raise exception 'activity_metric_not_available';end if;
  end loop;
  for k,v in select key,value from jsonb_each(p_decisions) loop
   if k !~ '^#[0289PYLQGRJCUV]{3,15}$' or jsonb_typeof(v) is distinct from 'object' or
    exists(select 1 from jsonb_each(v) e where e.key not in ('voted','excluded','organizer','resolution','note')) or
    exists(select 1 from jsonb_each(v) e where e.key in ('voted','excluded','organizer') and jsonb_typeof(e.value)<>'boolean') or
    (v ? 'resolution' and coalesce(v->>'resolution','') not in ('qualify','exclude')) or
    (v ? 'note' and (jsonb_typeof(v->'note')<>'string' or length(v->>'note')>240)) or
    (v ? 'resolution' and length(trim(coalesce(v->>'note','')))<3)
   then raise exception 'invalid_activity_decision';end if;
  end loop;
  if p_action='create' then
   insert into public.cwl_activity_campaigns(id,clan_id,clan_tag,title,start_date,end_date,rules,decisions)
   values(p_id,p_clan,own,trim(p_title),p_start,p_end,p_rules,p_decisions) returning * into c;
  else
   -- Dates and conditions fixed after the event starts; decisions can still
   -- be marked and reviewed. Future events remain editable.
   if today>=c.start_date and (p_rules is distinct from c.rules or p_start is distinct from c.start_date or p_end is distinct from c.end_date)
    then raise exception 'activity_started_rules_locked';end if;
   if p_start is null or p_end is null or p_end<p_start or p_end-p_start>=366 or length(trim(coalesce(p_title,''))) not between 1 and 80
    or (today<c.start_date and p_start<today) then raise exception 'invalid_activity_period';end if;
   update public.cwl_activity_campaigns set title=trim(p_title),start_date=p_start,end_date=p_end,rules=p_rules,decisions=p_decisions,
    revision=revision+1,updated_at=now() where id=c.id returning * into c;
  end if;
 end if;
 one_per_person:=c.rules @> '[{"metric":"onePerPerson","minimum":true}]'::jsonb;
 players:=private.cwl_activity_evidence(p_clan,own,c.start_date,least(c.end_date,today));
 for player in select value from jsonb_array_elements(players) loop
  decision:=coalesce(c.decisions->(player->>'tag'),'{}'::jsonb);checks:='[]'::jsonb;state:='qualified';
  group_key:=player->>'tag';group_organizer:=false;
  if one_per_person then
   select coalesce((select primary_tag from public.cwl_activity_account_links where clan_id=p_clan and clan_tag=own and player_tag=player->>'tag'),player->>'tag') into group_key;
   select exists(select 1 from jsonb_each(c.decisions) d where d.value->>'organizer'='true' and
    (d.key=group_key or exists(select 1 from public.cwl_activity_account_links l where l.clan_id=p_clan and l.clan_tag=own and l.player_tag=d.key and l.primary_tag=group_key))) into group_organizer;
   player:=player||jsonb_build_object('groupKey',group_key);
  end if;
  for rule in select value from jsonb_array_elements(c.rules) loop
   k:=rule->>'metric';metric_value:=null;met:=null;
   if k='onePerPerson' then continue;end if;
   if k='discord' then met:=(player->>'discord')::boolean;
   elsif k='voted' then met:=(decision->>'voted')::boolean;
   else metric_value:=(player->'evidence'->k->>'value')::bigint;
    if metric_value>=(rule->>'minimum')::bigint then met:=true;end if;
   end if;
   checks:=checks||jsonb_build_array(jsonb_build_object('metric',k,'minimum',rule->'minimum','value',metric_value,
    'status',case when met then 'met' when met=false then 'unmet' else 'unknown' end));
   if met=false then state:='unmet';elsif met is null and state='qualified' then state:='unknown';end if;
  end loop;
  if group_organizer or decision->>'organizer'='true' or decision->>'excluded'='true' then state:='excluded';
  elsif state='unknown' and today>c.end_date and decision->>'resolution'='qualify' then state:='qualified';
  elsif state='unknown' and today>c.end_date and decision->>'resolution'='exclude' then state:='excluded';end if;
  if state='unknown' then unknown_count:=unknown_count+1;end if;
  if state='qualified' and not one_per_person then pool:=pool||jsonb_build_array(jsonb_build_object('tag',player->>'tag','name',player->>'name'));end if;
  rows:=rows||jsonb_build_array(player||jsonb_build_object('decision',decision,'checks',checks,'status',state));
 end loop;
 if one_per_person then
  -- Individually qualified accounts only: no merging of activity totals.
  -- Choose a qualified primary account if possible, otherwise lowest tag.
  with qualified as (select value p from jsonb_array_elements(rows) where value->>'status'='qualified'),
  grouped as (select p->>'groupKey' g, (array_agg(p order by (p->>'tag'=p->>'groupKey') desc,p->>'tag'))[1] rep,
    jsonb_agg(p->>'tag' order by p->>'tag') accounts from qualified group by p->>'groupKey')
  select coalesce(jsonb_agg(jsonb_build_object('tag',rep->>'tag','name',rep->>'name','groupKey',g,'accounts',accounts) order by g),'[]'::jsonb) into pool from grouped;
 end if;
 total:=jsonb_array_length(pool);
 witness:=encode(extensions.digest(jsonb_build_object('id',c.id,'revision',c.revision,'rules',c.rules,'rows',rows,'pool',pool)::text,'sha256'),'hex');
 if p_action='draw' then
  if today<=c.end_date or total=0 or unknown_count>0 then raise exception 'activity_draw_not_ready';end if;
  if p_witness is distinct from witness then raise exception 'activity_evidence_changed' using errcode='40001';end if;
  lim:=(4294967296::bigint/total)*total;
  loop
   bytes:=extensions.gen_random_bytes(4);
   rnd:=get_byte(bytes,0)::bigint*16777216+get_byte(bytes,1)::bigint*65536+get_byte(bytes,2)::bigint*256+get_byte(bytes,3);
   exit when rnd<lim;
  end loop;
  winner:=pool->((rnd%total)::int);
  update public.cwl_activity_campaigns set official=jsonb_build_object('winner',winner,'drawnAt',now(),'drawnBy',actor,'witness',witness,
   'pool',pool,'ticket',rnd%total,'rows',rows,'rules',c.rules,'decisions',c.decisions,'start',c.start_date,'end',c.end_date),
   revision=revision+1,updated_at=now() where id=c.id returning * into c;
 end if;
 return jsonb_build_object('id',c.id,'title',c.title,'start',c.start_date,'end',c.end_date,'revision',c.revision,'rules',c.rules,'decisions',c.decisions,
 'rows',rows,'pool',pool,'onePerPerson',one_per_person,'qualified',total,'unknown',unknown_count,'witness',witness,'today',today,'official',c.official,
 'ready',today>c.end_date and total>0 and unknown_count=0,'coverage','lower_bound');
end
$$;
