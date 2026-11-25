-- Synthetic fixture only, always inside BEGIN/ROLLBACK with release SQL.
insert into auth.users(id,email) values
 ('f1390000-0000-4000-8000-000000000001','activity-fixture-owner@example.invalid'),
 ('f1390000-0000-4000-8000-000000000003','activity-fixture-other@example.invalid');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f1390000-0000-4000-8000-000000000001"}',true);
insert into public.cwl_clans(id,name,clash_tag,owner_user_id)
values('f1390000-0000-4000-8000-000000000002','Activity fixture','#2PYL','f1390000-0000-4000-8000-000000000001');
insert into public.cwl_clan_member_tenure(clan_id,source_clash_tag,player_tag,first_observed_at,last_present_at,last_observed_at,state_changed_at,is_present)
select 'f1390000-0000-4000-8000-000000000002','#2PYL',tag,now()-interval '10 days',now(),now(),now()-interval '10 days',true from unnest(array['#8PYL','#Q9QL']) tag;
insert into public.cwl_clan_donation_observations(clan_id,source_clash_tag,player_tag,observed_at,positive_delta)
values('f1390000-0000-4000-8000-000000000002','#2PYL','#8PYL',now()-interval '3 days',1000),
('f1390000-0000-4000-8000-000000000002','#2PYL','#Q9QL',now()-interval '3 days',50);
insert into public.cwl_stat_wars(clan_id,war_key,war_type,started_at,team_size,source,roster_tags,finalized,source_clash_tag)
values('f1390000-0000-4000-8000-000000000002','normal:fixture','normal',now()-interval '3 days',5,'api','["#8PYL","#Q9QL"]',true,'#2PYL'),
('f1390000-0000-4000-8000-000000000002','normal:importfixture','normal',now()-interval '3 days',5,'import','["#Q9QL"]',true,'#2PYL');
insert into public.cwl_stat_attacks(clan_id,war_key,attacker_tag,attack_order,stars,destruction)
values('f1390000-0000-4000-8000-000000000002','normal:fixture','#8PYL',1,3,100),
('f1390000-0000-4000-8000-000000000002','normal:importfixture','#Q9QL',1,3,100);
insert into public.cwl_activity_campaigns(id,clan_id,clan_tag,title,start_date,end_date,rules)
values('f1390000-0000-4000-8000-000000000004','f1390000-0000-4000-8000-000000000002','#2PYL','Finished fixture',
 (now() at time zone 'Europe/Vienna')::date-7,(now() at time zone 'Europe/Vienna')::date-1,
 '[{"metric":"donations","minimum":700},{"metric":"cwStars","minimum":3},{"metric":"discord","minimum":true}]');
set local role authenticated;
do $$
declare cid uuid:='f1390000-0000-4000-8000-000000000002'; id1 uuid:='f1390000-0000-4000-8000-000000000004'; id2 uuid:='f1390000-0000-4000-8000-000000000005';
 today date:=(now() at time zone 'Europe/Vienna')::date; r jsonb; s jsonb; o jsonb; blocked boolean;
begin
 r:=public.cwl_activity_manage(cid,'discord',p_player=>'#8PYL',p_discord=>true);
 r:=public.cwl_activity_manage(cid,'read',id1);
 if r->>'qualified'<>'1' or r->>'unknown'<>'1' or r->>'ready'<>'false' then raise exception 'incorrect initial progress %',r;end if;
 if (r->'rows'->1->'evidence'->'cwStars'->>'value')<>'0' then raise exception 'import counted';end if;
 blocked:=false;
 begin perform public.cwl_activity_manage(cid,'draw',id1,1,p_witness=>r->>'witness');exception when others then blocked:=true;end;
 if not blocked then raise exception 'unknown participant allowed draw';end if;
 s:=public.cwl_activity_manage(cid,'save',id1,1,'Finished fixture',today-7,today-1,r->'rules','{"#Q9QL":{"resolution":"exclude","note":"Reviewed missing evidence"}}');
 if s->>'ready'<>'true' then raise exception 'review did not unblock %',s;end if;
 blocked:=false;
 begin perform public.cwl_activity_manage(cid,'draw',id1,2,p_witness=>'wrong');exception when serialization_failure then blocked:=true;end;
 if not blocked then raise exception 'stale evidence accepted';end if;
 o:=public.cwl_activity_manage(cid,'draw',id1,2,p_witness=>s->>'witness');
 if o->'official'->'winner'->>'tag'<>'#8PYL' then raise exception 'wrong winner';end if;
 r:=public.cwl_activity_manage(cid,'draw',id1,2,p_witness=>s->>'witness');
 if r->'official' is distinct from o->'official' then raise exception 'winner changed';end if;
 r:=public.cwl_activity_manage(cid,'create',id2,p_title=>'Scheduled fixture',p_start=>today,p_end=>today+6,p_rules=>'[{"metric":"donations","minimum":700}]',p_decisions=>'{}');
 if r->>'ready'<>'false' then raise exception 'early draw permitted';end if;
 -- Future campaigns expose the currently observed roster for registration,
 -- but do not attribute any past donations or attacks to that future window.
 r:=public.cwl_activity_manage(cid,'create','f1390000-0000-4000-8000-000000000006',p_title=>'Future fixture',p_start=>today+1,p_end=>today+14,p_rules=>'[{"metric":"donations","minimum":700}]',p_decisions=>'{}');
 if jsonb_array_length(r->'rows')<>2 or r->>'qualified'<>'0' or r->>'ready'<>'false'
 then raise exception 'future roster or progress invalid %',r;end if;
 if exists(select 1 from jsonb_array_elements(r->'rows') p where p->'evidence'->'donations'->>'value'<>'0')
 then raise exception 'future campaign attributed past donations';end if;

 blocked:=false;
 begin perform public.cwl_activity_manage(cid,'save',id2,1,'Scheduled fixture',today,today+6,'[{"metric":"donations","minimum":1}]','{}');exception when others then blocked:=true;end;
 if not blocked then raise exception 'started goals editable';end if;
 blocked:=false;
 begin update public.cwl_activity_campaigns set title='not allowed' where id=id1;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'direct update allowed';end if;
end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f1390000-0000-4000-8000-000000000003"}',true);
do $$declare blocked boolean:=false;begin
 if exists(select 1 from public.cwl_activity_campaigns where clan_id='f1390000-0000-4000-8000-000000000002') then raise exception 'cross-clan leak';end if;
 begin perform public.cwl_activity_manage('f1390000-0000-4000-8000-000000000002','list');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'outsider RPC allowed';end if;
end$$;
reset role;
select 'fixture passed' as result;
