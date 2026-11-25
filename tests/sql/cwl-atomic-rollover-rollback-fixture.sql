-- Run after the release SQL, inside the SAME BEGIN/ROLLBACK transaction.
-- Synthetic isolated tenant and user only; do not commit this fixture.
insert into auth.users(id,email) values('f1370000-0000-4000-8000-000000000001','rollover-fixture@example.invalid');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f1370000-0000-4000-8000-000000000001"}',true);
insert into public.cwl_clans(id,name,clash_tag,owner_user_id)
values('f1370000-0000-4000-8000-000000000002','Rollback fixture','#2PYL','f1370000-0000-4000-8000-000000000001');
insert into public.cwl_cloud_profiles(clan_id,profile_json)
values('f1370000-0000-4000-8000-000000000002',jsonb_build_object(
 'id','fixture','name','Fixture','config',jsonb_build_object('days',7,'slots',15),
 'members','[]'::jsonb,'archivedMembers','[]'::jsonb,'archives','[]'::jsonb,
 'locks',(select jsonb_agg('{"locked":false,"lineup":[]}'::jsonb) from generate_series(1,7)),
 'dayGoals','[]'::jsonb,'cwlLive',jsonb_build_object('season',to_char(now()-interval '1 month','YYYY-MM'),'clanTag','#2PYL','rounds','[]'::jsonb)));
insert into public.cwl_plan_review_state(clan_id,season,locked,locked_by)
values('f1370000-0000-4000-8000-000000000002',to_char(now()-interval '1 month','YYYY-MM'),true,'f1370000-0000-4000-8000-000000000001')
on conflict(clan_id) do update set season=excluded.season,locked=true,locked_by=excluded.locked_by;
insert into public.cwl_plan_suggestions(clan_id,cycle_id,author_id,base_revision,suggested_profile)
select clan_id,cycle_id,'f1370000-0000-4000-8000-000000000001',1,'{}'::jsonb from public.cwl_plan_review_state
where clan_id='f1370000-0000-4000-8000-000000000002';
do $$begin
 if has_function_privilege('authenticated','public.cwl_collector_rollover(uuid,bigint,text,jsonb,jsonb)','EXECUTE') or
 has_function_privilege('anon','public.cwl_collector_rollover(uuid,bigint,text,jsonb,jsonb)','EXECUTE')
 then raise exception 'unexpected public execution';end if;
end$$;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare cid uuid:='f1370000-0000-4000-8000-000000000002';
 oldp jsonb; nextp jsonb; proof jsonb; oldseason text; newseason text; rev bigint; oldcycle uuid;
begin
 select profile_json,revision into oldp,rev from public.cwl_cloud_profiles where clan_id=cid;
 select cycle_id into oldcycle from public.cwl_plan_review_state where clan_id=cid;
 oldseason:=oldp->'cwlLive'->>'season';newseason:=to_char(now() at time zone 'UTC','YYYY-MM');
 proof:=jsonb_build_object('season',newseason,'clanTag','#2PYL','state','preparation','warCount',5,
  'clanTags',jsonb_build_array('#2PYL','#8PYL','#G9QL','#P9QL','#Q9QL','#R9QL'));
 nextp:=oldp||jsonb_build_object('cwlLive',jsonb_build_object('season',newseason,'clanTag','#2PYL','rounds','[]'::jsonb,'warCount',5),
  'cwlLiveIgnoredSeason',oldseason,'config',jsonb_build_object('days',5,'slots',15),
  'dayGoals',(select jsonb_agg('{"townHall":{},"strength":{"high":0,"medium":0,"low":0,"verylow":0}}'::jsonb) from generate_series(1,7)),
  'archives',jsonb_build_array(jsonb_build_object('sourceSeason',oldseason,'cwlLive',oldp->'cwlLive','playedCount',0,'complete',false,'days',7,'slots',15,'lineups','[]'::jsonb)));
 if public.cwl_collector_rollover(cid,rev+1,oldseason,proof,nextp) then raise exception 'stale revision accepted';end if;
 if public.cwl_collector_rollover(cid,rev,oldseason,proof||'{"clanTag":"#8PYL"}'::jsonb,nextp) then raise exception 'wrong clan accepted';end if;
 if public.cwl_collector_rollover(cid,rev,oldseason,proof||'{"state":"ended"}'::jsonb,nextp) then raise exception 'old ended group accepted';end if;
 if public.cwl_collector_rollover(cid,rev,oldseason,proof,nextp||'{"archives":[]}'::jsonb) then raise exception 'missing archive accepted';end if;
 if not public.cwl_collector_rollover(cid,rev,oldseason,proof,nextp) then raise exception 'valid rollover refused';end if;
 if public.cwl_collector_rollover(cid,rev,oldseason,proof,nextp) then raise exception 'duplicate rollover';end if;
 if not exists(select 1 from public.cwl_cloud_profiles where clan_id=cid and revision=rev+1 and profile_json=nextp
   and updated_by='f1370000-0000-4000-8000-000000000001') then raise exception 'profile mismatch';end if;
 if not exists(select 1 from public.cwl_profile_snapshots where clan_id=cid and revision=rev and profile_json=oldp) then raise exception 'snapshot missing';end if;
 if not exists(select 1 from public.cwl_plan_review_state where clan_id=cid and season=newseason and cycle_id<>oldcycle and not locked) then raise exception 'cycle not advanced';end if;
 if not exists(select 1 from public.cwl_plan_suggestions where clan_id=cid and cycle_id=oldcycle and status='stale' and decided_by is null) then raise exception 'suggestion not stale';end if;
 if not exists(select 1 from public.cwl_change_events where clan_id=cid and revision=rev+1 and actor_id is null and details->>'system_action'='cwl_season_rollover') then raise exception 'system audit missing';end if;
 -- Outside the transaction marker the same service identity may not edit a plan.
 begin
  update public.cwl_cloud_profiles set profile_json=oldp where clan_id=cid;
  raise exception 'guard unexpectedly allowed direct service write';
 exception when insufficient_privilege then null;
 end;
end$$;
reset role;
select 'atomic rollover fixture passed' as result;
