begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','owner@synthetic.invalid'),
 ('22222222-2222-4222-8222-222222222222','editor@synthetic.invalid'),
 ('33333333-3333-4333-8333-333333333333','viewer@synthetic.invalid'),
 ('44444444-4444-4444-8444-444444444444','outsider@synthetic.invalid');
insert into public.cwl_clans(id,name,owner_user_id,clash_tag) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic','11111111-1111-4111-8111-111111111111','#P02');
insert into public.cwl_clan_memberships(clan_id,user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','editor'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','viewer');
insert into public.cwl_plan_review_state(clan_id,cycle_id,season,locked) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',to_char(now(),'YYYY-MM'),true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.cwl_cloud_profiles(clan_id,profile_json,updated_by) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 jsonb_build_object('config',jsonb_build_object('strategicAuto',true,'strategicMode','balanced','days',5,'slots',15),'cwlLive',jsonb_build_object('season',to_char(now(),'YYYY-MM'),'clanTag','#P02'),'members',(select jsonb_agg(jsonb_build_object('id','p'||i)) from generate_series(1,15) i)),'11111111-1111-4111-8111-111111111111');
insert into public.cwl_plan_suggestions(clan_id,cycle_id,author_id,base_revision,suggested_profile) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',1,'{"draft":true}');
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
do $test$
declare s jsonb; c uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; o uuid:='11111111-1111-4111-8111-111111111111'; cy uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
 if public.cwl_claim_strategic_recompute('[]'::jsonb) is not null then raise exception 'empty grant claimed';end if;
 if public.cwl_claim_strategic_recompute(jsonb_build_array(jsonb_build_object('clanId',c,'clanTag','#P08','ownerId',o))) is not null then raise exception 'wrong grant claimed';end if;
 if (public.cwl_claim_strategic_recompute(jsonb_build_array(jsonb_build_object('clanId',c,'clanTag','#P02','ownerId',o)))->>'revision') is distinct from '1' then raise exception 'pending revision not claimed';end if;
 if public.cwl_claim_strategic_recompute(jsonb_build_array(jsonb_build_object('clanId',c,'clanTag','#P02','ownerId',o))) is not null then raise exception 'duplicate claim';end if;
 s:=jsonb_build_object('source','collector','version',1,'clanId',c,'clanTag','#P02','season',to_char(now(),'YYYY-MM'),'observedAt',floor(extract(epoch from clock_timestamp())*1000),'plan',(select jsonb_agg(jsonb_build_object('day',d,'lineup',(select jsonb_agg('p'||i) from generate_series(1,15) i)) order by d) from generate_series(1,5) d),'observedRounds',(select jsonb_agg(case when d=1 then jsonb_build_object('day',d,'available',true,'warTag','#PQQ','state','preparation') else jsonb_build_object('day',d,'available',false) end order by d) from generate_series(1,5) d),'registeredTags',(select jsonb_agg('#P'||substr('0289PYLQGRJCUV',1+(i/13),1)||substr('0289PYLQGRJCUV',1+(i%13),1)) from generate_series(0,14) i),'anchorWarTag','#PQQ','ruleKey','fixture');
 if not public.cwl_publish_strategic_assignment(c,o,'#P02',cy,1,clock_timestamp()+interval '1 minute',s) then raise exception 'locked inputs must not stop derived publication';end if;
 if public.cwl_publish_strategic_assignment(c,o,'#P02',cy,1,clock_timestamp()+interval '1 minute',s) then raise exception 'duplicate observation';end if;
 if public.cwl_publish_strategic_assignment(c,o,'#P02',cy,2,clock_timestamp()+interval '1 minute',s) then raise exception 'wrong revision';end if;
 if public.cwl_publish_strategic_assignment(c,o,'#P08',cy,1,clock_timestamp()+interval '1 minute',s) then raise exception 'wrong tag';end if;
 if public.cwl_publish_strategic_assignment(c,o,'#P02',cy,1,clock_timestamp()-interval '1 minute',s) then raise exception 'expired';end if;
 if public.cwl_publish_strategic_assignment(c,o,'#P02',cy,1,clock_timestamp()+interval '1 minute',jsonb_set(s,'{plan,0,lineup}','["foreign"]')) then raise exception 'malformed lineup accepted';end if;
 if public.cwl_publish_strategic_assignment(c,o,'#P02',cy,1,clock_timestamp()+interval '1 minute',jsonb_set(s,'{observedRounds,0,warTag}','"#PYY"')) then raise exception 'bad anchor accepted';end if;
 if (select revision from public.cwl_cloud_profiles where clan_id=c)<>1 or not exists(select 1 from public.cwl_plan_suggestions where clan_id=c and status='pending' and base_revision=1) then raise exception 'input or suggestion mutated';end if;
end;$test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $test$ begin
 if (select count(*) from public.cwl_strategic_assignments)<>1 then raise exception 'viewer cannot read derived assignment';end if;
 if has_function_privilege(current_user,'public.cwl_publish_strategic_assignment(uuid,uuid,text,uuid,bigint,timestamptz,jsonb)','execute') or has_function_privilege(current_user,'public.cwl_claim_strategic_recompute_appwide()','execute') or has_function_privilege(current_user,'public.cwl_claim_strategic_recompute(jsonb)','execute') or has_table_privilege(current_user,'public.cwl_strategic_recompute_claims','select') or has_table_privilege(current_user,'public.cwl_strategic_assignments','update') then raise exception 'viewer can publish';end if;
end;$test$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $test$ begin if exists(select 1 from public.cwl_strategic_assignments) then raise exception 'cross tenant leak';end if;end;$test$;
reset role;
-- Independent owner with no grant, disabled first, then enabled.
insert into public.cwl_clans(id,name,owner_user_id,clash_tag) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Synthetic 2','44444444-4444-4444-8444-444444444444','#P08');
insert into public.cwl_plan_review_state(clan_id,cycle_id,season,locked) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd',to_char(now(),'YYYY-MM'),false);
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
insert into public.cwl_cloud_profiles(clan_id,profile_json,updated_by) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"config":{"strategicAuto":false,"strategicMode":"development"}}','44444444-4444-4444-8444-444444444444');
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
do $test$ begin if public.cwl_claim_strategic_recompute_appwide() is not null then raise exception 'disabled or completed claimed';end if;end;$test$;
reset role;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
update public.cwl_cloud_profiles set profile_json=jsonb_build_object('config',jsonb_build_object('strategicAuto',true,'strategicMode','development'),'cwlLive',jsonb_build_object('season',to_char(now(),'YYYY-MM'),'clanTag','#P08')) where clan_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
do $test$ begin
 if (public.cwl_claim_strategic_recompute_appwide()->>'clanId') is distinct from 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' then raise exception 'second tenant not claimed';end if;
 if public.cwl_claim_strategic_recompute_appwide() is not null then raise exception 'duplicate appwide claim';end if;
end;$test$;
reset role;
rollback;
